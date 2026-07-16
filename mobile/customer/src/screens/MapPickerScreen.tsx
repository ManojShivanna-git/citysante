/**
 * MapPickerScreen
 *
 * Redesigned address picker — no typing needed:
 *   1. Search bar  → Google Places Autocomplete REST → tap suggestion
 *   2. "Use my current location" → GPS → reverse geocode
 *   3. Drag the map to fine-tune the pin
 *   4. Tap "Confirm" — calls mapPickCallback and goes back
 */

import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, TextInput, FlatList,
  Keyboard, Alert,
} from 'react-native'
import MapView, { Region, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Location from 'expo-location'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { callMapPickCallback, type MapPickResult } from '../utils/mapPickCallback'
import { RED } from '../theme'

const GMAPS_KEY = 'AIzaSyDomYDJ9arv0ZY4DM-CYChxPTmV82QgBBw'

const DEFAULT_REGION: Region = {
  latitude: 12.9716, longitude: 77.5946,
  latitudeDelta: 0.01, longitudeDelta: 0.01,
}

interface Suggestion {
  place_id: string
  description: string
  main_text:   string
  secondary_text: string
}

interface ParsedAddress {
  street: string; city: string; state: string; pincode: string
}

// ── Address component parser ──────────────────────────────────────────────────
function parseComponents(comps: any[]): ParsedAddress {
  const get = (type: string) => comps.find((c: any) => c.types.includes(type))?.long_name ?? ''
  const street = [get('street_number'), get('route'), get('sublocality_level_1') || get('sublocality') || get('neighborhood')]
    .filter(Boolean).join(', ') || get('premise') || 'Unnamed location'
  return {
    street,
    city:    get('locality') || get('administrative_area_level_2'),
    state:   get('administrative_area_level_1'),
    pincode: get('postal_code'),
  }
}

// ── Reverse geocode via REST ──────────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<ParsedAddress | null> {
  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAPS_KEY}`)
    const json = await res.json()
    if (json.status === 'OK' && json.results?.length) return parseComponents(json.results[0].address_components)
  } catch {}
  return null
}

// ── Places Autocomplete via REST ──────────────────────────────────────────────
async function getPlaceSuggestions(input: string): Promise<Suggestion[]> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GMAPS_KEY}&components=country:in&language=en&types=geocode`
    const res  = await fetch(url)
    const json = await res.json()
    return (json.predictions ?? []).slice(0, 5).map((p: any) => ({
      place_id:       p.place_id,
      description:    p.description,
      main_text:      p.structured_formatting?.main_text ?? p.description,
      secondary_text: p.structured_formatting?.secondary_text ?? '',
    }))
  } catch {}
  return []
}

