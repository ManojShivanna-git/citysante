/**
 * MapPickerModal (web)
 *
 * Full-screen overlay map with:
 *   1. Google Places Autocomplete search bar at the top
 *   2. "Use my current location" button
 *   3. Draggable fixed-centre pin → reverse-geocoded automatically
 *   4. Confirm → calls onConfirm with structured address + lat/lng
 *
 * Loads Google Maps JS API with &libraries=places (singleton, one <script> tag).
 * Requires VITE_GOOGLE_MAPS_KEY in web/customer/.env
 */

import { useEffect, useRef, useState } from 'react'
import { Navigation, X, CheckCircle, Loader2, Locate, Search } from 'lucide-react'

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string

const DEFAULT_LAT = 12.9716
const DEFAULT_LNG = 77.5946

// ── Singleton Maps JS API loader (with Places library) ───────────────────────
declare const google: any

let _mapsLoaded  = false
let _mapsLoading = false
const _waiters: Array<() => void> = []

function loadMapsScript(): Promise<void> {
  return new Promise((resolve) => {
    if (_mapsLoaded) { resolve(); return }
    _waiters.push(resolve)
    if (_mapsLoading) return
    _mapsLoading = true

    // Re-use a script already in DOM (admin panel may have loaded it without places)
    // but we always inject our own with &libraries=places so we get Autocomplete
    const existing = document.querySelector('script[data-gmaps="customer"]')
    if (existing) {
      existing.addEventListener('load', () => {
        _mapsLoaded = true; _waiters.forEach((r) => r()); _waiters.length = 0
      })
      if ((window as any).google?.maps?.places) {
        // Already fully loaded
        _mapsLoaded = true; _waiters.forEach((r) => r()); _waiters.length = 0
      }
      return
    }

    const script = document.createElement('script')
    script.setAttribute('data-gmaps', 'customer')
    script.src   = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places`
    script.async = true
    script.onload = () => {
      _mapsLoaded = true; _waiters.forEach((r) => r()); _waiters.length = 0
    }
    script.onerror = () => { _mapsLoading = false; _waiters.length = 0 }
    document.head.appendChild(script)
  })
}

// Inject a global style once to push the pac-container above the modal overlay
function injectPacStyle() {
  if (document.getElementById('pac-style')) return
  const style = document.createElement('style')
  style.id = 'pac-style'
  style.textContent = `.pac-container { z-index: 99999 !important; }`
  document.head.appendChild(style)
}

// ── REST reverse-geocode ──────────────────────────────────────────────────────
interface ParsedAddress { street: string; city: string; state: string; pincode: string }

function parseComponents(components: any[]): ParsedAddress {
  const get = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name ?? ''
  const street = [get('street_number'), get('route'), get('sublocality_level_1') || get('sublocality') || get('neighborhood')]
    .filter(Boolean).join(', ') || get('premise') || 'Unnamed location'
  return {
    street,
    city:    get('locality') || get('administrative_area_level_2'),
    state:   get('administrative_area_level_1'),
    pincode: get('postal_code'),
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<ParsedAddress | null> {
  try {
    const url  = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAPS_KEY}`
    const json = await (await fetch(url)).json()
    if (json.status !== 'OK' || !json.results?.length) return null
    return parseComponents(json.results[0].address_components)
  } catch { return null }
}

// ── Public types ──────────────────────────────────────────────────────────────
export interface MapPickResult {
  street: string; city: string; state: string; pincode: string; lat: number; lng: number
}

interface Props { open: boolean; onClose: () => void; onConfirm: (r: MapPickResult) => void }

// ── Component ─────────────────────────────────────────────────────────────────
export default function MapPickerModal({ open, onClose, onConfirm }: Props) {
  const mapDivRef    = useRef<HTMLDivElement>(null)
  const searchRef    = useRef<HTMLInputElement>(null)
  const mapRef       = useRef<any>(null)
  const autocomplRef = useRef<any>(null)

  const [mapsLoading, setMapsLoading] = useState(true)
  const [dragging,    setDragging]    = useState(false)
  const [geocoding,   setGeocoding]   = useState(false)
  const [parsed,      setParsed]      = useState<ParsedAddress | null>(null)
  const [center,      setCenter]      = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG })
  const [locating,    setLocating]    = useState(false)   // GPS in-progress flag

  const doGeocode = async (lat: number, lng: number) => {
    setGeocoding(true)
    const result = await reverseGeocode(lat, lng)
    setGeocoding(false)
    setParsed(result)
  }

  // ── Init map when modal opens ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      mapRef.current      = null
      autocomplRef.current = null
      setMapsLoading(true)
      setParsed(null)
      setDragging(false)
      return
    }

    let cancelled = false
    injectPacStyle()

    ;(async () => {
      await loadMapsScript()
      if (cancelled || !mapDivRef.current) return

      // Get device location (3 s timeout)
      let startLat = DEFAULT_LAT, startLng = DEFAULT_LNG
      try {
        await new Promise<void>((res) =>
          navigator.geolocation.getCurrentPosition(
            (p) => { startLat = p.coords.latitude; startLng = p.coords.longitude; res() },
            () => res(), { timeout: 3000 }
          )
        )
      } catch {}
      if (cancelled) return

      setCenter({ lat: startLat, lng: startLng })
      setMapsLoading(false)

      // Build map
      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat: startLat, lng: startLng },
        zoom: 17,
        disableDefaultUI:  true,
        zoomControl:       true,
        mapTypeControl:    false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons:    false,
      })
      mapRef.current = map

      let idleTimeout: ReturnType<typeof setTimeout> | null = null

      map.addListener('dragstart', () => {
        if (idleTimeout) clearTimeout(idleTimeout)
        setDragging(true)
        setParsed(null)
      })
      map.addListener('idle', () => {
        if (cancelled) return
        const c   = map.getCenter()
        const lat = c.lat() as number
        const lng = c.lng() as number
        setCenter({ lat, lng })
        setDragging(false)
        if (idleTimeout) clearTimeout(idleTimeout)
        idleTimeout = setTimeout(() => doGeocode(lat, lng), 250)
      })

      // Attach Places Autocomplete to the search input
      if (searchRef.current && google.maps.places) {
        const autocomplete = new google.maps.places.Autocomplete(searchRef.current, {
          componentRestrictions: { country: 'in' },
          fields: ['geometry', 'address_components', 'formatted_address'],
        })
        autocomplRef.current = autocomplete
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          if (!place.geometry?.location) return
          const lat = place.geometry.location.lat() as number
          const lng = place.geometry.location.lng() as number
          map.panTo({ lat, lng })
          map.setZoom(17)
          setCenter({ lat, lng })
          if (place.address_components) {
            setParsed(parseComponents(place.address_components))
          } else {
            doGeocode(lat, lng)
          }
          // Clear search input after selection so it shows picked address in bottom sheet
          if (searchRef.current) searchRef.current.value = ''
        })
      }

      doGeocode(startLat, startLng)
    })()

    return () => { cancelled = true }
  }, [open])

  // ── Go to my location ─────────────────────────────────────────────────────
  const goToMyLocation = () => {
    if (locating) return                    // ignore repeated taps while in-flight
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCenter({ lat, lng })
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng })
          mapRef.current.setZoom(17)
        }
        // Always reverse-geocode the new spot so parsed/confirm update immediately
        doGeocode(lat, lng)
      },
      (_err) => {
        // Permission denied, position unavailable, or timed out
        setLocating(false)
        setParsed(null)     // clear stale address so bottom sheet shows the hint text
      },
      {
        enableHighAccuracy: false,  // faster battery-friendly fix
        timeout: 8000,              // fail after 8 s instead of hanging forever
        maximumAge: 30000,          // accept a cached fix up to 30 s old (instant)
      }
    )
  }

  const handleConfirm = () => {
    if (!parsed) return
    onConfirm({
      street:  parsed.street,
      city:    parsed.city    || 'Unknown City',
      state:   parsed.state   || 'Karnataka',
      pincode: parsed.pincode || '000000',
      lat:     center.lat,
      lng:     center.lng,
    })
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0 bg-white">
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <X size={20} className="text-gray-600" />
        </button>
        <h2 className="font-semibold text-gray-900">Pick Delivery Location</h2>
      </div>

      {/* ── Search bar ──────────────────────────────────────────── */}
      <div className="px-3 py-2 bg-white border-b border-gray-100 shrink-0 space-y-2">
        {/* Search input — google.maps.places.Autocomplete binds to this */}
        <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-sm">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search area, street or landmark…"
            className="flex-1 text-sm outline-none placeholder:text-gray-400 bg-transparent"
          />
        </div>
        {/* Use current location */}
        <button
          onClick={goToMyLocation}
          disabled={locating}
          className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700
                     px-1 py-0.5 disabled:opacity-60 disabled:cursor-default transition-opacity"
        >
          {locating
            ? <Loader2 size={15} className="shrink-0 animate-spin" />
            : <Locate  size={15} className="shrink-0" />}
          {locating ? 'Getting your location…' : 'Use my current location'}
        </button>
      </div>

      {/* ── Map area ────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">

        {mapsLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50 gap-3">
            <Loader2 size={36} className="text-brand-600 animate-spin" />
            <p className="text-sm text-gray-500">Loading map…</p>
          </div>
        )}

        <div ref={mapDivRef} className="w-full h-full" />

        {/* Fixed centre pin — balloon style */}
        <div
          className="absolute pointer-events-none flex flex-col items-center"
          style={{
            left: '50%',
            top:  '50%',
            /* shift up so the tip of the triangle touches the exact centre */
            transform: `translate(-50%, calc(-100% + ${dragging ? '-14px' : '0px'}))`,
            transition: 'transform 0.18s ease',
          }}>
          {/* Balloon circle */}
          <div style={{
            width: 54, height: 54, borderRadius: '50%',
            backgroundColor: '#dc2626',
            border: '3px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(220,38,38,0.45)',
          }}>
            {/* Home icon as SVG to avoid adding a lucide dependency inline */}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
              <path d="M3 12L12 3l9 9" strokeWidth="0" />
              <path fillRule="evenodd" clipRule="evenodd"
                d="M12 2.29L1.29 12.71A1 1 0 002 14h1v7a1 1 0 001 1h5v-5h6v5h5a1 1 0 001-1v-7h1a1 1 0 00.71-1.71L12 2.29zM12 4.83l8 8V20h-3v-5a1 1 0 00-1-1H8a1 1 0 00-1 1v5H4v-7.17l8-8z"/>
            </svg>
          </div>
          {/* Triangle tip */}
          <div style={{
            width: 0, height: 0,
            borderLeft: '11px solid transparent',
            borderRight: '11px solid transparent',
            borderTop: '20px solid #dc2626',
            marginTop: -3,
          }} />
        </div>
        {/* Ground shadow */}
        <div
          className="absolute pointer-events-none rounded-full bg-black/20 blur-sm"
          style={{
            width: 18, height: 7,
            left: 'calc(50% - 9px)', top: '50%',
            transform: dragging ? 'scaleX(1.6)' : 'scaleX(1)',
            opacity: dragging ? 0.25 : 0.4,
            transition: 'transform 0.18s ease, opacity 0.18s ease',
          }} />
      </div>

      {/* ── Bottom address sheet ─────────────────────────────────── */}
      <div className="shrink-0 bg-white border-t border-gray-100 px-4 pt-4 pb-6 space-y-3
                      shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="flex items-start gap-3 min-h-[52px]">
          <Navigation size={18} className="text-brand-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            {(dragging || geocoding) ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" /> Finding address…
              </div>
            ) : parsed ? (
              <>
                <p className="font-semibold text-gray-900 text-sm leading-snug">{parsed.street}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {[parsed.city, parsed.state, parsed.pincode].filter(Boolean).join(', ')}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">Search or drag the map to detect your address</p>
            )}
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!parsed || geocoding || dragging}
          className="btn-primary w-full justify-center gap-2 py-3
                     disabled:opacity-40 disabled:cursor-not-allowed">
          <CheckCircle size={18} />
          Confirm this Location
        </button>
      </div>
    </div>
  )
}
