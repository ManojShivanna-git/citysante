import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Store, Phone, MapPin, Star, Award,
  ShoppingBag, TrendingUp, Users, CheckCircle, XCircle,
  PauseCircle, PlayCircle, IndianRupee, Calendar, AlertTriangle,
} from 'lucide-react'
import { adminApi } from '../../services/api'
import SearchableSelect from '../../components/SearchableSelect'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShopDetail {
  id: string; name: string; description: string | null
  status: 'pending' | 'active' | 'suspended' | 'rejected'
  phone: string; address: string; city: string; state: string; pincode: string
  lat: number | null; lng: number | null
  zone_id: string | null; zone_category: string
  zone_name: string | null; zone_city: string | null
  rating: number | null; total_reviews: number
  delivery_fee: number; minimum_order: number
  delivery_time_min: number; delivery_time_max: number
  is_open: boolean; badges: string[] | null
  commission_balance: number
  owner_name: string; owner_email: string; owner_phone: string
  created_at: string
  stats: {
    total_orders: number; delivered_orders: number
    cancelled_orders: number; active_orders: number
    total_revenue: number
  }
}

interface Zone { id: string; name: string; city: string }

interface ShopOrder {
  id: string; order_ref: string; status: string
  total_amount: number; item_count: number
  customer_name: string; customer_phone: string
  created_at: string
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green', pending: 'badge-yellow',
  suspended: 'badge-red', rejected: 'badge-gray',
}

const ORDER_STATUS_COLOUR: Record<string, string> = {
  pending: 'badge-yellow', confirmed: 'badge-blue', packed: 'badge-blue',
  assigned: 'badge-blue', picked_up: 'badge badge-orange',
  out_for_delivery: 'badge badge-orange', delivered: 'badge-green', cancelled: 'badge-red',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', packed: 'Packed',
  assigned: 'Assigned', picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled',
}

// ─── Shop Map ─────────────────────────────────────────────────────────────────

declare global { interface Window { google: any } }

function ShopMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const mapRef  = useRef<HTMLDivElement>(null)
  const mapInst = useRef<any>(null)

  useEffect(() => {
    const google = window.google
    if (!google || !mapRef.current) return
    // Prevent double-init (React StrictMode runs effects twice in dev)
    if (mapInst.current) return

    const container = mapRef.current
    const center    = { lat, lng }

    const map = new google.maps.Map(container, {
      center,
      zoom:              16,
      mapTypeId:         google.maps.MapTypeId.ROADMAP,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl:    false,
    })
    mapInst.current = map

    const marker = new google.maps.Marker({
      position: center,
      map,
      title:    name,
      icon: {
        path:        google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale:       6,
        fillColor:   '#f97316',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
        rotation:    180,
      },
    })

    const info = new google.maps.InfoWindow({ content: `<strong>${name}</strong>` })
    info.open(map, marker)

    return () => {
      google.maps.event.clearInstanceListeners(map)
      if (container) container.innerHTML = ''
      mapInst.current = null
    }
  }, [lat, lng, name])

  return (
    <div ref={mapRef} style={{ height: 220, borderRadius: 12, overflow: 'hidden', zIndex: 0 }} />
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [shop, setShop]       = useState<ShopDetail | null>(null)
  const [zones, setZones]     = useState<Zone[]>([])
  const [orders, setOrders]   = useState<ShopOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(false)
  const [assigningZone, setAssigningZone] = useState(false)
  const [selectedZone, setSelectedZone]   = useState('')
  const [tab, setTab]         = useState<'info' | 'orders'>('info')

  const load = () => {
    if (!id) return
    setLoading(true)
    Promise.all([
      adminApi.getShopDetail(id),
      adminApi.getShopOrders(id),
      adminApi.getZones(),
    ])
      .then(([shopRes, ordersRes, zonesRes]) => {
        const s: ShopDetail = shopRes.data.data
        setShop(s)
        setOrders(ordersRes.data.data)
        setZones(zonesRes.data.data)
        setSelectedZone(s.zone_id ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleAssignZone = async () => {
    if (!id || !selectedZone) return
    setAssigningZone(true)
    try {
      await adminApi.assignShopZone(id, selectedZone)
      toast.success('Zone assigned')
      load()
    } catch {} finally { setAssigningZone(false) }
  }

  const handleReview = async (status: 'active' | 'rejected') => {
    if (!id) return
    if (status === 'active' && !shop?.zone_id && !selectedZone) {
      toast.error('Assign a zone before approving this shop')
      return
    }
    setActing(true)
    try {
      // If a zone is selected but not yet saved, save it first
      if (status === 'active' && selectedZone && selectedZone !== shop?.zone_id) {
        await adminApi.assignShopZone(id, selectedZone)
      }
      await adminApi.reviewShop(id, status)
      toast.success(`Shop ${status === 'active' ? 'approved' : 'rejected'}`)
      load()
    } catch {} finally { setActing(false) }
  }

  const handleSuspend = async () => {
    if (!id) return
    setActing(true)
    try {
      await adminApi.suspendShop(id, 'Suspended by admin')
      toast.success('Shop suspended')
      load()
    } catch {} finally { setActing(false) }
  }

  const handleReactivate = async () => {
    if (!id) return
    setActing(true)
    try {
      await adminApi.reactivateShop(id)
      toast.success('Shop reactivated')
      load()
    } catch {} finally { setActing(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!shop) return <div className="text-center py-20 text-gray-400">Shop not found</div>

  const fmt = (n: number | string) => Number(n).toLocaleString('en-IN')
  const hasZone = !!shop.zone_id
  const zoneChanged = selectedZone && selectedZone !== shop.zone_id

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/shops')}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
            <span className={STATUS_BADGE[shop.status]}>{shop.status}</span>
            <span className={shop.is_open ? 'badge-green' : 'badge-gray'}>
              {shop.is_open ? 'Open' : 'Closed'}
            </span>
            {!hasZone && (
              <span className="badge badge-red flex items-center gap-1">
                <AlertTriangle size={11} /> No Zone
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{shop.city}, {shop.state}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {shop.status === 'pending' && (
            <>
              <button onClick={() => handleReview('active')} disabled={acting}
                className="btn-primary flex items-center gap-2 text-sm">
                <CheckCircle size={15} /> Approve
              </button>
              <button onClick={() => handleReview('rejected')} disabled={acting}
                className="btn-danger flex items-center gap-2 text-sm">
                <XCircle size={15} /> Reject
              </button>
            </>
          )}
          {shop.status === 'active' && (
            <button onClick={handleSuspend} disabled={acting}
              className="btn-secondary flex items-center gap-2 text-sm text-yellow-700">
              <PauseCircle size={15} /> Suspend
            </button>
          )}
          {shop.status === 'suspended' && (
            <button onClick={handleReactivate} disabled={acting}
              className="btn-primary flex items-center gap-2 text-sm">
              <PlayCircle size={15} /> Reactivate
            </button>
          )}
        </div>
      </div>

      {/* ── Zone assignment — always visible, prominent ──────────────────────── */}
      <div className={clsx(
        'card p-5',
        !hasZone ? 'border-2 border-orange-300 bg-orange-50' : 'border border-gray-200'
      )}>
        <div className="flex items-start gap-3">
          <MapPin size={18} className={clsx('mt-0.5 shrink-0', !hasZone ? 'text-orange-500' : 'text-brand-600')} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-gray-800">Zone Assignment</h2>
              {!hasZone && (
                <span className="text-xs text-orange-600 font-medium">
                  Required before approving
                </span>
              )}
            </div>
            {hasZone && (
              <p className="text-xs text-gray-400 mb-3">
                Currently in <strong className="text-gray-700">{shop.zone_name}</strong> ({shop.zone_city})
                — change below if needed.
              </p>
            )}
            {!hasZone && (
              <p className="text-xs text-orange-600 mb-3">
                This shop is not assigned to any zone. Assign one before approving it.
              </p>
            )}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <SearchableSelect
                  value={selectedZone}
                  onChange={setSelectedZone}
                  placeholder="Select a zone…"
                  options={zones.map((z) => ({ value: z.id, label: `${z.name} — ${z.city}` }))}
                />
              </div>
              {zoneChanged && (
                <button
                  onClick={handleAssignZone}
                  disabled={assigningZone}
                  className="btn-primary text-sm whitespace-nowrap"
                >
                  {assigningZone ? 'Saving…' : 'Save Zone'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { icon: ShoppingBag, label: 'Total Orders',  value: fmt(shop.stats.total_orders),     color: 'text-gray-700' },
          { icon: CheckCircle, label: 'Delivered',     value: fmt(shop.stats.delivered_orders),  color: 'text-green-600' },
          { icon: TrendingUp,  label: 'Active',        value: fmt(shop.stats.active_orders),     color: 'text-blue-600' },
          { icon: XCircle,     label: 'Cancelled',     value: fmt(shop.stats.cancelled_orders),  color: 'text-red-500' },
          { icon: IndianRupee, label: 'Total Revenue', value: `₹${fmt(shop.stats.total_revenue)}`, color: 'text-green-700' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <Icon size={18} className={clsx('mx-auto mb-1', color)} />
            <div className={clsx('font-bold text-lg', color)}>{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['info', 'orders'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx(
              'px-5 py-2.5 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'border-b-2 border-brand-600 text-brand-600'
                : 'text-gray-500 hover:text-gray-700'
            )}>
            {t === 'info' ? 'Shop Info' : `Orders (${orders.length})`}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {tab === 'info' && (
        <div className="space-y-5">

        {/* Map */}
        {shop.lat && shop.lng && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={15} className="text-brand-600" />
              <span className="font-semibold text-sm text-gray-700">Shop Location</span>
              <span className="text-xs text-gray-400 ml-auto">
                {Number(shop.lat).toFixed(6)}, {Number(shop.lng).toFixed(6)}
              </span>
            </div>
            <ShopMap lat={Number(shop.lat)} lng={Number(shop.lng)} name={shop.name} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2 text-gray-800">
              <Store size={16} className="text-brand-600" /> Shop Details
            </h2>

            {shop.description && (
              <p className="text-sm text-gray-600">{shop.description}</p>
            )}

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Phone size={15} className="text-gray-400 mt-0.5 shrink-0" />
                <span className="text-gray-700">{shop.phone}</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={15} className="text-gray-400 mt-0.5 shrink-0" />
                <span className="text-gray-700">
                  {shop.address}, {shop.city}, {shop.state} — {shop.pincode}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Star size={15} className="text-yellow-500 shrink-0" />
                <span className="text-gray-700">
                  {shop.rating ? `${Number(shop.rating).toFixed(1)} / 5` : 'No ratings yet'}
                  {shop.total_reviews > 0 && (
                    <span className="text-gray-400 ml-1">({shop.total_reviews} reviews)</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={15} className="text-gray-400 shrink-0" />
                <span className="text-gray-700">
                  Registered {new Date(shop.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-xs text-gray-400">Delivery Fee</div>
                <div className="font-medium">₹{shop.delivery_fee}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Min Order</div>
                <div className="font-medium">₹{shop.minimum_order}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Delivery Time</div>
                <div className="font-medium">{shop.delivery_time_min}–{shop.delivery_time_max} min</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Shop Type</div>
                <div className="font-medium capitalize">{shop.zone_category}</div>
              </div>
            </div>

            {shop.badges && shop.badges.length > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                  <Award size={12} /> Badges
                </div>
                <div className="flex flex-wrap gap-2">
                  {shop.badges.map((b) => (
                    <span key={b} className="badge badge-blue capitalize text-xs">
                      {b.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="card p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2 text-gray-800">
                <Users size={16} className="text-brand-600" /> Owner
              </h2>
              <div className="space-y-2 text-sm">
                <div className="font-medium text-gray-900">{shop.owner_name}</div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone size={13} className="text-gray-400" /> {shop.owner_phone}
                </div>
                <div className="text-gray-400 text-xs">{shop.owner_email}</div>
              </div>
            </div>

            <div className="card p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2 text-gray-800">
                <IndianRupee size={16} className="text-brand-600" /> Billing
              </h2>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Commission Balance</div>
                <div className={clsx(
                  'font-bold text-lg',
                  shop.commission_balance >= 5000 ? 'text-red-600' :
                  shop.commission_balance >= 2000 ? 'text-orange-500' : 'text-gray-900'
                )}>
                  ₹{fmt(shop.commission_balance)}
                </div>
              </div>
              {shop.commission_balance >= 2000 && (
                <p className={clsx(
                  'text-xs px-3 py-1.5 rounded-lg',
                  shop.commission_balance >= 5000 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                )}>
                  {shop.commission_balance >= 5000
                    ? '⚠️ Fast growth threshold — immediate payment required'
                    : '⚠️ Payment due within 7 days'}
                </p>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Orders tab */}
      {tab === 'orders' && (
        <div className="card overflow-hidden">
          {orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingBag size={36} className="mx-auto mb-3 opacity-30" />
              No orders yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Order #', 'Customer', 'Items', 'Total', 'Status', 'Date'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        #{order.order_ref}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{order.customer_name}</div>
                        <div className="text-xs text-gray-400">{order.customer_phone}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {order.item_count} item{Number(order.item_count) !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">
                        ₹{fmt(order.total_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={ORDER_STATUS_COLOUR[order.status] || 'badge-gray'}>
                          {ORDER_STATUS_LABEL[order.status] || order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                        <div className="text-gray-400">
                          {new Date(order.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
