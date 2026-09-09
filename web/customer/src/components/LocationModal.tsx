import { useEffect, useRef, useState } from 'react'
import { Search, X, Navigation, MapPin, ChevronLeft, Check, Loader2 } from 'lucide-react'
import { useLocationStore } from '../store/locationStore'

interface Props { onClose: () => void }

declare global {
  interface Window { google: any; initGooglePlaces: () => void }
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

type Step = 'search' | 'map'

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}`)
    const data = await res.json()
    if (data.results?.[0]) {
      const comps = data.results[0].address_components as any[]
      const sub   = comps.find((c: any) => c.types.includes('sublocality_level_1'))?.long_name
      const city  = comps.find((c: any) => c.types.includes('locality'))?.long_name
      if (sub && city) return `${sub}, ${city}`
      return data.results[0].formatted_address.split(',').slice(0, 3).join(',').trim()
    }
  } catch {}
  return 'Selected Location'
}

export default function LocationModal({ onClose }: Props) {
  const { detect, setLocation, loading, lat: storeLat, lng: storeLng } = useLocationStore()

  const [step, setStep]               = useState<Step>('search')
  const [centerLat, setCenterLat]     = useState(storeLat)
  const [centerLng, setCenterLng]     = useState(storeLng)
  const [address, setAddress]         = useState('')
  const [geocoding, setGeocoding]     = useState(false)
  const [confirming, setConfirming]   = useState(false)
  const [mapsReady, setMapsReady]     = useState(!!window.google?.maps?.places)

  const inputRef     = useRef<HTMLInputElement>(null)
  const mapInputRef  = useRef<HTMLInputElement>(null)
  const mapRef       = useRef<HTMLDivElement>(null)
  const mapObj       = useRef<any>(null)
  const geocodeTimer = useRef<any>(null)

  // ── Load Google Maps ─────────────────────────────────────────────────────
  useEffect(() => {
    if (window.google?.maps?.places) { setMapsReady(true); return }
    window.initGooglePlaces = () => setMapsReady(true)
    if (!document.getElementById('google-places-script')) {
      const s = document.createElement('script')
      s.id    = 'google-places-script'
      s.src   = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&callback=initGooglePlaces`
      s.async = true
      document.head.appendChild(s)
    } else {
      const t = setInterval(() => { if (window.google?.maps?.places) { setMapsReady(true); clearInterval(t) } }, 200)
    }
  }, [])

  // ── Autocomplete ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !inputRef.current) return
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'in' },
      fields: ['geometry', 'formatted_address'],
    })
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (place.geometry?.location) {
        setCenterLat(place.geometry.location.lat())
        setCenterLng(place.geometry.location.lng())
        setAddress(place.formatted_address || '')
        setStep('map')
      }
    })
  }, [mapsReady])

  // ── Map search bar autocomplete ──────────────────────────────────────────
  useEffect(() => {
    if (step !== 'map' || !mapsReady || !mapInputRef.current) return
    const ac = new window.google.maps.places.Autocomplete(mapInputRef.current, {
      componentRestrictions: { country: 'in' },
      fields: ['geometry', 'formatted_address'],
    })
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (place.geometry?.location && mapObj.current) {
        const lat = place.geometry.location.lat()
        const lng = place.geometry.location.lng()
        mapObj.current.panTo({ lat, lng })
        mapObj.current.setZoom(17)
        setCenterLat(lat)
        setCenterLng(lng)
        setAddress(place.formatted_address || '')
        if (mapInputRef.current) mapInputRef.current.value = ''
        if (mapInputRef.current) mapInputRef.current.blur()
      }
    })
  }, [step, mapsReady])

  // ── Build map when step=map ───────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'map' || !mapRef.current || !mapsReady) return

    const map = new window.google.maps.Map(mapRef.current, {
      center:           { lat: centerLat, lng: centerLng },
      zoom:             17,
      disableDefaultUI: true,
      zoomControl:      false,
      gestureHandling:  'greedy',
      clickableIcons:   false,
    })
    mapObj.current = map

    // Only geocode after user actually moves the map
    let userMoved = false

    map.addListener('dragstart', () => { userMoved = true })
    map.addListener('zoom_changed', () => { userMoved = true })

    map.addListener('idle', () => {
      if (!userMoved) return
      userMoved = false

      const c   = map.getCenter()
      const lat = c.lat()
      const lng = c.lng()
      setCenterLat(lat)
      setCenterLng(lng)

      clearTimeout(geocodeTimer.current)
      setGeocoding(true)
      geocodeTimer.current = setTimeout(async () => {
        const addr = await reverseGeocode(lat, lng)
        setAddress(addr)
        setGeocoding(false)
      }, 600)
    })

    // Initial address — one call only
    if (!address) {
      setGeocoding(true)
      reverseGeocode(centerLat, centerLng).then(addr => {
        setAddress(addr)
        setGeocoding(false)
      })
    }
  }, [step, mapsReady])

  // ── GPS detect → go to map ────────────────────────────────────────────────
  const handleDetect = async () => {
    await detect()
    const { lat, lng } = useLocationStore.getState()
    setCenterLat(lat)
    setCenterLng(lng)
    setAddress('')
    setStep('map')
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    setConfirming(true)
    const addr = address || await reverseGeocode(centerLat, centerLng)
    setLocation(centerLat, centerLng, addr)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center">
      {/* Overlay (desktop only) */}
      <div className="absolute inset-0 bg-black/60 hidden sm:block" onClick={onClose} />

      {/* Modal container */}
      <div className="relative bg-white w-full h-full sm:h-[85vh] sm:max-w-lg sm:rounded-2xl sm:overflow-hidden flex flex-col shadow-2xl">

        {/* ══ STEP 1: SEARCH ══════════════════════════════════════════════ */}
        {step === 'search' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-6 pb-2 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Set Delivery Location</h2>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 pt-2 pb-4 shrink-0">
              <div className="flex items-center gap-3 border-2 border-gray-200 rounded-2xl px-4 py-3 bg-gray-50 focus-within:border-red-400 focus-within:bg-white transition-all">
                <Search size={18} className="text-gray-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search area, street, locality…"
                  autoFocus
                  className="flex-1 bg-transparent text-base text-gray-800 placeholder-gray-400 outline-none"
                />
              </div>
            </div>

            {/* GPS button */}
            <button
              onClick={handleDetect}
              disabled={loading}
              className="mx-5 flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-red-200 hover:border-red-400 hover:bg-red-50 transition-all group"
            >
              <div className="w-11 h-11 rounded-full bg-red-100 group-hover:bg-red-200 flex items-center justify-center shrink-0 transition-colors">
                <Navigation size={20} className="text-red-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-red-500">
                  {loading ? 'Detecting your location…' : 'Use My Current Location'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Auto-detect via GPS</p>
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 px-5 mt-6 mb-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">OR SEARCH BELOW</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Illustration */}
            <div className="flex-1 flex flex-col items-center justify-center pb-12">
              <div className="text-8xl mb-4">🗺️</div>
              <p className="text-base font-semibold text-gray-500">Where should we deliver?</p>
              <p className="text-sm text-gray-400 mt-1">Search your area above</p>
            </div>
          </>
        )}

        {/* ══ STEP 2: MAP ═════════════════════════════════════════════════ */}
        {step === 'map' && (
          <>
            {/* Header */}
            <div className="shrink-0 bg-white border-b border-gray-100 z-10 px-4 pt-3 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setStep('search')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-600">
                  <ChevronLeft size={22} />
                </button>
                <p className="text-base font-bold text-gray-900 flex-1">Set Delivery Location</p>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                  <X size={18} />
                </button>
              </div>
              {/* Search on map */}
              <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus-within:border-red-400 focus-within:bg-white transition-all">
                <Search size={15} className="text-gray-400 shrink-0" />
                <input
                  ref={mapInputRef}
                  type="text"
                  placeholder="Search landmark, area, street…"
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                />
              </div>
            </div>

            {/* Map + center pin */}
            <div className="flex-1 relative">
              <div ref={mapRef} className="absolute inset-0" />

              {/* Fixed center pin */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: 60 }}>
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                    <MapPin size={18} className="text-white" fill="white" />
                  </div>
                  {/* Pin stem */}
                  <div className="w-0.5 h-4 bg-red-500" />
                  <div className="w-2 h-1 bg-red-300 rounded-full opacity-50" />
                </div>
              </div>

              {/* Zoom controls */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 pointer-events-auto">
                <button
                  onClick={() => mapObj.current?.setZoom((mapObj.current.getZoom() || 17) + 1)}
                  className="w-9 h-9 bg-white shadow-md rounded-lg flex items-center justify-center text-gray-700 font-bold text-lg hover:bg-gray-50"
                >+</button>
                <button
                  onClick={() => mapObj.current?.setZoom((mapObj.current.getZoom() || 17) - 1)}
                  className="w-9 h-9 bg-white shadow-md rounded-lg flex items-center justify-center text-gray-700 font-bold text-lg hover:bg-gray-50"
                >−</button>
              </div>

              {/* GPS button on map */}
              <button
                onClick={handleDetect}
                className="absolute left-3 bottom-4 bg-white shadow-lg rounded-xl px-3 py-2 flex items-center gap-2 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors pointer-events-auto"
              >
                <Navigation size={15} />
                My Location
              </button>
            </div>

            {/* Bottom sheet */}
            <div className="shrink-0 bg-white px-5 pt-4 pb-5 shadow-[0_-8px_30px_rgba(0,0,0,0.10)]">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-50 border-2 border-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={16} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium mb-0.5 uppercase tracking-wide">Delivering to</p>
                  {geocoding ? (
                    <div className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-gray-400" />
                      <span className="text-sm text-gray-400">Finding address…</span>
                    </div>
                  ) : (
                    <p className="text-base font-bold text-gray-900 leading-snug">{address || 'Move map to set location'}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">📍 Move the map to adjust your exact location</p>
                </div>
              </div>

              <button
                onClick={handleConfirm}
                disabled={confirming || geocoding || !address}
                className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors text-base"
              >
                <Check size={20} />
                {confirming ? 'Confirming…' : 'Confirm This Location'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