// ── Place details (geometry + address) via REST ───────────────────────────────
async function getPlaceDetails(placeId: string): Promise<{ lat: number; lng: number; parsed: ParsedAddress } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GMAPS_KEY}&fields=geometry,address_components`
    const res  = await fetch(url)
    const json = await res.json()
    const result = json.result
    if (!result) return null
    return {
      lat:    result.geometry.location.lat,
      lng:    result.geometry.location.lng,
      parsed: parseComponents(result.address_components ?? []),
    }
  } catch {}
  return null
}

export default function MapPickerScreen() {
  const navigation = useNavigation()
  const mapRef     = useRef<MapView>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [region,        setRegion]        = useState<Region>(DEFAULT_REGION)
  const [parsed,        setParsed]        = useState<ParsedAddress | null>(null)
  const [geocoding,     setGeocoding]     = useState(false)
  const [dragging,      setDragging]      = useState(false)
  const [mapsReady,     setMapsReady]     = useState(false)

  // GPS in-progress flag — prevents double-taps hanging
  const [locating,      setLocating]      = useState(false)

  // Search
  const [query,         setQuery]         = useState('')
  const [suggestions,   setSuggestions]   = useState<Suggestion[]>([])
  const [searching,     setSearching]     = useState(false)
  const [showDropdown,  setShowDropdown]  = useState(false)

  // ── On mount: jump to device location ────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          const r: Region = {
            latitude: loc.coords.latitude, longitude: loc.coords.longitude,
            latitudeDelta: 0.008, longitudeDelta: 0.008,
          }
          setRegion(r)
          setMapsReady(true)
          doReverseGeocode(loc.coords.latitude, loc.coords.longitude)
          return
        } catch {}
      }
      setMapsReady(true)
      doReverseGeocode(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude)
    })()
  }, [])

  // ── Current location button ───────────────────────────────────────────────
  const goToCurrentLocation = async () => {
    if (locating) return                      // ignore repeated taps while in-flight
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location access for Isanthe in your phone Settings, then try again.'
        )
        return
      }

      // 1. Try a cached fix first — instant, no battery drain
      let position = await Location.getLastKnownPositionAsync({ maxAge: 30_000, requiredAccuracy: 150 })

      // 2. No recent cache → request a fresh fix (Low = faster than Balanced)
      if (!position) {
        position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low })
      }

      if (position) {
        const r: Region = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.008, longitudeDelta: 0.008,
        }
        setRegion(r)
        mapRef.current?.animateToRegion(r, 400)
        setQuery('')
        setSuggestions([])
        setShowDropdown(false)
        doReverseGeocode(position.coords.latitude, position.coords.longitude)
      }
    } catch {
      Alert.alert('Location Error', 'Could not get your location. Please try again or move to an open area.')
    } finally {
      setLocating(false)                      // always re-enable the button
    }
  }

  // ── Reverse geocode helper ────────────────────────────────────────────────
  const doReverseGeocode = async (lat: number, lng: number) => {
    setGeocoding(true)
    const result = await reverseGeocode(lat, lng)
    setParsed(result)
    setGeocoding(false)
  }

  // ── Search: debounced Places Autocomplete ─────────────────────────────────
  const handleSearchChange = (text: string) => {
    setQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!text.trim()) { setSuggestions([]); setShowDropdown(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const results = await getPlaceSuggestions(text)
      setSuggestions(results)
      setShowDropdown(results.length > 0)
      setSearching(false)
    }, 350)
  }

  // ── Select a suggestion → fetch details → fly to location ─────────────────
  const selectSuggestion = async (s: Suggestion) => {
    Keyboard.dismiss()
    setQuery(s.main_text)
    setSuggestions([])
    setShowDropdown(false)
    setGeocoding(true)
    const details = await getPlaceDetails(s.place_id)
    if (details) {
      const r: Region = {
        latitude: details.lat, longitude: details.lng,
        latitudeDelta: 0.008, longitudeDelta: 0.008,
      }
      setRegion(r)
      mapRef.current?.animateToRegion(r, 500)
      setParsed(details.parsed)
    }
    setGeocoding(false)
  }

  // ── Map drag handlers ─────────────────────────────────────────────────────
  const handleRegionChange = () => {
    setDragging(true)
    setParsed(null)
    setShowDropdown(false)
  }

  const handleRegionChangeComplete = (r: Region) => {
    setRegion(r)
    setDragging(false)
    doReverseGeocode(r.latitude, r.longitude)
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!parsed?.street || !parsed?.city) return
    callMapPickCallback({
      street:  parsed.street,
      city:    parsed.city    || 'Unknown City',
      state:   parsed.state   || 'Karnataka',
      pincode: parsed.pincode || '000000',
      lat:     region.latitude,
      lng:     region.longitude,
    })
    navigation.goBack()
  }

  const isReady   = !!parsed && !geocoding && !dragging
  const hasStreet = !!(parsed?.street && parsed?.city)

  return (
    <View style={styles.container}>

      {/* ── Map (full screen background) ────────────────────────── */}
      {mapsReady && (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={region}
          onRegionChange={handleRegionChange}
          onRegionChangeComplete={handleRegionChangeComplete}
          showsUserLocation
        />
      )}

      {/* ── Fixed centre pin (balloon style) ───────────────────── */}
      <View style={styles.pinWrapper} pointerEvents="none">
        <View style={[styles.pinGroup, dragging && styles.pinGroupUp]}>
          {/* Balloon circle */}
          <View style={styles.pinBalloon}>
            <Ionicons name="home" size={22} color="#fff" />
          </View>
          {/* Triangle tip */}
          <View style={styles.pinTip} />
        </View>
        {/* Ground shadow */}
        <View style={[styles.pinShadow, dragging && styles.pinShadowLarge]} />
      </View>

      {/* ── Top overlay: search + current location ──────────────── */}
      <View style={styles.topOverlay}>

        {/* Search bar */}
        <View style={styles.searchBar}>
          {searching
            ? <ActivityIndicator size="small" color={RED} style={{ marginRight: 4 }} />
            : <Ionicons name="search-outline" size={19} color="#9ca3af" />}
          <TextInput
            style={styles.searchInput}
            placeholder="Search area, street or landmark…"
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={handleSearchChange}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setSuggestions([]); setShowDropdown(false) }}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* Suggestions dropdown */}
        {showDropdown && (
          <View style={styles.dropdown}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={s.place_id}
                style={[styles.suggestion, i < suggestions.length - 1 && styles.suggestionBorder]}
                onPress={() => selectSuggestion(s)}
              >
                <Ionicons name="location-outline" size={16} color="#6b7280" style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionMain} numberOfLines={1}>{s.main_text}</Text>
                  {!!s.secondary_text && (
                    <Text style={styles.suggestionSub} numberOfLines={1}>{s.secondary_text}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Current location */}
        {!showDropdown && (
          <TouchableOpacity
            style={[styles.currentLocBtn, locating && styles.currentLocBtnActive]}
            onPress={goToCurrentLocation}
            disabled={locating}
            activeOpacity={0.75}
          >
            {locating
              ? <ActivityIndicator size="small" color={RED} />
              : <Ionicons name="locate" size={16} color={RED} />
            }
            <Text style={styles.currentLocText}>
              {locating ? 'Getting your location…' : 'Use my current location'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Bottom sheet: detected address + confirm ─────────────── */}
      <View style={styles.bottomSheet}>
        <View style={styles.addressRow}>
          <Ionicons name="map-outline" size={20} color={RED} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            {geocoding || dragging ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={RED} />
                <Text style={styles.geocodingText}>Finding address…</Text>
              </View>
            ) : parsed ? (
              <>
                <Text style={styles.streetText} numberOfLines={2}>{parsed.street}</Text>
                <Text style={styles.cityText}>
                  {[parsed.city, parsed.state, parsed.pincode].filter(Boolean).join(', ')}
                </Text>
              </>
            ) : (
              <Text style={styles.geocodingText}>Search or move the map to detect your address</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, (!isReady || !hasStreet) && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!isReady || !hasStreet}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.confirmBtnText}>Confirm this Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5e7eb' },

  // Fixed centre pin (balloon)
  pinWrapper: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 160,
    alignItems: 'center', justifyContent: 'center',
  },
  pinGroup:    { alignItems: 'center' },
  pinGroupUp:  { transform: [{ translateY: -14 }] },
  pinBalloon: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: RED, shadowOpacity: 0.45, shadowRadius: 10,
    elevation: 10,
  },
  pinTip: {
    width: 0, height: 0,
    borderLeftWidth: 11, borderRightWidth: 11, borderTopWidth: 20,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: RED,
    marginTop: -3,
  },
  pinShadow:      { width: 14, height: 6, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.20)', marginTop: 2 },
  pinShadowLarge: { transform: [{ scaleX: 1.6 }], opacity: 0.3 },

  // Top overlay
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 12, paddingHorizontal: 12,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111', padding: 0 },

  dropdown: {
    backgroundColor: '#fff', borderRadius: 14, marginTop: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 6,
    overflow: 'hidden',
  },
  suggestion:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  suggestionMain:   { fontSize: 14, fontWeight: '600', color: '#111' },
  suggestionSub:    { fontSize: 12, color: '#9ca3af', marginTop: 1 },

  currentLocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    marginTop: 8, alignSelf: 'flex-start',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
    minWidth: 200,
  },
  currentLocBtnActive: { opacity: 0.7 },   // visual cue that button is busy
  currentLocText: { fontSize: 13, fontWeight: '600', color: RED },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 14,
  },
  addressRow:    { flexDirection: 'row', gap: 10, marginBottom: 16, minHeight: 46 },
  streetText:    { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 2 },
  cityText:      { fontSize: 13, color: '#6b7280' },
  geocodingText: { fontSize: 13, color: '#9ca3af' },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: RED, paddingVertical: 15, borderRadius: 14,
    shadowColor: RED, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  confirmBtnDisabled: { backgroundColor: '#d1d5db', shadowOpacity: 0 },
  confirmBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
})
