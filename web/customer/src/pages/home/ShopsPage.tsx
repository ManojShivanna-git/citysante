import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Search, Star, Clock, MapPin } from 'lucide-react'
import { shopApi, getImgUrl } from '../../services/api'
import { useLocationStore } from '../../store/locationStore'
import type { Shop } from '../../types'
import clsx from 'clsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRealImage(url: string | null | undefined): boolean {
  if (!url) return false
  if (url.includes('/avatar') || url.includes('l_text') || url.includes('placeholder')) return false
  return true
}

const CATEGORY_EMOJI: Record<string, { emoji: string; bg: string }> = {
  grocery:   { emoji: '🛒', bg: 'from-orange-50 via-amber-50  to-yellow-50' },
  vegetable: { emoji: '🥦', bg: 'from-green-50  via-emerald-50 to-teal-50'  },
  dairy:     { emoji: '🥛', bg: 'from-blue-50   via-sky-50    to-cyan-50'   },
}

const BADGE_ICONS: Record<string, string> = {
  citysante_verified: '✓',
  zones_best:         '🏆',
  top_seller:         '🔥',
  fast_delivery:      '⚡',
}

// ─── Shop Card ────────────────────────────────────────────────────────────────

function ShopCard({ shop }: { shop: Shop }) {
  const cat      = CATEGORY_EMOJI[shop.zone_category] ?? { emoji: '🏪', bg: 'from-orange-50 via-amber-50 to-yellow-50' }
  const logoUrl  = isRealImage(shop.logo_url) ? getImgUrl(shop.logo_url) : null

  return (
    <Link
      to={`/shop/${shop.id}`}
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-row h-32"
    >
      {/* Left image */}
      <div className={`w-32 shrink-0 relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${cat.bg}`}>
        {logoUrl ? (
          <img src={logoUrl} alt={shop.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <span className="text-6xl group-hover:scale-110 transition-transform duration-200 drop-shadow-sm select-none">
            {cat.emoji}
          </span>
        )}
        {!shop.is_open && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-[10px] tracking-widest uppercase">Closed</span>
          </div>
        )}
      </div>

      {/* Right info */}
      <div className="flex flex-col justify-between flex-1 min-w-0 p-3">
        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <h3 className="font-bold text-gray-900 text-sm leading-tight truncate flex-1">{shop.name}</h3>
            {shop.is_open && <span className="shrink-0 w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-200" />}
          </div>
          {Array.isArray(shop.badges) && shop.badges.filter(Boolean).length > 0 && (
            <span className="inline-block bg-orange-50 text-orange-600 text-[9px] px-2 py-0.5 rounded-full font-semibold border border-orange-100">
              {BADGE_ICONS[shop.badges.filter(Boolean)[0]] || '⭐'} {shop.badges.filter(Boolean)[0].replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-0.5 font-semibold text-amber-500">
            <Star size={10} fill="currentColor" /> {shop.rating || '—'}
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-0.5 text-gray-500">
            <Clock size={10} /> {shop.delivery_time_min}–{shop.delivery_time_max}m
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-0.5 text-gray-500">
            <MapPin size={10} /> {shop.distance ? `${shop.distance.toFixed(1)}km` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-50">
          <span className="text-gray-400">Min ₹{shop.minimum_order}</span>
          <span className="font-semibold text-orange-500">Del ₹{shop.delivery_fee}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ShopSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 h-32 flex animate-pulse overflow-hidden">
      <div className="w-32 shrink-0 bg-amber-50" />
      <div className="flex-1 p-3 space-y-2">
        <div className="h-3 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
    </div>
  )
}

// ─── Filter chips ─────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',       label: 'All Shops' },
  { key: 'open',      label: '🟢 Open now' },
  { key: 'grocery',   label: '🛒 Grocery' },
  { key: 'vegetable', label: '🥦 Vegetables' },
  { key: 'dairy',     label: '🥛 Dairy' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShopsPage() {
  const { lat, lng }  = useLocationStore()
  const [shops, setShops]     = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ]             = useState('')
  const [filter, setFilter]   = useState('all')
  const [nearestFirst, setNearestFirst] = useState(false)
  const inputRef              = useRef<HTMLInputElement>(null)

  useEffect(() => {
    shopApi.getNearby(lat, lng, { radius: '15', limit: '50' })
      .then((res) => setShops(res.data.data.shops))
      .catch(() => {})
      .finally(() => setLoading(false))
    inputRef.current?.focus()
  }, [lat, lng])

  // Apply search + filter + sort
  const visible = shops
    .filter((s) => {
      const matchQ = !q.trim() || s.name.toLowerCase().includes(q.toLowerCase())
      const matchF =
        filter === 'all'       ? true :
        filter === 'open'      ? s.is_open :
        s.zone_category === filter
      return matchQ && matchF
    })
    .sort((a, b) => {
      if (!nearestFirst) return 0
      const da = a.distance ?? Infinity
      const db = b.distance ?? Infinity
      return da - db
    })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">Nearby Shops</h1>
        {!loading && (
          <p className="text-sm text-gray-400 mt-0.5">{shops.length} shops in your area</p>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        <input
          ref={inputRef}
          className="w-full pl-11 pr-10 py-3.5 rounded-2xl border border-gray-200 text-sm
                     focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300 bg-white shadow-sm transition-all"
          placeholder="Search shops by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl leading-none"
            onClick={() => setQ('')}
          >
            ×
          </button>
        )}
      </div>

      {/* Filter chips + sort toggle */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={clsx(
              'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
              filter === key
                ? 'text-white border-transparent shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-red-200'
            )}
            style={filter === key ? { background: 'linear-gradient(135deg, #dc2626, #f59e0b)', border: 'none' } : undefined}
          >
            {label}
          </button>
        ))}

        {/* Nearest first toggle */}
        <button
          onClick={() => setNearestFirst((v) => !v)}
          className={clsx(
            'shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
            nearestFirst
              ? 'text-white border-transparent shadow-sm'
              : 'bg-white text-gray-600 border-gray-200 hover:border-red-200'
          )}
          style={nearestFirst ? { background: 'linear-gradient(135deg, #dc2626, #f59e0b)', border: 'none' } : undefined}
        >
          <MapPin size={11} /> Nearest first
        </button>

        {!loading && visible.length > 0 && (
          <span className="ml-2 shrink-0 text-xs text-gray-400 self-center pr-1">
            {visible.length} shop{visible.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <ShopSkeleton key={i} />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-14 text-center">
          <div className="text-5xl mb-4">{q ? '🔍' : '🏪'}</div>
          <p className="font-bold text-gray-700 text-base">
            {q ? `No shops matching "${q}"` : 'No shops found'}
          </p>
          <p className="text-sm text-gray-400 mt-1.5">
            {q ? 'Try a different name' : 'Try updating your location'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
        </div>
      )}
    </div>
  )
}
