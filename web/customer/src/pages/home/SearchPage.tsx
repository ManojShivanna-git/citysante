import { useEffect, useState, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Search, Plus, Minus, Zap, DollarSign, List, Clock, MapPin, RotateCcw, TrendingUp, Sparkles } from 'lucide-react'
import { productApi, orderApi } from '../../services/api'
import { useLocationStore } from '../../store/locationStore'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'
import type { SearchResult } from '../../types'
import RippleButton from '../../components/RippleButton'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ── Shared result card (used both in discovery and live search) ─────────────

function ProductCard({ r, getQty, onAdd, onUpdate }: {
  r: SearchResult
  getQty: (id: string) => number
  onAdd: (r: SearchResult) => void
  onUpdate: (id: string, qty: number) => void
}) {
  const qty     = getQty(r.id)
  const hasDisc = r.discount_price && r.discount_price < r.price
  return (
    <div className="card p-3.5 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-gray-100">
        {r.image_url
          ? <img src={r.image_url} alt={r.product_name} className="w-full h-full object-cover" />
          : <span className="text-2xl">📦</span>
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 text-sm truncate">{r.product_name}</div>
        <div className="text-xs text-gray-400 mt-0.5">{r.unit_value} {r.unit}{(r as any).brand ? ` · ${(r as any).brand}` : ''}</div>
        <Link to={`/shop/${r.shop_id}`} className="text-xs text-brand-500 hover:underline mt-0.5 flex items-center gap-1.5 truncate">
          <span className="truncate">{r.shop_name}</span>
          <span className="flex items-center gap-1 shrink-0 text-gray-400">
            <Clock size={9} /> {r.delivery_time_min}–{r.delivery_time_max}m
          </span>
          {r.distance != null && (
            <span className="flex items-center gap-1 shrink-0 text-gray-400">
              <MapPin size={9} /> {r.distance.toFixed(1)}km
            </span>
          )}
        </Link>
      </div>

      <div className="text-right shrink-0">
        <div className="font-bold text-gray-900 text-sm">₹{r.effective_price}</div>
        {hasDisc && (
          <div className="flex items-center gap-1 justify-end">
            <span className="text-xs text-gray-400 line-through">₹{r.price}</span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
              {Math.round((1 - r.discount_price! / r.price) * 100)}%
            </span>
          </div>
        )}
        <div className="mt-1.5">
          {qty === 0 ? (
            <RippleButton
              onClick={() => onAdd(r)}
              disabled={!r.is_open}
              className="btn-primary text-xs py-1 px-2.5 disabled:opacity-40"
            >
              <Plus size={12} /> Add
            </RippleButton>
          ) : (
            <div className="flex items-center gap-1 bg-brand-50 rounded-xl px-1 py-1">
              <RippleButton
                onClick={() => onUpdate(r.id, qty - 1)}
                rippleColor="rgba(220,38,38,0.2)"
                className="w-6 h-6 bg-white border border-brand-200 text-brand-600 rounded-lg
                           flex items-center justify-center hover:bg-brand-100 shadow-sm"
              >
                <Minus size={11} />
              </RippleButton>
              <span className="font-bold text-sm w-4 text-center text-brand-700">{qty}</span>
              <RippleButton
                onClick={() => onUpdate(r.id, qty + 1)}
                className="w-6 h-6 bg-brand-500 text-white rounded-lg
                           flex items-center justify-center hover:bg-brand-600 shadow-sm"
              >
                <Plus size={11} />
              </RippleButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton loader ─────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="card p-3.5 animate-pulse flex gap-3">
      <div className="w-14 h-14 bg-gray-100 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3.5 bg-gray-100 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  )
}

// ── Discovery view (shown when query is empty) ──────────────────────────────

function DiscoveryView({
  lat, lng, onChipClick, getQty, onAdd, onUpdate
}: {
  lat: number; lng: number
  onChipClick: (name: string) => void
  getQty: (id: string) => number
  onAdd: (r: SearchResult) => void
  onUpdate: (id: string, qty: number) => void
}) {
  const { isAuthenticated } = useAuthStore()
  const [recentNames, setRecentNames]     = useState<string[]>([])
  const [trending, setTrending]           = useState<SearchResult[]>([])
  const [popular, setPopular]             = useState<SearchResult[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [loadingTrend, setLoadingTrend]   = useState(true)
  const [loadingPop, setLoadingPop]       = useState(true)

  useEffect(() => {
    // ── Recently ordered (from the user's last 3 orders) ──────────────────
    if (isAuthenticated) {
      orderApi.getMyOrders({ limit: 3 })
        .then((res) => {
          const orders: any[] = res.data.data || []
          const names = Array.from(
            new Set(
              orders.flatMap((o: any) =>
                (o.items || []).map((i: any) => i.product_name as string)
              )
            )
          ).slice(0, 10)
          setRecentNames(names)
        })
        .catch(() => {})
        .finally(() => setLoadingRecent(false))
    } else {
      setLoadingRecent(false)
    }

    // ── Trending today ────────────────────────────────────────────────────
    productApi.trending(lat, lng, { limit: 8 })
      .then((res) => setTrending(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingTrend(false))

    // ── Popular near you (browse, sorted by distance) ─────────────────────
    productApi.browse(lat, lng, 'fast', { limit: 6 })
      .then((res) => setPopular(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingPop(false))
  }, [lat, lng, isAuthenticated])

  return (
    <div className="space-y-6">

      {/* ── Order again ─────────────────────────────────────────────────── */}
      {isAuthenticated && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <RotateCcw size={15} className="text-brand-500" />
            <h3 className="text-sm font-bold text-gray-800">Order again</h3>
          </div>
          {loadingRecent ? (
            <div className="flex flex-wrap gap-2">
              {[1,2,3,4].map((i) => (
                <div key={i} className="h-8 w-24 bg-gray-100 rounded-full animate-pulse" />
              ))}
            </div>
          ) : recentNames.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {recentNames.map((name) => (
                <button
                  key={name}
                  onClick={() => onChipClick(name)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5
                             bg-brand-50 border border-brand-100 text-brand-700
                             rounded-full hover:bg-brand-100 transition-colors"
                >
                  <RotateCcw size={11} />
                  {name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No past orders yet — start shopping!</p>
          )}
        </section>
      )}

      {/* ── Trending today ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={15} className="text-orange-500" />
          <h3 className="text-sm font-bold text-gray-800">Trending today</h3>
          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">
            🔥 Most ordered
          </span>
        </div>
        {loadingTrend ? (
          <div className="space-y-2">{[1,2,3].map((i) => <CardSkeleton key={i} />)}</div>
        ) : trending.length > 0 ? (
          <div className="space-y-2">
            {trending.map((r) => (
              <ProductCard key={r.id} r={r} getQty={getQty} onAdd={onAdd} onUpdate={onUpdate} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 py-2">No trending items right now — check back later</p>
        )}
      </section>

      {/* ── Popular near you ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={15} className="text-yellow-500" />
          <h3 className="text-sm font-bold text-gray-800">Popular near you</h3>
        </div>
        {loadingPop ? (
          <div className="space-y-2">{[1,2,3].map((i) => <CardSkeleton key={i} />)}</div>
        ) : popular.length > 0 ? (
          <div className="space-y-2">
            {popular.map((r) => (
              <ProductCard key={r.id} r={r} getQty={getQty} onAdd={onAdd} onUpdate={onUpdate} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 py-2">No products found nearby</p>
        )}
      </section>

    </div>
  )
}

// ── Main SearchPage ─────────────────────────────────────────────────────────

export default function SearchPage() {
  const [searchParams] = useSearchParams()

  const initialQ      = searchParams.get('q') || ''
  const categoryId    = searchParams.get('category') || ''
  const categoryLabel = searchParams.get('name') || ''

  const [q, setQ]             = useState(initialQ)
  const [mode, setMode]       = useState<'fast' | 'cost' | 'list'>('fast')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const { lat, lng }          = useLocationStore()
  const { carts, addItem, updateQty } = useCartStore()
  const items    = carts.flatMap((c) => c.items)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Core fetch ────────────────────────────────────────────────────────────

  const load = (textQ = q, currentMode = mode) => {
    setLoading(true)
    if (categoryId && !textQ.trim()) {
      const browseMode = currentMode === 'list' ? 'fast' : currentMode
      productApi
        .browse(lat, lng, browseMode, { category_id: categoryId, radius: '15', limit: '40' })
        .then((res) => setResults(res.data.data ?? []))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else if (textQ.trim()) {
      const extra: Record<string, string> = { mode: currentMode, radius: '15', limit: '30' }
      if (categoryId) extra.category_id = categoryId
      productApi
        .search(textQ.trim(), lat, lng, extra)
        .then((res) => setResults(res.data.data.results ?? []))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setResults([])
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!q.trim() && !categoryId) { setResults([]); return }
    const timer = setTimeout(() => load(q, mode), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  useEffect(() => {
    if (categoryId || q.trim()) load(q, mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ── Cart helpers ──────────────────────────────────────────────────────────

  const getQty = (spId: string) => items.find((i) => i.shopProductId === spId)?.quantity ?? 0

  const handleAdd = (r: SearchResult) => {
    addItem({
      shopProductId:  r.id,
      productId:      r.product_id,
      shopId:         r.shop_id,
      shopName:       r.shop_name,
      name:           r.product_name,
      unit:           r.unit,
      unit_value:     r.unit_value,
      price:          r.price,
      discount_price: r.discount_price,
      quantity:       1,
      image_url:      r.image_url,
    })
    toast.success(`${r.product_name} added`)
  }

  const isCategoryBrowse = !!categoryId && !q.trim()
  const hasResults       = results.length > 0
  const showDiscovery    = !q.trim() && !categoryId

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">

      {/* Category breadcrumb */}
      {categoryLabel && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Browsing</span>
          <span className="inline-flex items-center gap-1.5 bg-brand-50 border border-brand-100
                           text-brand-600 text-xs font-bold px-3 py-1 rounded-full">
            {categoryLabel}
          </span>
          {isCategoryBrowse && hasResults && (
            <span className="text-xs text-gray-400 ml-1">{results.length} products nearby</span>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          ref={inputRef}
          className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 text-sm
                     focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white shadow-sm"
          placeholder={categoryLabel ? `Search within ${categoryLabel}…` : 'Search tomatoes, milk, eggs…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
            onClick={() => { setQ(''); if (categoryId) { load('', mode) } else { setResults([]) } }}
          >
            ×
          </button>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'fast' as const, icon: Zap,        label: 'Fast'  },
          { key: 'cost' as const, icon: DollarSign, label: 'Cheap' },
          { key: 'list' as const, icon: List,       label: 'All'   },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={clsx(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
              mode === key
                ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
            )}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
        {!isCategoryBrowse && hasResults && (
          <span className="ml-auto text-xs text-gray-400 self-center">{results.length} results</span>
        )}
      </div>

      {/* ── Content ── */}
      {showDiscovery ? (
        /* Empty query — show discovery */
        <DiscoveryView
          lat={lat}
          lng={lng}
          onChipClick={(name) => { setQ(name); setTimeout(() => load(name, mode), 0) }}
          getQty={getQty}
          onAdd={handleAdd}
          onUpdate={updateQty}
        />

      ) : loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map((i) => <CardSkeleton key={i} />)}
        </div>

      ) : hasResults ? (
        <div className="space-y-2">
          {results.map((r) => (
            <ProductCard
              key={r.id}
              r={r}
              getQty={getQty}
              onAdd={handleAdd}
              onUpdate={updateQty}
            />
          ))}
        </div>

      ) : isCategoryBrowse ? (
        <div className="card p-14 text-center">
          <div className="text-5xl mb-4">🏪</div>
          <div className="font-bold text-gray-700">No {categoryLabel} products nearby</div>
          <div className="text-sm text-gray-400 mt-1.5">Shops may be closed or outside your area</div>
        </div>

      ) : (
        <div className="card p-14 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <div className="font-bold text-gray-700">No results for "{q}"</div>
          <div className="text-sm text-gray-400 mt-1.5">Try a different spelling or broader term</div>
        </div>
      )}
    </div>
  )
}
