/**
 * MapPickerModal (web)
 *
 * Full-screen overlay map with:
 *   1. Google Places Autocomplete search bar at the top
 *   2. "Use my current location" button
 *   3. Fixed-centre pin → reverse-geocoded automatically
 *   4. Confirm → calls onConfirm with structured address + lat/lng
 */

import { useEffect, useRef, useState } from 'react'
import { Navigation, X, CheckCircle, Loader2, Search, MapPin } from 'lucide-react'

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string

const DEFAULT_LAT = 12.9716
const DEFAULT_LNG = 77.5946

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

    const existing = document.querySelector('script[data-gmaps="customer"]')
    if (existing) {
      existing.addEventListener('load', () => {
        _mapsLoaded = true; _waiters.forEach((r) => r()); _waiters.length = 0
      })
      if ((window as any).google?.maps?.places) {
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

function injectPacStyle() {
  if (document.getElementById('pac-style')) return
  const style = document.createElement('style')
  style.id = 'pac-style'
  style.textContent = `.pac-container { z-index: 99999 !important; }`
  document.head.appendChild(style)
}

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

export interface MapPickResult {
  street: string; city: string; state: string; pincode: string; lat: number; lng: number
}

interface Props { open: boolean; onClose: () => void; onConfirm: (r: MapPickResult) => void }

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
  const [locating,    setLocating]    = useState(false)

  const doGeocode = async (lat: number, lng: number) => {
    setGeocoding(true)
    const result = await reverseGeocode(lat, lng)
    setGeocoding(false)
    setParsed(result)
  }

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

      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat: startLat, lng: startLng },
        zoom: 17,
        disableDefaultUI:  true,
        zoomControl:       false,
        mapTypeControl:    false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons:    false,
        gestureHandling:   'greedy',
      })
      mapRef.current = map

      let idleTimeout: ReturnType<typeof setTimeout> | null = null
      let userMoved = false

      map.addListener('dragstart', () => {
        if (idleTimeout) clearTimeout(idleTimeout)
        userMoved = true
        setDragging(true)
        setParsed(null)
      })
      map.addListener('zoom_changed', () => { userMoved = true })
      map.addListener('idle', () => {
        if (cancelled || !userMoved) return
        userMoved = false
        const c   = map.getCenter()
        const lat = c.lat() as number
        const lng = c.lng() as number
        setCenter({ lat, lng })
        setDragging(false)
        if (idleTimeout) clearTimeout(idleTimeout)
        idleTimeout = setTimeout(() => doGeocode(lat, lng), 400)
      })

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
          if (searchRef.current) searchRef.current.value = ''
        })
      }

      doGeocode(startLat, startLng)
    })()

    return () => { cancelled = true }
  }, [open])

  const goToMyLocation = () => {
    if (locating) return
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
        doGeocode(lat, lng)
      },
      () => { setLocating(false); setParsed(null) },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
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

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={20} />
          </button>
          <p className="text-base font-bold text-gray-900 flex-1">Set Delivery Location</p>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:border-red-400 focus-within:bg-white transition-all">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search area, street or landmark…"
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
          />
        </div>
      </div>

      {/* ── Map area ────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">

        {mapsLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50 gap-3">
            <Loader2 size={36} className="text-red-500 animate-spin" />
            <p className="text-sm text-gray-500 font-medium">Loading map…</p>
          </div>
        )}

        <div ref={mapDivRef} className="w-full h-full" />

        {/* Fixed centre pin */}
        <div
          className="absolute pointer-events-none flex flex-col items-center"
          style={{
            left: '50%',
            top:  '50%',
            transform: `translate(-50%, calc(-100% + ${dragging ? '-12px' : '0px'}))`,
            transition: 'transform 0.18s ease',
          }}
        >
          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
            <MapPin size={20} className="text-white" fill="white" />
          </div>
          <div className="w-0.5 h-4 bg-red-500" />
          <div className="w-2 h-1 bg-red-300 rounded-full opacity-50" />
        </div>

        {/* Shadow under pin */}
        <div
          className="absolute pointer-events-none rounded-full bg-black/20 blur-sm"
          style={{
            width: 16, height: 6,
            left: 'calc(50% - 8px)', top: '50%',
            transform: dragging ? 'scaleX(1.8)' : 'scaleX(1)',
            opacity: dragging ? 0.2 : 0.35,
            transition: 'transform 0.18s ease, opacity 0.18s ease',
          }}
        />

        {/* Zoom controls */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 pointer-events-auto">
          <button
            onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() || 17) + 1)}
            className="w-9 h-9 bg-white shadow-md rounded-lg flex items-center justify-center text-gray-700 font-bold text-lg hover:bg-gray-50"
          >+</button>
          <button
            onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() || 17) - 1)}
            className="w-9 h-9 bg-white shadow-md rounded-lg flex items-center justify-center text-gray-700 font-bold text-lg hover:bg-gray-50"
          >−</button>
        </div>

        {/* GPS button on map */}
        <button
          onClick={goToMyLocation}
          disabled={locating}
          className="absolute left-3 bottom-4 bg-white shadow-lg rounded-xl px-3 py-2 flex items-center gap-2 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors pointer-events-auto disabled:opacity-60"
        >
          {locating
            ? <Loader2 size={15} className="animate-spin" />
            : <Navigation size={15} />}
          {locating ? 'Locating…' : 'My Location'}
        </button>
      </div>

      {/* ── Bottom sheet ────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white px-5 pt-4 pb-5 shadow-[0_-8px_30px_rgba(0,0,0,0.10)]">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 border-2 border-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <MapPin size={16} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium mb-0.5 uppercase tracking-wide">Delivering to</p>
            {(dragging || geocoding) ? (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-gray-400" />
                <span className="text-sm text-gray-400">Finding address…</span>
              </div>
            ) : parsed ? (
              <>
                <p className="text-base font-bold text-gray-900 leading-snug">{parsed.street}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {[parsed.city, parsed.state, parsed.pincode].filter(Boolean).join(', ')}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">Move the map to set your location</p>
            )}
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!parsed || geocoding || dragging}
          className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors text-base"
        >
          <CheckCircle size={20} />
          Confirm this Location
        </button>
      </div>
    </div>
  )
}
