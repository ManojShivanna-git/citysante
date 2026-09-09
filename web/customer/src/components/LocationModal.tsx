import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, X, Navigation, MapPin, ChevronLeft, Check } from 'lucide-react'
import { useLocationStore } from '../store/locationStore'

interface Props { onClose: () => void }

declare global {
  interface Window { google: any; initGooglePlaces: () => void }
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

type Step = 'search' | 'map'

// Reverse geocode lat/lng to readable address
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}`)
    const data = await res.json()
    if (data.results?.[0]) {
      const comps = data.results[0].address_components as any[]
      const sub   = comps.find((c: any) => c.types.includes('sublocality_level_1'))?.long_name
      const city  = comps.find((c: any) => c.types.includes('locality'))?.long_name
      if (sub && city) return `${sub}, ${city}`
      return data.results[0].formatted_address.split(',').slice(0, 2).join(',')
    }
  } catch {}
  return 'Selected Location'
}

export default function LocationModal({ onClose }: Props) {
  const { detect, setLocation, loading, lat: storeLat, lng: storeLng } = useLocationStore()

  const [step, setStep]           = useState<Step>('search')
  const [pickedLat, setPickedLat] = useState(storeLat)
  const [pickedLng, setPickedLng] = useState(storeLng)
  const [pickedAddr, setPickedAddr] = useState('')
  const [confirming, setConfirming] = useState(false)

  const inputRef  = useRef<HTMLInputElement>(null)
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObj    = useRef<any>(null)
  const markerObj = useRef<any>(null)
  const acRef     = useRef<any>(null)

  // ── Load Google Maps script ──────────────────────────────────────────────
  const [mapsReady, setMapsReady] = useState(!!window.google?.maps?.places)

  useEffect(() => {
    if (window.google?.maps?.places) { setMapsReady(true); return }
    window.initGooglePlaces = () => setMapsReady(true)
    if (!document.getElementById('google-places-script')) {
      const s  = document.createElement('script')
      s.id     = 'google-places-script'
      s.src    = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&callback=initGooglePlaces`
      s.async  = true
      document.head.appendChild(s)
    } else {
      const t = setInterval(() => { if (window.google?.maps?.places) { setMapsReady(true); clearInterval(t) } }, 200)
    }
  }, [])

  // ── Attach Places Autocomplete ───────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !inputRef.current) return
    acRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'in' },
      fields: ['geometry', 'formatted_address', 'name'],
    })
    acRef.current.addListener('place_changed', () => {
      const place = acRef.current.getPlace()
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat()
        const lng = place.geometry.location.lng()
        setPickedLat(lat)
        setPickedLng(lng)
        setPickedAddr(place.formatted_address || place.name || 'Selected Location')
        setStep('map')
      }
    })
  }, [mapsReady])

  // ── Init map when step = 'map' ───────────────────────────────────────────
  useEffect(() => {
    if (step !== 'map' || !mapRef.current || !mapsReady) return

    const map = new window.google.maps.Map(mapRef.current, {
      center:            { lat: pickedLat, lng: pickedLng },
      zoom:              17,
      disableDefaultUI:  true,
      zoomControl:       true,
      gestureHandling:   'greedy',
    })
    mapObj.current = map

    const marker = new window.google.maps.Marker({
      position:  { lat: pickedLat, lng: pickedLng },
      map,
      draggable: true,
      icon: {
        url:        'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
        scaledSize: new window.google.maps.Size(48, 48),
        anchor:     new window.google.maps.Point(24, 48),
      },
    })
    markerObj.current = marker

    // Update address when marker dragged
    marker.addListener('dragend', async () => {
      const pos  = marker.getPosition()
      const lat  = pos.lat()
      const lng  = pos.lng()
      setPickedLat(lat)
      setPickedLng(lng)
      const addr = await reverseGeocode(lat, lng)
      setPickedAddr(addr)
    })

    // Also update on map click
    map.addListener('click', async (e: any) => {
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()
      marker.setPosition({ lat, lng })
      setPickedLat(lat)
      setPickedLng(lng)
      const addr = await reverseGeocode(lat, lng)
      setPickedAddr(addr)
    })

    // Initial reverse geocode if no address yet
    if (!pickedAddr) reverseGeocode(pickedLat, pickedLng).then(setPickedAddr)
  }, [step, mapsReady])

  // ── Detect GPS location ──────────────────────────────────────────────────
  const handleDetect = async () => {
    await detect()
    // After detect, move to map step with detected coords
    const { lat, lng } = useLocationStore.getState()
    setPickedLat(lat)
    setPickedLng(lng)
    const addr = await reverseGeocode(lat, lng)
    setPickedAddr(addr)
    setStep('map')
  }

  // ── Confirm location ─────────────────────────────────────────────────────
  const handleConfirm = async () => {
    setConfirming(true)
    const addr = pickedAddr || await reverseGeocode(pickedLat, pickedLng)
    setLocation(pickedLat, pickedLng, addr)
    onClose()
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl overflow-hidden"
           style={{ height: step === 'map' ? '90vh' : 'auto', maxHeight: '90vh' }}>

        {/* ── STEP 1: SEARCH ── */}
        {step === 'search' && (
          <>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-lg font-bold text-gray-900">Your Location</h2>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:border-red-400 focus-within:bg-white transition-colors">
                <Search size={16} className="text-gray-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search area, street, locality…"
                  autoFocus
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleDetect}
              disabled={loading}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-red-50 transition-colors border-t border-gray-100"
            >
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Navigation size={15} className="text-red-500" />
              </div>
              <span className="text-sm font-semibold text-red-500">
                {loading ? 'Detecting…' : 'Use My Current Location'}
              </span>
            </button>

            <div className="flex flex-col items-center justify-center py-12 bg-gray-50 border-t border-gray-100">
              <div className="text-6xl mb-3">📍</div>
              <p className="text-sm text-gray-400">Search or use your current location</p>
            </div>
          </>
        )}

        {/* ── STEP 2: MAP ── */}
        {step === 'map' && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
              <button onClick={() => setStep('search')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-base font-bold text-gray-900">Set Delivery Location</h2>
              <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>

            {/* Map */}
            <div ref={mapRef} className="flex-1 w-full" />

            {/* Bottom sheet */}
            <div className="shrink-0 bg-white px-5 py-4 border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={15} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-0.5">Delivering to</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {pickedAddr || 'Locating…'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Drag the pin to adjust exact location</p>
                </div>
              </div>

              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Check size={18} />
                {confirming ? 'Saving…' : 'Confirm Location'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
