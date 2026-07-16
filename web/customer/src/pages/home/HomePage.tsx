import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap, DollarSign, List, MapPin, Star, Clock, Search,
  ShoppingCart, Tag, Plus, Minus, ChevronRight, Package,
} from 'lucide-react'
import { shopApi, productApi } from '../../services/api'
import { useLocationStore } from '../../store/locationStore'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'
import RippleButton from '../../components/RippleButton'
import { useQtyBump } from '../../hooks/useQtyBump'
import type { Shop, Category } from '../../types'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrowseProduct {
  id: string
  price: number
  discount_price: number | null
  effective_price: number
  stock_qty: number
  product_id: string
  product_name: string
  image_url: string | null
  unit: string
  unit_value: string
  brand: string | null
  category_name: string
  shop_id: string
  shop_name: string
  delivery_time_min: number
  delivery_time_max: number
  delivery_fee: number
  distance: number
  rating: number
}

// ─── Modes ───────────────────────────────────────────────────────────────────

const MODES = [
  {
    key:   'fast',
    label: 'Fast Delivery',
    sub:   'Nearest first',
    icon:  Zap,
    active:   'bg-blue-500 text-white shadow-md shadow-blue-200',
    inactive: 'bg-white text-gray-600 border border-gray-200 hover:border-blue-200 hover:bg-blue-50',
    dot:   'bg-blue-500',
  },
  {
    key:   'cost',
    label: 'Low Cost',
    sub:   'Cheapest first',
    icon:  DollarSign,
    active:   'bg-emerald-500 text-white shadow-md shadow-emerald-200',
    inactive: 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-200 hover:bg-emerald-50',
    dot:   'bg-emerald-500',
  },
  {
    key:   'list',
    label: 'Browse Shops',
    sub:   'All nearby shops',
    icon:  List,
    active:   'bg-purple-500 text-white shadow-md shadow-purple-200',
    inactive: 'bg-white text-gray-600 border border-gray-200 hover:border-purple-200 hover:bg-purple-50',
    dot:   'bg-purple-500',
  },
]

const BADGE_ICONS: Record<string, string> = {
  citysante_verified: '✓',
  zones_best:         '🏆',
  top_seller:         '🔥',
  fast_delivery:      '⚡',
}

