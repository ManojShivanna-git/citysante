import { useState, useEffect, useRef } from 'react'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Alert,
} from 'react-native'
import MapView, { Marker, MapPressEvent, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'

const ORANGE = '#f97316'

// Fallback centre — Bangalore
const DEFAULT_REGION = { latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.01, longitudeDelta: 0.01 }

interface Props {
  visible: boolean
  onClose: () => void
  onConfirm: (lat: number, lng: number) => void
  initialLat?: number
  initialLng?: number
}

export default function MapPickerModal({ visible, onClose, onConfirm, initialLat, initialLng }: Props) {
  const mapRef = useRef<MapView>(null)
  const [region, setRegion] = useState(DEFAULT_REGION)
  const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(
    initialLat && initialLng ? { latitude: initialLat, longitude: initialLng } : null
  )
  const [locLoading, setLocLoading] = useState(false)

  // When modal opens, jump to user's current location
  useEffect(() => {
    if (!visible) return
    if (initialLat && initialLng) {
      const r = { latitude: initialLat, longitude: initialLng, latitudeDelta: 0.005, longitudeDelta: 0.005 }
      setRegion(r)
      setMarker({ latitude: initialLat, longitude: initialLng })
      return
    }
    goToMyLocation()
  }, [visible])

  const goToMyLocation = async () => {
    setLocLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const r = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
      setRegion(r)
      mapRef.current?.animateToRegion(r, 600)
    } catch {}
    finally { setLocLoading(false) }
  }

  const handleMapPress = (e: MapPressEvent) => {
    setMarker(e.nativeEvent.coordinate)
  }

  const handleConfirm = () => {
    if (!marker) {
      Alert.alert('No location selected', 'Tap on the map to pin your shop location.')
      return
    }
    onConfirm(marker.latitude, marker.longitude)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="arrow-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pin Shop Location</Text>
          <View style={{ width: 36 }} />
        </View>

        <Text style={styles.hint}>Tap on the map to place a pin on your shop</Text>

        {/* Map */}
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            initialRegion={region}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {marker && (
              <Marker
                coordinate={marker}
                draggable
                onDragEnd={(e) => setMarker(e.nativeEvent.coordinate)}
                pinColor={ORANGE}
                title="Your Shop"
              />
            )}
          </MapView>

          {/* My location button */}
          <TouchableOpacity style={styles.myLocBtn} onPress={goToMyLocation} disabled={locLoading}>
            {locLoading
              ? <ActivityIndicator color={ORANGE} size="small" />
              : <Ionicons name="locate" size={22} color={ORANGE} />
            }
          </TouchableOpacity>
        </View>

        {/* Bottom bar */}
        <View style={styles.bottom}>
          {marker ? (
            <Text style={styles.coordText}>
              {marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.noPin}>No pin placed yet</Text>
          )}
          <TouchableOpacity
            style={[styles.confirmBtn, !marker && { opacity: 0.4 }]}
            onPress={handleConfirm}
            disabled={!marker}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.confirmText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>

      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#fff' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  closeBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  hint:        { textAlign: 'center', fontSize: 12, color: '#6b7280', paddingVertical: 8, backgroundColor: '#fffbeb' },
  myLocBtn:    { position: 'absolute', right: 12, bottom: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  bottom:      { padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 10 },
  coordText:   { textAlign: 'center', fontSize: 12, color: '#6b7280', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  noPin:       { textAlign: 'center', fontSize: 12, color: '#d1d5db' },
  confirmBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 15 },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
