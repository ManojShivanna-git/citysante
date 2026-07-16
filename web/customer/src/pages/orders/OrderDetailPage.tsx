import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { MapPin, Clock, Package, Star, CheckCircle2, Navigation, Phone } from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { orderApi } from '../../services/api'
import { SOCKET_URL } from '../../services/socketService'
import { useLocationStore } from '../../store/locationStore'
import type { Order } from '../../types'
import clsx from 'clsx'
import toast from 'react-hot-toast'

// ─── Live Rider Map (Leaflet via CDN) ────────────────────────────────────────

const LIVE_STATUSES = new Set(['assigned', 'picked_up', 'out_for_delivery'])

interface GpsPoint { lat: number; lng: number }

interface RiderMapProps {
  lat: number
  lng: number
  updated_at?: string     // undefined = waiting / placeholder mode
  waiting?: boolean
  path?: GpsPoint[]       // full breadcrumb trail of points so far
}

function RiderMap({ lat, lng, updated_at, waiting, path = [] }: RiderMapProps) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapObj      = useRef<any>(null)
  const markerRef   = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const startRef    = useRef<any>(null)    // circle at pick-up point

  // ── Inject Leaflet CSS once ──────────────────────────────────────────────
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
  }, [])

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = () => {
      if (!mapRef.current || mapObj.current) return
      const L = (window as any).L
      if (!L) return
      const m = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
        .setView([lat, lng], 15)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m)
      mapObj.current = m

      if (!waiting) {
        addRiderMarker(L, m, lat, lng)
      }
    }

    if ((window as any).L) { init(); return }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = init
    document.head.appendChild(script)
    return () => { /* shared script — don't remove */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Helper: create the moped marker ─────────────────────────────────────
  const addRiderMarker = (L: any, m: any, rlat: number, rlng: number) => {
    const icon = L.divIcon({
      html: `<div style="
        background:#dc2626;width:44px;height:44px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:22px;border:3px solid white;
        box-shadow:0 2px 14px rgba(0,0,0,.35);
        animation:markerPulse 1.4s ease infinite">🛵</div>`,
      className: '', iconAnchor: [22, 22],
    })
    markerRef.current = L.marker([rlat, rlng], { icon }).addTo(m)
  }

  // ── Move marker + update trail whenever lat/lng/path change ─────────────
  useEffect(() => {
    if (waiting || !mapObj.current) return
    const L = (window as any).L
    if (!L) return

    // Create or move the rider marker
    if (!markerRef.current) {
      addRiderMarker(L, mapObj.current, lat, lng)
    } else {
      markerRef.current.setLatLng([lat, lng])
    }

    // Draw / update GPS trail (breadcrumb polyline)
    if (path.length >= 2) {
      const latLngs = path.map((p) => [p.lat, p.lng])

      if (!polylineRef.current) {
        // Animated dashed trail in brand red
        polylineRef.current = L.polyline(latLngs, {
          color: '#dc2626', weight: 4, opacity: 0.75,
          dashArray: '10, 6', lineJoin: 'round',
        }).addTo(mapObj.current)

        // Small green circle at the route start (pickup point)
        if (path.length > 0) {
          startRef.current = L.circleMarker([path[0].lat, path[0].lng], {
            radius: 7, fillColor: '#16a34a', color: '#fff',
            weight: 2, fillOpacity: 1,
          }).addTo(mapObj.current).bindTooltip('Picked up here', { permanent: false })
        }
      } else {
        polylineRef.current.setLatLngs(latLngs)
      }
    }

    // Pan map to keep the rider in view (smooth)
    mapObj.current.panTo([lat, lng], { animate: true, duration: 0.8 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, path, waiting])

  const secs = updated_at ? Math.round((Date.now() - new Date(updated_at).getTime()) / 1000) : null
  const freshLabel = secs === null ? null
    : secs < 10  ? 'Just now'
    : secs < 60  ? `${secs}s ago`
    : `${Math.round(secs / 60)}m ago`

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 font-semibold text-sm">
          {waiting
            ? <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            : <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          }
          🛵 {waiting ? 'Assigning Rider…' : 'Live Rider Tracking'}
        </div>
        <div className="flex items-center gap-3">
          {!waiting && path.length > 1 && (
            <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100">
              {path.length} pts
            </span>
          )}
          {freshLabel && <span className="text-xs text-gray-400">{freshLabel}</span>}
        </div>
      </div>

      {/* Map container */}
      <div className="relative">
        {/* Inject CSS for marker pulse animation */}
        <style>{`
          @keyframes markerPulse {
            0%,100% { box-shadow:0 2px 14px rgba(220,38,38,.35); }
            50%      { box-shadow:0 2px 24px rgba(220,38,38,.65); }
          }
        `}</style>

        <div ref={mapRef} style={{ height: 300 }} />

        {/* Waiting overlay */}
        {waiting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/75 backdrop-blur-[2px] z-[9999] pointer-events-none">
            <div className="text-5xl mb-3 animate-bounce">🛵</div>
            <p className="text-sm font-bold text-gray-700">Rider being assigned…</p>
            <p className="text-xs text-gray-400 mt-1">Map will go live automatically</p>
          </div>
        )}

        {/* Legend — shown once we have a trail */}
        {!waiting && path.length > 1 && (
          <div className="absolute bottom-3 left-3 z-[9999] bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow text-xs flex flex-col gap-1 border border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0 border-t-2 border-dashed border-red-500 mt-px" />
              <span className="text-gray-600">Rider path</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-600 border-2 border-white shadow-sm" />
              <span className="text-gray-600">Pickup point</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-white shadow-sm" />
              <span className="text-gray-600">Current position</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {!waiting && (
        <a
          href={`https://maps.google.com/?q=${lat},${lng}`}
          target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-2 py-2.5 text-sm text-brand-600 font-medium hover:bg-brand-50 transition-colors border-t border-gray-100"
        >
          <Navigation size={14} /> Open in Google Maps
        </a>
      )}
    </div>
  )
}

// Reusable 1-5 star picker for shop / rider / per-product ratings.
function StarPicker({ value, onChange, size = 24 }: { value: number; onChange: (n: number) => void; size?: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="text-brand-500">
          <Star size={size} fill={n <= value ? 'currentColor' : 'none'} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  )
}

const STEPS = ['pending', 'confirmed', 'packed', 'assigned', 'picked_up', 'out_for_delivery', 'delivered']

const STEP_LABELS: Record<string, string> = {
  pending:          'Order Placed',
  confirmed:        'Confirmed by Shop',
  packed:           'Being Packed',
  assigned:         'Rider Assigned',
  picked_up:        'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
}

const STEP_ICONS: Record<string, string> = {
  pending:          '📋',
  confirmed:        '✅',
  packed:           '📦',
  assigned:         '🛵',
  picked_up:        '🛵',
  out_for_delivery: '🚀',
  delivered:        '🎉',
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder]     = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  // Customer's current location — used as map centre while waiting for rider GPS
  const { lat: customerLat, lng: customerLng } = useLocationStore()

  // Live rider location (current pin) + full GPS trail (breadcrumbs)
  const [riderLoc,  setRiderLoc]  = useState<{ lat: number; lng: number; updated_at: string } | null>(null)
  const [riderPath, setRiderPath] = useState<GpsPoint[]>([])
  const socketRef = useRef<Socket | null>(null)

  // Rating form state — shown once delivered, until the customer has rated.
  const [shopStars, setShopStars]     = useState(0)
  const [shopComment, setShopComment] = useState('')
  const [riderStars, setRiderStars]   = useState(0)
  const [productStars, setProductStars] = useState<Record<string, number>>({})
  const [submittingRating, setSubmittingRating] = useState(false)

  useEffect(() => {
    if (!id) return
    const fetch = () => {
      orderApi.getById(id)
        .then((res) => setOrder(res.data.data))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
    fetch()
    // Poll every 15s for status updates
    const interval = setInterval(fetch, 15000)
    return () => clearInterval(interval)
  }, [id])

  // Socket.IO — join order room when rider is active, disconnect otherwise
  useEffect(() => {
    if (!order || !id) return

    if (!LIVE_STATUSES.has(order.status)) {
      socketRef.current?.disconnect()
      socketRef.current = null
      setRiderLoc(null)
      setRiderPath([])
      return
    }

    // Fetch cached Redis location immediately so the map appears right away
    if (order.rider_id) {
      orderApi.getRiderLocation(order.rider_id)
        .then((res) => {
          if (res.data?.data) {
            const pt = res.data.data as { lat: number; lng: number; updated_at: string }
            setRiderLoc(pt)
            // Seed the trail with this first known point
            setRiderPath((prev) => prev.length === 0 ? [{ lat: pt.lat, lng: pt.lng }] : prev)
          }
        })
        .catch(() => {})
    }

    // Connect to backend Socket.IO (port 5000), NOT the Vite dev server
    if (socketRef.current) return
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => socket.emit('join_order', id))
    socket.on('location_update', (data: { lat: number; lng: number; updated_at: string }) => {
      setRiderLoc(data)
      // Append every GPS ping to the breadcrumb trail
      setRiderPath((prev) => {
        const last = prev[prev.length - 1]
        // Skip duplicate points (no movement)
        if (last && last.lat === data.lat && last.lng === data.lng) return prev
        return [...prev, { lat: data.lat, lng: data.lng }]
      })
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [order?.status, order?.rider_id, id])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!order) return <div className="text-center py-20 text-gray-400">Order not found</div>

  const currentStep = STEPS.indexOf(order.status)
  const isCancelled = order.status === 'cancelled'
  const alreadyRated = !!order.ratings?.some((r) => r.type === 'shop')

  const handleSubmitRating = async () => {
    if (shopStars < 1) { toast.error('Please rate the shop'); return }
    setSubmittingRating(true)
    try {
      await orderApi.rate(order.id, {
        shop: { stars: shopStars, comment: shopComment.trim() || undefined },
        rider: order.rider_id && riderStars > 0 ? { stars: riderStars } : undefined,
        products: Object.entries(productStars)
          .filter(([, stars]) => stars > 0)
          .map(([product_id, stars]) => ({ product_id, stars })),
      })
      toast.success('Thanks for rating your order!')
      orderApi.getById(order.id).then((res) => setOrder(res.data.data)).catch(() => {})
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not submit rating')
    } finally {
      setSubmittingRating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Order #{order.order_number || order.id.slice(0, 8).toUpperCase()}
        </h1>
        <Link to="/orders" className="text-sm text-brand-600 hover:underline">← All orders</Link>
      </div>

      {/* Status card */}
      <div className={clsx('card p-5', isCancelled ? 'bg-red-50' : 'bg-brand-50 border-brand-100')}>
        {isCancelled ? (
          <div className="text-center">
            <div className="text-4xl mb-2">❌</div>
            <div className="font-bold text-red-700">Order Cancelled</div>
          </div>
        ) : order.status === 'delivered' ? (
          <div className="text-center">
            <div className="text-4xl mb-2">🎉</div>
            <div className="font-bold text-brand-700 text-lg">Order Delivered!</div>
            <div className="text-sm text-gray-500 mt-1">Enjoy your groceries</div>
          </div>
        ) : (
          <div>
            <div className="text-center mb-4">
              <div className="text-3xl mb-1">{STEP_ICONS[order.status]}</div>
              <div className="font-bold text-brand-700">{STEP_LABELS[order.status]}</div>
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-1">
              {STEPS.slice(0, -1).map((step, i) => (
                <div key={step} className={clsx('flex-1 h-1.5 rounded-full transition-all',
                  i <= currentStep ? 'bg-brand-500' : 'bg-gray-200')} />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">Placed</span>
              <span className="text-xs text-gray-400">Delivered</span>
            </div>
          </div>
        )}
      </div>

      {/* Shop & delivery info */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center text-xl">🏪</div>
            <div>
              <div className="font-semibold">{order.shop_name}</div>
              <div className="text-xs text-gray-400">Shop</div>
            </div>
          </div>
          {order.shop_phone && (
            <a
              href={`tel:${order.shop_phone}`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 text-green-700 font-medium text-sm hover:bg-green-100 transition-colors border border-green-200"
            >
              <Phone size={15} />
              Call Shop
            </a>
          )}
        </div>
        <div className="flex items-start gap-3 text-sm">
          <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
          <span className="text-gray-600">
            {typeof order.delivery_address === 'object' && order.delivery_address !== null
              ? (order.delivery_address as Record<string, string>).street || 'Delivery address'
              : (order.delivery_address as string) || 'Delivery address'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Clock size={16} className="text-gray-400 shrink-0" />
          <span className="text-gray-600">
            {new Date(order.created_at).toLocaleString('en-IN', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            })}
          </span>
        </div>
      </div>

      {/* Live rider map — shown as soon as the rider is active.
          If we don't have a GPS fix yet, render a placeholder map at the
          customer's current location so there's always something visible. */}
      {LIVE_STATUSES.has(order.status) && (
        riderLoc
          ? <RiderMap
              lat={riderLoc.lat}
              lng={riderLoc.lng}
              updated_at={riderLoc.updated_at}
              path={riderPath}
            />
          : <RiderMap
              lat={customerLat && customerLat !== 0 ? customerLat : 28.6139}
              lng={customerLng && customerLng !== 0 ? customerLng : 77.2090}
              waiting
              path={[]}
            />
      )}

      {/* Items */}
      <div className="card p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Package size={16} className="text-brand-600" /> Items
        </h2>
        <div className="space-y-3">
          {order.items?.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              {item.product_image ? (
                <img src={item.product_image} alt={item.product_name}
                  className="w-12 h-12 rounded-xl object-cover border border-gray-100 shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xl shrink-0">📦</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{item.product_name}</div>
                <div className="text-xs text-gray-400">× {item.quantity} · ₹{Number(item.unit_price ?? 0).toFixed(2)} each</div>
              </div>
              <span className="text-sm font-semibold text-gray-700 shrink-0">
                ₹{Number(item.subtotal ?? item.total_price ?? 0).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-2 space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>₹{order.items?.reduce((s, i) => s + Number(i.subtotal ?? i.total_price ?? 0), 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Delivery fee</span>
              <span>₹{Number(order.delivery_fee ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>₹{Number(order.total_amount ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-1">
          💵 Cash on Delivery
        </div>
      </div>

      {/* Tracking timeline */}
      {order.tracking && order.tracking.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Order Timeline</h2>
          <div className="space-y-4">
            {order.tracking.map((t, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={clsx('w-3 h-3 rounded-full shrink-0 mt-0.5',
                    i === 0 ? 'bg-brand-600' : 'bg-gray-300')} />
                  {i < order.tracking!.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                </div>
                <div className="pb-4">
                  <div className="font-medium text-sm">
                    {STEP_ICONS[t.status]} {STEP_LABELS[t.status] || t.status}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(t.created_at).toLocaleString('en-IN', {
                      hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rate your order — delivered only, once */}
      {order.status === 'delivered' && (
        <div className="card p-5">
          {alreadyRated ? (
            <div className="flex flex-col items-center text-center py-2 gap-2">
              <CheckCircle2 size={28} className="text-brand-600" />
              <div className="font-semibold">Thanks for rating your order!</div>
            </div>
          ) : (
            <div className="space-y-5">
              <h2 className="font-semibold">Rate Your Order</h2>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Shop</div>
                <StarPicker value={shopStars} onChange={setShopStars} />
                <textarea
                  className="input mt-2 text-sm"
                  placeholder="Leave a comment (optional)"
                  value={shopComment}
                  onChange={(e) => setShopComment(e.target.value)}
                  rows={2}
                />
              </div>

              {order.rider_id && order.rider_name && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Rider — {order.rider_name}</div>
                  <StarPicker value={riderStars} onChange={setRiderStars} />
                </div>
              )}

              {order.items?.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase">Products</div>
                  {order.items.map((item) => (
                    <div key={item.product_id} className="flex items-center gap-3">
                      {item.product_image ? (
                        <img src={item.product_image} alt={item.product_name}
                          className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-base shrink-0">📦</div>
                      )}
                      <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{item.product_name}</span>
                      <StarPicker
                        size={18}
                        value={productStars[item.product_id] || 0}
                        onChange={(n) => setProductStars((prev) => ({ ...prev, [item.product_id]: n }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              <button onClick={handleSubmitRating} disabled={submittingRating} className="btn-primary w-full justify-center py-3">
                {submittingRating ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
