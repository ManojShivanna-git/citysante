import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { adminApi } from '../../services/api'
import type { Zone } from '../../types'

declare global { interface Window { google: any } }

// Default map center — Bangalore (matches seed data city)
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }
const BRAND_COLOR = '#f97316'

interface Props {
  zone: Zone
  onClose: () => void
  onSaved: () => void
}

export default function ZoneMapModal({ zone, onClose, onSaved }: Props) {
  const mapRef         = useRef<HTMLDivElement>(null)
  const mapInstance    = useRef<any>(null)
  const drawingManager = useRef<any>(null)
  const activePolygon  = useRef<any>(null)

  useEffect(() => {
    const google = window.google
    if (!google || !mapRef.current) return

    // Capture container element NOW (synchronously) before any async work.
    // React will null-out mapRef.current on unmount but Google Maps keeps its
    // own internal reference — we only need the element for initial setup.
    const container = mapRef.current

    // ── Initialise map ──────────────────────────────────────────────────────
    const map = new google.maps.Map(container, {
      center:            DEFAULT_CENTER,
      zoom:              12,
      mapTypeId:         google.maps.MapTypeId.ROADMAP,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl:    false,
    })
    mapInstance.current = map

    // ── Restore existing boundary, if any ──────────────────────────────────
    if (zone.boundary) {
      try {
        const points = JSON.parse(zone.boundary) as { lat: number; lng: number }[]
        if (Array.isArray(points) && points.length > 0) {
          const polygon = new google.maps.Polygon({
            paths:         points,
            strokeColor:   BRAND_COLOR,
            strokeOpacity: 0.9,
            strokeWeight:  2.5,
            fillColor:     BRAND_COLOR,
            fillOpacity:   0.18,
            editable:      true,
            clickable:     true,
          })
          polygon.setMap(map)
          activePolygon.current = polygon

          const bounds = new google.maps.LatLngBounds()
          points.forEach((p) => bounds.extend(p))
          map.fitBounds(bounds, 40)
        }
      } catch {
        // malformed/legacy boundary value — ignore, start fresh
      }
    }

    // ── Drawing Manager — polygon tool only ────────────────────────────────
    const dm = new google.maps.drawing.DrawingManager({
      drawingMode: activePolygon.current
        ? null
        : google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position:     google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [google.maps.drawing.OverlayType.POLYGON],
      },
      polygonOptions: {
        strokeColor:   BRAND_COLOR,
        strokeOpacity: 0.9,
        strokeWeight:  2.5,
        fillColor:     BRAND_COLOR,
        fillOpacity:   0.18,
        editable:      true,
        clickable:     true,
      },
    })
    dm.setMap(map)
    drawingManager.current = dm

    // When a polygon is drawn: remove any previous one, store the new one,
    // and switch back to pointer/pan mode automatically.
    google.maps.event.addListener(dm, 'polygoncomplete', (polygon: any) => {
      if (activePolygon.current) activePolygon.current.setMap(null)
      activePolygon.current = polygon
      dm.setDrawingMode(null)
    })

    return () => {
      // Remove all Google Maps event listeners so the internal
      // IntersectionObserver doesn't fire on an unmounted element.
      google.maps.event.clearInstanceListeners(map)
      if (drawingManager.current) {
        google.maps.event.clearInstanceListeners(drawingManager.current)
        drawingManager.current = null
      }
      if (activePolygon.current) { activePolygon.current.setMap(null); activePolygon.current = null }
      // Clear the container's DOM so Maps releases its internal observers
      if (container) container.innerHTML = ''
      mapInstance.current = null
    }
  }, [zone.id, zone.boundary])

  const handleSave = async () => {
    if (!activePolygon.current) {
      toast.error('Draw a zone boundary on the map first')
      return
    }
    const path   = activePolygon.current.getPath()
    const points = path.getArray().map((ll: any) => ({ lat: ll.lat(), lng: ll.lng() }))

    try {
      await adminApi.updateZoneBoundary(zone.id, points)
      toast.success('Zone boundary saved')
      onSaved()
      onClose()
    } catch {
      // global axios interceptor already shows the error toast
    }
  }

  const handleClear = () => {
    if (activePolygon.current) {
      activePolygon.current.setMap(null)
      activePolygon.current = null
    }
    // Return drawing manager to polygon-draw mode
    if (drawingManager.current) {
      drawingManager.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-3xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-lg">Draw Boundary — {zone.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Use the polygon tool (top of map) to outline this zone. Click each corner, then close the shape.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div ref={mapRef} className="w-full h-[420px] rounded-xl overflow-hidden border border-gray-200" />

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={handleClear} className="btn-secondary">Clear</button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleSave} className="btn-primary">Save Boundary</button>
        </div>
      </div>
    </div>
  )
}