const CAT_EMOJI: Record<string, string> = {
  Dairy:   '🥛', Vegetable: '🥦', Vegetables: '🥦', Fruits: '🍎', Fruit: '🍎',
  Grocery: '🛒', Beverages: '🥤', Beverage: '🥤', Snacks: '🍿', Snack: '🍿',
  Bakery:  '🍞', Bak: '🍞',
}
function catEmoji(name: string) {
  for (const [k, v] of Object.entries(CAT_EMOJI)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return v
  }
  return '📦'
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, mode }: { product: BrowseProduct; mode: string }) {
  const { addItem, updateQty, carts } = useCartStore()
  const hasDiscount = product.discount_price && product.discount_price < product.price
  const { ref: qtyRef, trigger: bumpQty } = useQtyBump()

  const qty = carts
    .find((c) => c.shopId === product.shop_id)
    ?.items.find((i) => i.shopProductId === product.id)
    ?.quantity ?? 0

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    addItem({
      shopProductId:  product.id,
      productId:      product.product_id,
      shopId:         product.shop_id,
      shopName:       product.shop_name,
      name:           product.product_name,
      price:          product.price,
      discount_price: product.discount_price,
      unit:           product.unit,
      unit_value:     product.unit_value,
      image_url:      product.image_url,
      quantity:       1,
    })
  }

  const handleInc = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    updateQty(product.id, qty + 1)
    bumpQty()
  }
  const handleDec = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    updateQty(product.id, qty - 1)
    bumpQty()
  }

  return (
    <div className="card-hover overflow-hidden group flex flex-col">
      {/* Image */}
      <div className="h-36 bg-gray-50 relative flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.product_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-300">
            <span className="text-4xl">📦</span>
          </div>
        )}

        {/* Mode badge */}
        {mode === 'fast' && (
          <span className="absolute top-2 left-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <Zap size={9} /> {product.delivery_time_min}–{product.delivery_time_max}m
          </span>
        )}
        {mode === 'cost' && hasDiscount && (
          <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <Tag size={9} /> Sale
          </span>
        )}

        {/* Discount % */}
        {hasDiscount && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
            {Math.round((1 - product.discount_price! / product.price) * 100)}% OFF
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        <p className="text-[10px] text-brand-500 font-semibold uppercase tracking-wide mb-0.5">
          {product.category_name}
        </p>
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">
          {product.product_name}
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">{product.unit_value} {product.unit}</p>

        {/* Price + qty control */}
        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="font-bold text-gray-900 text-sm">₹{Number(product.effective_price).toFixed(0)}</span>
            {hasDiscount && (
              <span className="text-xs text-gray-400 line-through ml-1.5">₹{Number(product.price).toFixed(0)}</span>
            )}
          </div>

          {qty === 0 ? (
            <RippleButton
              onClick={handleAdd}
              className="flex items-center gap-1 bg-brand-500 hover:bg-brand-600
                         text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-brand-200"
            >
              <Plus size={11} /> Add
            </RippleButton>
          ) : (
            <div className="flex items-center gap-1.5 bg-brand-50 rounded-lg px-1.5 py-1">
              <RippleButton
                onClick={handleDec}
                rippleColor="rgba(220,38,38,0.25)"
                className="w-6 h-6 rounded-md bg-white border border-brand-200 text-brand-600
                           flex items-center justify-center transition-colors hover:bg-brand-100 shadow-sm"
              >
                <Minus size={11} />
              </RippleButton>
              <span ref={qtyRef} className="w-5 text-center text-sm font-bold text-brand-700">{qty}</span>
              <RippleButton
                onClick={handleInc}
                className="w-6 h-6 rounded-md bg-brand-500 text-white
                           flex items-center justify-center transition-colors hover:bg-brand-600 shadow-sm"
              >
                <Plus size={11} />
              </RippleButton>
            </div>
          )}
        </div>

        {/* Shop */}
        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
          <Link
            to={`/shop/${product.shop_id}`}
            className="text-[10px] text-brand-500 hover:text-brand-600 hover:underline truncate max-w-[68%] font-semibold"
          >
            {product.shop_name}
          </Link>
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
            <Clock size={9} /> {product.delivery_time_min}m
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Shop Card ────────────────────────────────────────────────────────────────

function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Link to={`/shop/${shop.id}`} className="card-hover overflow-hidden block group">
      {/* Cover */}
      <div className="h-36 bg-gradient-to-br from-red-50 via-yellow-50 to-amber-50 relative overflow-hidden">
        {shop.logo_url ? (
          <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🏪</div>
        )}

        {/* Closed overlay */}
        {!shop.is_open && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
            <span className="text-white font-bold text-sm bg-black/60 px-4 py-1.5 rounded-full tracking-wide">
              CLOSED
            </span>
          </div>
        )}

        {/* Badges */}
        {Array.isArray(shop.badges) && shop.badges.filter(Boolean).length > 0 && (
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {shop.badges.filter(Boolean).slice(0, 2).map((b: string) => (
              <span key={b} className="bg-white/95 text-xs px-2 py-0.5 rounded-full font-semibold shadow-sm">
                {BADGE_ICONS[b] || '⭐'} {b.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Open dot */}
        {shop.is_open && (
          <span className="absolute top-2 right-2 flex items-center gap-1 bg-white/95 px-2 py-0.5 rounded-full text-[10px] font-semibold text-green-600 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Open
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-bold text-gray-900 leading-snug">{shop.name}</h3>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Star size={11} className="text-yellow-400" fill="currentColor" />
            <span className="font-semibold text-gray-700">{shop.rating || '—'}</span>
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock size={11} className="text-brand-400" />
            {shop.delivery_time_min}–{shop.delivery_time_max} min
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin size={11} className="text-gray-400" />
            {shop.distance ? `${shop.distance.toFixed(1)} km` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className="text-gray-400">Min ₹{shop.minimum_order}</span>
          <span className="text-gray-400">Del ₹{shop.delivery_fee}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card overflow-hidden animate-pulse">
          <div className="h-36 bg-gray-100" />
          <div className="p-3 space-y-2">
            <div className="h-2.5 bg-gray-100 rounded w-1/4" />
            <div className="h-4 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="flex justify-between items-center mt-3">
              <div className="h-5 bg-gray-100 rounded w-1/4" />
              <div className="h-7 bg-gray-100 rounded-lg w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { lat, lng, address, detect } = useLocationStore()
  const { isAuthenticated } = useAuthStore()
  const [shops, setShops]           = useState<Shop[]>([])
  const [products, setProducts]     = useState<BrowseProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [mode, setMode]             = useState<'fast' | 'cost' | 'list'>('fast')

  useEffect(() => {
    productApi.getCategories().then((res) => setCategories(res.data.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    if (mode === 'list') {
      shopApi.getNearby(lat, lng, { radius: '15', limit: '20' })
        .then((res) => { setShops(res.data.data.shops); setProducts([]) })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      productApi.browse(lat, lng, mode, { radius: '15', limit: '30' })
        .then((res) => { setProducts(res.data.data); setShops([]) })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [lat, lng, mode])

  const resultCount = mode === 'list' ? shops.length : products.length
  const modeObj     = MODES.find((m) => m.key === mode)!
  const headingText = mode === 'fast' ? '⚡ Fastest Near You'
                    : mode === 'cost' ? '💰 Lowest Prices'
                    : '🏪 All Nearby Shops'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">

      {/* ── Hero ── */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-red-600 via-red-500 to-yellow-400 text-white">
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/10 rounded-full" />
        <div className="absolute -bottom-12 -left-4 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute top-4 right-24 w-16 h-16 bg-white/5 rounded-full" />

        <div className="relative p-6 sm:p-8">
          {/* Location row */}
          <button
            onClick={detect}
            className="flex items-center gap-1.5 text-white/80 text-sm mb-4 hover:text-white transition-colors"
          >
            <MapPin size={14} />
            <span className="font-medium">{address}</span>
          </button>

          {/* Headline */}
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-1">
            Fresh groceries,
          </h1>
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-5 text-yellow-100">
            delivered fast. 🚀
          </h1>

          {/* Search box */}
          <Link
            to="/search"
            className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 text-gray-500
                       hover:shadow-lg transition-shadow group"
          >
            <Search size={18} className="text-brand-500 shrink-0" />
            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
              Search tomatoes, milk, eggs…
            </span>
          </Link>

          {/* Quick stats */}
          <div className="flex items-center gap-4 mt-5 text-white/80 text-xs">
            <span className="flex items-center gap-1"><Zap size={11} /> 10–30 min delivery</span>
            <span className="flex items-center gap-1"><Package size={11} /> 1000+ products</span>
            <span className="flex items-center gap-1"><Star size={11} fill="currentColor" /> 4.5+ rated</span>
          </div>
        </div>
      </div>

      {/* ── Shopping modes ── */}
      <div>
        <h2 className="section-title mb-3">How do you want to shop?</h2>
        <div className="grid grid-cols-3 gap-3">
          {MODES.map(({ key, label, sub, icon: Icon, active, inactive }) => (
            <button
              key={key}
              onClick={() => setMode(key as typeof mode)}
              className={clsx(
                'flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200',
                mode === key ? active : inactive
              )}
            >
              <Icon size={22} />
              <div className="text-center">
                <p className="text-xs font-bold leading-tight">{label}</p>
                <p className={clsx('text-[10px] leading-tight mt-0.5', mode === key ? 'text-white/70' : 'text-gray-400')}>
                  {sub}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Categories ── */}
      {categories.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Shop by Category</h2>
            <Link to="/search" className="text-sm text-brand-500 hover:text-brand-600 font-semibold flex items-center gap-1">
              All <ChevronRight size={14} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/search?category=${cat.id}&name=${encodeURIComponent(cat.name)}`}
                className="flex flex-col items-center gap-2 shrink-0 group"
              >
                <div className="w-16 h-16 bg-white border border-gray-100 rounded-2xl flex items-center justify-center text-2xl
                                shadow-sm group-hover:shadow-md group-hover:border-brand-200 group-hover:-translate-y-0.5
                                transition-all duration-200">
                  {catEmoji(cat.name)}
                </div>
                <span className="text-xs text-gray-600 font-semibold text-center w-16 leading-tight">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">{headingText}</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-semibold">
            {resultCount} {mode === 'list' ? 'shops' : 'items'}
          </span>
        </div>

        {loading ? (
          <Skeleton />
        ) : mode === 'list' ? (
          shops.length === 0 ? (
            <EmptyState
              icon="🏪"
              title="No shops nearby"
              sub="Try expanding your radius or updating your location"
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
            </div>
          )
        ) : (
          products.length === 0 ? (
            <EmptyState
              icon={mode === 'fast' ? '⚡' : '💰'}
              title="No products available nearby"
              sub="Shops may be closed or outside your delivery zone"
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => <ProductCard key={p.id} product={p} mode={mode} />)}
            </div>
          )
        )}
      </div>

      {/* ── Auth CTA (logged out only) ── */}
      {!isAuthenticated && (
        <div className="card p-6 flex flex-col sm:flex-row items-center gap-4 bg-gradient-to-r from-red-50 to-yellow-50 border-red-100">
          <div className="text-4xl shrink-0">🎁</div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-bold text-gray-900">Get exclusive deals</h3>
            <p className="text-sm text-gray-500 mt-0.5">Create an account to track orders, save addresses, and get notified about offers.</p>
          </div>
          <Link to="/register" className="btn-primary shrink-0">Sign Up Free</Link>
        </div>
      )}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="card p-14 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="font-bold text-gray-700 text-base">{title}</p>
      <p className="text-sm text-gray-400 mt-1.5 max-w-xs mx-auto">{sub}</p>
    </div>
  )
}
