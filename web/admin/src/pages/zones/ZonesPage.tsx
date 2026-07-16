import { useEffect, useRef, useState } from 'react'
import {
  Plus, MapPin, CheckCircle, AlertCircle, XCircle,
  Map as MapIcon, Store, Phone, Star, ChevronRight, X, Search, List,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../services/api'
import type { Zone, ZoneCoverage } from '../../types'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZoneShop {
  id: string; name: string; phone: string; address: string; city: string
  status: 'pending' | 'active' | 'suspended' | 'rejected'
  zone_category: string; is_open: boolean; rating: number | null
  lat: number | null; lng: number | null
  badges: string[]; owner_name: string; owner_phone: string
  total_orders: number; delivered_orders: number
}

declare global { interface Window { L: any } }

// ─── Category colours ─────────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  grocery:   '#16a34a',  // green
  vegetable: '#f97316',  // orange
  dairy:     '#2563eb',  // blue
  general:   '#7c3aed',  // purple
}

// ─── Zone Shops Map ───────────────────────────────────────────────────────────

declare global { interface Window { google: any } }

function ZoneShopsMap({ shops }: { shops: ZoneShop[] }) {
  const mapRef  = useRef<HTMLDivElement>(null)
  const mapInst = useRef<any>(null)

  useEffect(() => {
    const google = window.google
    if (!google || !mapRef.current) return

    const withCoords = shops.filter((s) => s.lat && s.lng)
    const avgLat = withCoords.length
      ? withCoords.reduce((a, s) => a + Number(s.lat), 0) / withCoords.length
      : 12.9716
    const avgLng = withCoords.length
      ? withCoords.reduce((a, s) => a + Number(s.lng), 0) / withCoords.length
      : 77.5946

    const map = new google.maps.Map(mapRef.current, {
      center:            { lat: avgLat, lng: avgLng },
      zoom:              14,
      mapTypeId:         google.maps.MapTypeId.ROADMAP,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl:    false,
    })
    mapInst.current = map

    withCoords.forEach((shop) => {
      const color     = CAT_COLOR[shop.zone_category] ?? '#6b7280'
      const statusDot = shop.status === 'active' ? '#22c55e' : shop.status === 'pending' ? '#f59e0b' : '#ef4444'

      const marker = new google.maps.Marker({
        position: { lat: Number(shop.lat), lng: Number(shop.lng) },
        map,
        title: shop.name,
        icon: {
          path:        google.maps.SymbolPath.CIRCLE,
          scale:       10,
          fillColor:   color,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      })

      const info = new google.maps.InfoWindow({
        content: `
          <div style="font-family:sans-serif;min-width:160px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${shop.name}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusDot}"></span>
              <span style="font-size:12px;color:#6b7280;text-transform:capitalize">${shop.status}</span>
              <span style="font-size:11px;color:#9ca3af">· ${shop.zone_category}</span>
            </div>
            <div style="font-size:12px;color:#374151;margin-bottom:8px">${shop.phone}</div>
            <a href="/shops/${shop.id}" style="display:block;text-align:center;background:${color};color:#fff;padding:5px 10px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">
              View Shop →
            </a>
          </div>`,
      })
      marker.addListener('click', () => info.open(map, marker))
    })

    if (withCoords.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      withCoords.forEach((s) => bounds.extend({ lat: Number(s.lat), lng: Number(s.lng) }))
      map.fitBounds(bounds)
    }

    return () => {
      google.maps.event.clearInstanceListeners(map)
      if (mapRef.current) mapRef.current.innerHTML = ''
      mapInst.current = null
    }
  }, [shops])

  const noCoords = shops.filter((s) => !s.lat || !s.lng)

  return (
    <div className="flex flex-col h-full">
      <div ref={mapRef} style={{ flex: 1, minHeight: 0, zIndex: 0 }} />
      {noCoords.length > 0 && (
        <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-100 text-xs text-yellow-700">
          ⚠ {noCoords.length} shop{noCoords.length !== 1 ? 's' : ''} missing GPS — not shown on map
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CoverageIcon({ status }: { status: string }) {
  if (status === 'complete') return <CheckCircle size={18} className="text-green-500" />
  if (status === 'partial')  return <AlertCircle  size={18} className="text-yellow-500" />
  return <XCircle size={18} className="text-red-400" />
}

const STATUS_COLOUR: Record<string, string> = {
  active: 'badge-green', pending: 'badge-yellow',
  suspended: 'badge-red', rejected: 'badge-gray',
}

// ─── Zone Shops Panel ─────────────────────────────────────────────────────────

const TYPE_FILTERS = ['all', 'grocery', 'vegetable', 'dairy'] as const
type TypeFilter = typeof TYPE_FILTERS[number]

function ZoneShopsPanel({
  zoneName, zoneId, onClose,
}: { zoneName: string; zoneId: string; onClose: () => void }) {
  const [shops, setShops]       = useState<ZoneShop[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [view, setView]         = useState<'list' | 'map'>('list')

  useEffect(() => {
    setLoading(true)
    adminApi.getZoneShops(zoneId)
      .then((res) => setShops(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [zoneId])

  const filtered = shops.filter((s) => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.owner_name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.address.toLowerCase().includes(q)
    const matchType   = typeFilter === 'all' || s.zone_category === typeFilter
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSearch && matchType && matchStatus
  })

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">{zoneName}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading
                  ? '…'
                  : `${filtered.length} of ${shops.length} shop${shops.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* List / Map toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setView('list')}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors',
                    view === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <List size={13} /> List
                </button>
                <button
                  onClick={() => setView('map')}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors',
                    view === 'map' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <MapIcon size={13} /> Map
                </button>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9 text-sm"
              placeholder="Search by name, owner, phone, address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 flex-wrap">
            {/* Type filter */}
            {TYPE_FILTERS.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize',
                  typeFilter === t
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {t === 'all' ? 'All types' : t}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-0.5" />
            {/* Status filter */}
            {['all', 'active', 'pending', 'suspended'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize',
                  statusFilter === s
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {s === 'all' ? 'All status' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {/* Map view */}
          {view === 'map' && !loading && (
            <div className="flex-1 min-h-0" style={{ minHeight: 400 }}>
              <ZoneShopsMap shops={shops} />
            </div>
          )}

          {/* List view (or loading/empty) */}
          {(view === 'list' || loading) && loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : view === 'list' && shops.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
              <Store size={36} className="opacity-30" />
              <p className="text-sm">No shops in this zone yet</p>
              <p className="text-xs">Go to the Shops page to assign shops here.</p>
            </div>
          ) : view === 'list' && filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
              <Search size={28} className="opacity-30" />
              <p className="text-sm">No shops match your search</p>
              <button
                onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all') }}
                className="text-xs text-brand-600 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : view === 'list' ? (
            <div className="divide-y divide-gray-100">
              {filtered.map((shop) => (
                <Link
                  key={shop.id}
                  to={`/shops/${shop.id}`}
                  onClick={onClose}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Store size={18} className="text-brand-600" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm group-hover:text-brand-600 transition-colors">
                        {shop.name}
                      </span>
                      <span className={STATUS_COLOUR[shop.status]}>{shop.status}</span>
                      <span className={shop.is_open ? 'badge-green' : 'badge-gray'}>
                        {shop.is_open ? 'Open' : 'Closed'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="capitalize badge badge-blue">{shop.zone_category}</span>
                      {shop.rating && (
                        <span className="flex items-center gap-1 text-yellow-600">
                          <Star size={11} fill="currentColor" />
                          {Number(shop.rating).toFixed(1)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Phone size={11} /> {shop.phone}
                      </span>
                    </div>

                    <div className="text-xs text-gray-400 mt-1 truncate">{shop.address}</div>

                    <div className="mt-2 flex gap-3 text-xs text-gray-500">
                      <span>Owner: <span className="text-gray-700">{shop.owner_name}</span></span>
                      <span>Orders: <span className="font-medium text-gray-700">{shop.total_orders}</span></span>
                      <span>Delivered: <span className="font-medium text-green-600">{shop.delivered_orders}</span></span>
                    </div>
                  </div>

                  <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 shrink-0 mt-1 transition-colors" />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ZonesPage() {
  const [zones, setZones]         = useState<Zone[]>([])
  const [coverage, setCoverage]   = useState<ZoneCoverage[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<'zones' | 'coverage'>('coverage')
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState({ name: '', city: '', state: 'Karnataka' })
  const [shopsPanel, setShopsPanel] = useState<{ id: string; name: string } | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([adminApi.getZones(), adminApi.getZoneCoverage()])
      .then(([z, c]) => {
        setZones(z.data.data)
        setCoverage(c.data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await adminApi.createZone(form)
      toast.success('Zone created')
      setShowAdd(false)
      setForm({ name: '', city: '', state: 'Karnataka' })
      load()
    } catch {}
  }

  const coverageColor = (status: string) =>
    status === 'complete' ? 'border-green-200 bg-green-50' :
    status === 'partial'  ? 'border-yellow-200 bg-yellow-50' :
    'border-red-200 bg-red-50'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zones</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} /> Add Zone
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Complete',  color: 'text-green-600',  bg: 'bg-green-50',  count: coverage.filter((c) => c.coverage_status === 'complete').length },
          { label: 'Partial',   color: 'text-yellow-600', bg: 'bg-yellow-50', count: coverage.filter((c) => c.coverage_status === 'partial').length },
          { label: 'Empty',     color: 'text-red-600',    bg: 'bg-red-50',    count: coverage.filter((c) => c.coverage_status === 'empty').length },
        ].map((s) => (
          <div key={s.label} className={`card p-4 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-sm text-gray-600 mt-1">{s.label} Zones</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['coverage', 'zones'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'coverage' ? (

        // ── Coverage cards ─────────────────────────────────────────────────
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coverage.length === 0 ? (
            <div className="text-center py-16 text-gray-400 col-span-3">No zones yet. Create one to get started.</div>
          ) : coverage.map((z) => (
            <button
              key={z.zone_id}
              onClick={() => setShopsPanel({ id: z.zone_id, name: z.zone_name })}
              className={clsx(
                'card p-5 border-2 text-left w-full transition-shadow hover:shadow-md cursor-pointer group',
                coverageColor(z.coverage_status)
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">
                    {z.zone_name}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={11} /> {z.city}
                  </div>
                </div>
                <CoverageIcon status={z.coverage_status} />
              </div>
              <div className="space-y-1.5">
                {[
                  { label: '🛒 Grocery',   has: z.has_grocery   },
                  { label: '🥦 Vegetable', has: z.has_vegetable },
                  { label: '🥛 Dairy',     has: z.has_dairy     },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{item.label}</span>
                    <span className={item.has ? 'text-green-600 font-medium' : 'text-red-400'}>
                      {item.has ? '✓ Covered' : '✗ Missing'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <span>{z.shop_count} shop{z.shop_count !== 1 ? 's' : ''} in zone</span>
                <span className="text-brand-600 font-medium group-hover:underline">View shops →</span>
              </div>
            </button>
          ))}
        </div>

      ) : (

        // ── Zones table ────────────────────────────────────────────────────
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Zone Name', 'City', 'State', 'Shops', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zones.map((z) => (
                <tr key={z.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setShopsPanel({ id: z.id, name: z.name })}
                      className="font-medium text-brand-600 hover:underline text-left"
                    >
                      {z.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{z.city}</td>
                  <td className="px-4 py-3 text-gray-600">{z.state}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setShopsPanel({ id: z.id, name: z.name })}
                      className="text-sm text-gray-700 hover:text-brand-600 flex items-center gap-1 transition-colors"
                    >
                      <Store size={13} />
                      {(z as any).total_shops || 0} shops
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={z.is_active ? 'badge-green' : 'badge-gray'}>
                      {z.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Zone Shops Slide Panel */}
      {shopsPanel && (
        <ZoneShopsPanel
          zoneId={shopsPanel.id}
          zoneName={shopsPanel.name}
          onClose={() => setShopsPanel(null)}
        />
      )}

      {/* Add Zone Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Create Zone</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <input className="input" placeholder="Zone name (e.g. Koramangala Zone)" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input className="input" placeholder="City" value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })} required />
              <input className="input" placeholder="State" value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })} required />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
