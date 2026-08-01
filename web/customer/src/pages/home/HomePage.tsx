import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap, IndianRupee, Store, MapPin, Star, Clock,
  Tag, Plus, Minus, ChevronRight, Package,
  ArrowRight, Shield, RefreshCw, Lock,
} from 'lucide-react'
import { shopApi, productApi, getImgUrl } from '../../services/api'
import { useLocationStore } from '../../store/locationStore'
import { useCartStore } from '../../store/cartStore'
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
    key:     'fast',
    label:   'Fast Delivery',
    sub:     'Get your order in 10–30 minutes',
    icon:    Zap,
    iconBg:  'bg-orange-500',
  },
  {
    key:     'cost',
    label:   'Low Cost',
    sub:     'Best prices & offers on every order',
    icon:    IndianRupee,
    iconBg:  'bg-yellow-400',
  },
  {
    key:     'list',
    label:   'Browse Shops',
    sub:     'All nearby shops in one place',
    icon:    Store,
    iconBg:  'bg-green-500',
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

// Cloudinary auto-generates letter-avatar images (200 OK) when no real photo is uploaded.
// We detect them by checking if the URL contains known avatar/placeholder patterns.
function isRealImage(url: string | null | undefined): boolean {
  if (!url) return false
  // Skip Cloudinary auto-generated avatars (they contain text overlays or avatar in path)
  if (url.includes('/avatar') || url.includes('l_text') || url.includes('placeholder')) return false
  return true
}

function ProductCard({ product, mode }: { product: BrowseProduct; mode: string }) {
  const { addItem, updateQty, carts } = useCartStore()
  const hasDiscount = product.discount_price && product.discount_price < product.price
  const discountPct = hasDiscount ? Math.round((1 - product.discount_price! / product.price) * 100) : 0
  const { ref: qtyRef, trigger: bumpQty } = useQtyBump()
  const [imgError, setImgError] = useState(false)

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

  const handleInc = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQty(product.id, qty + 1); bumpQty() }
  const handleDec = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQty(product.id, qty - 1); bumpQty() }

  const imgUrl = !imgError && isRealImage(product.image_url) ? getImgUrl(product.image_url) : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col shrink-0 w-44 overflow-hidden">

      {/* ── Image area ── */}
      <div className="h-36 relative flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 overflow-hidden">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={product.product_name}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-6xl group-hover:scale-110 transition-transform duration-200 select-none drop-shadow">
            {catEmoji(product.category_name)}
          </span>
        )}

        {/* Discount badge */}
        {hasDiscount && discountPct > 0 && (
          <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
            {discountPct}% OFF
          </span>
        )}

        {/* Delivery time */}
        <span className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
          <Clock size={8} /> {product.delivery_time_min}m
        </span>
      </div>

      {/* ── Info ── */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-[10px] text-grad font-bold uppercase tracking-wider truncate">
          {product.category_name}
        </p>
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mt-0.5 flex-1">
          {product.product_name}
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5 truncate">
          {product.unit_value} {product.unit}{product.brand ? ` · ${product.brand}` : ''}
        </p>

        {/* Price + Add */}
        <div className="flex items-center justify-between gap-1 mt-3">
          <div>
            <p className="font-bold text-gray-900 text-base leading-none">
              ₹{Number(product.effective_price).toFixed(0)}
            </p>
            {hasDiscount && (
              <p className="text-[11px] text-gray-400 line-through leading-tight">
                ₹{Number(product.price).toFixed(0)}
              </p>
            )}
          </div>

          {qty === 0 ? (
            <RippleButton
              onClick={handleAdd}
              className="shrink-0 flex items-center gap-1 bg-grad
                         text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shadow-sm"
            >
              <Plus size={12} /> Add
            </RippleButton>
          ) : (
            <div className="flex items-center gap-1.5 bg-grad rounded-xl px-2 py-1.5 shrink-0">
              <RippleButton onClick={handleDec} className="text-white flex items-center justify-center">
                <Minus size={12} />
              </RippleButton>
              <span ref={qtyRef} className="w-4 text-center text-xs font-bold text-white">{qty}</span>
              <RippleButton onClick={handleInc} className="text-white flex items-center justify-center">
                <Plus size={12} />
              </RippleButton>
            </div>
          )}
        </div>

        {/* Shop */}
        <Link
          to={`/shop/${product.shop_id}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-400 hover:text-orange-500 truncate transition-colors"
        >
          🏪 {product.shop_name}
        </Link>
      </div>
    </div>
  )
}

// ─── Shop Card ────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, { emoji: string; bg: string }> = {
  grocery:   { emoji: '🛒', bg: 'from-orange-50 via-amber-50  to-yellow-50' },
  vegetable: { emoji: '🥦', bg: 'from-green-50  via-emerald-50 to-teal-50'  },
  dairy:     { emoji: '🥛', bg: 'from-blue-50   via-sky-50    to-cyan-50'   },
}

function ShopCard({ shop }: { shop: Shop }) {
  const cat = CATEGORY_EMOJI[shop.zone_category] ?? { emoji: '🏪', bg: 'from-orange-50 via-amber-50 to-yellow-50' }

  const logoUrl = !isRealImage(shop.logo_url) ? null : getImgUrl(shop.logo_url)

  return (
    <Link
      to={`/shop/${shop.id}`}
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-row shrink-0 w-72 h-32"
    >
      {/* ── Image (left) ── */}
      <div className={`w-32 h-32 shrink-0 relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${cat.bg}`}>
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

      {/* ── Info (right) ── */}
      <div className="flex flex-col justify-between flex-1 min-w-0 p-3">
        {/* Top: name + open dot */}
        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <h3 className="font-bold text-gray-900 text-sm leading-tight truncate flex-1">{shop.name}</h3>
            {shop.is_open && (
              <span className="shrink-0 w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-200" />
            )}
          </div>

          {/* Badge */}
          {Array.isArray(shop.badges) && shop.badges.filter(Boolean).length > 0 && (
            <span className="inline-block bg-orange-50 text-orange-600 text-[9px] px-2 py-0.5 rounded-full font-semibold border border-orange-100">
              {BADGE_ICONS[shop.badges.filter(Boolean)[0]] || '⭐'} {shop.badges.filter(Boolean)[0].replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Middle: rating + time + distance */}
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

        {/* Bottom: min order + delivery fee */}
        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-50">
          <span className="text-gray-400">Min ₹{shop.minimum_order}</span>
          <span className="font-semibold text-orange-500">Del ₹{shop.delivery_fee}</span>
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
          <div className="h-36 bg-amber-50" />
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
    // Always fetch both shops AND products for the two separate sections
    Promise.all([
      shopApi.getNearby(lat, lng, { radius: '15', limit: '20' }),
      productApi.browse(lat, lng, mode === 'list' ? 'fast' : mode, { radius: '15', limit: '20' }),
    ])
      .then(([shopRes, prodRes]) => {
        setShops(shopRes.data.data.shops)
        setProducts(prodRes.data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lat, lng, mode])

  const productHeading = mode === 'cost' ? '💰 Lowest Prices' : mode === 'list' ? '🏪 All Shop Products' : '🔥 Popular Products'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">

      {/* ── Hero ── */}
      <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 35%, #f97316 65%, #f59e0b 100%)' }}>
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-8 left-20 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative flex items-center justify-between gap-4 p-6 sm:p-8">

          {/* Left: text */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">
              Minutes away,
            </h1>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-yellow-200 leading-tight tracking-tight mb-3">
              every day.
            </h1>
            <p className="text-white/80 text-sm mb-6 max-w-xs leading-relaxed">
              Fresh groceries, fast delivery, better prices from local shops.
            </p>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 bg-white/20 border border-white/30 text-white px-3 py-1.5 rounded-full font-medium">
                <Zap size={11} /> 10–30 min delivery
              </span>
              <span className="flex items-center gap-1.5 bg-white/20 border border-white/30 text-white px-3 py-1.5 rounded-full font-medium">
                <Package size={11} /> 1000+ products
              </span>
              <span className="flex items-center gap-1.5 bg-white/20 border border-white/30 text-white px-3 py-1.5 rounded-full font-medium">
                <Star size={11} fill="currentColor" className="text-yellow-300" /> 4.5+ rated
              </span>
            </div>
          </div>

          {/* Right: food illustration */}
          <div className="hidden sm:flex flex-col items-center justify-center shrink-0 w-52 h-44 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-[100px] leading-none drop-shadow-lg">🧺</div>
            </div>
            <div className="absolute bottom-2 flex gap-1 text-3xl">
              <span>🥦</span><span>🍅</span><span>🥛</span><span>🍌</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Shopping modes ── */}
      <div>
        <h2 className="section-title mb-3">How do you want to shop?</h2>
        <div className="grid grid-cols-3 gap-3">
          {MODES.map(({ key, label, sub, icon: Icon, iconBg }) => (
            <button
              key={key}
              onClick={() => setMode(key as typeof mode)}
              className={clsx(
                'flex items-center gap-3 p-4 rounded-2xl transition-all duration-200 text-left border shadow-sm',
                mode === key
                  ? 'bg-white border-red-300 shadow-md shadow-red-100'
                  : 'bg-white border-gray-100 hover:border-red-200'
              )}
            >
              <div className={clsx('w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-md', iconBg)}>
                <Icon size={24} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900 leading-tight">{label}</p>
                <p className="text-xs mt-0.5 leading-tight text-gray-400">{sub}</p>
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-colors"
                style={mode === key ? { background: 'linear-gradient(135deg, #dc2626, #f59e0b)', border: 'none' } : { background: '#f9fafb', border: '1px solid #e5e7eb' }}
              >
                <ArrowRight size={14} className={mode === key ? 'text-white' : 'text-gray-400'} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Categories ── */}
      {categories.length > 0 && mode !== 'list' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Shop by Category</h2>
            <Link to="/search" className="text-sm text-brand-500 hover:text-brand-600 font-semibold flex items-center gap-0.5">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
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

      {/* ── Shops carousel — Browse Shops mode only ── */}
      {mode === 'list' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">🏪 All Nearby Shops</h2>
            <Link to="/shops" className="text-xs text-red-500 font-semibold flex items-center gap-0.5 hover:text-red-600">
              View all <ChevronRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="shrink-0 w-72 h-32 card overflow-hidden animate-pulse flex flex-row">
                  <div className="w-32 h-32 bg-amber-50 shrink-0" />
                  <div className="flex-1 p-3 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : shops.length === 0 ? (
            <EmptyState icon="🏪" title="No shops nearby" sub="Try updating your location" />
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Products carousel — Fast & Low Cost modes ── */}
      {mode !== 'list' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">{productHeading}</h2>
            <Link to="/search" className="text-xs text-red-500 font-semibold flex items-center gap-0.5 hover:text-red-600">
              View all <ChevronRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="shrink-0 w-44 card overflow-hidden animate-pulse">
                  <div className="h-36 bg-amber-50" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState icon={mode === 'cost' ? '💰' : '🔥'} title="No products nearby" sub="Shops may be outside your delivery zone" />
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {products.map((p) => <ProductCard key={p.id} product={p} mode={mode} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Trust badges ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        {[
          { icon: <Shield size={20} className="text-brand-500" />, title: 'Best Quality',      sub: 'Fresh & hygienic products' },
          { icon: <span className="text-xl">🛵</span>,              title: 'On-time Delivery',  sub: 'Superfast to your door' },
          { icon: <RefreshCw size={20} className="text-brand-500" />, title: 'Easy Returns',   sub: 'Not satisfied? Return easily' },
          { icon: <Lock size={20} className="text-brand-500" />,    title: 'Secure Payments',  sub: '100% secure & trusted' },
        ].map(({ icon, title, sub }) => (
          <div key={title} className="flex items-start gap-3">
            <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <p className="font-bold text-sm text-gray-800">{title}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-tight">{sub}</p>
            </div>
          </div>
        ))}
      </div>

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
