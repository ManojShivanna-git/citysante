import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Star, Clock, MapPin, Plus, Minus, ShoppingCart } from 'lucide-react'
import { shopApi } from '../../services/api'
import { useCartStore } from '../../store/cartStore'
import type { ShopProduct } from '../../types'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import RippleButton from '../../components/RippleButton'
import { useQtyBump } from '../../hooks/useQtyBump'

interface Menu { id: string; name: string; products: ShopProduct[] }
interface ShopDetail {
  id: string; name: string; description: string; logo_url: string | null
  address: string; city: string; state: string; pincode: string
  lat: number | null; lng: number | null
  delivery_fee: number; minimum_order: number; delivery_time_min: number
  delivery_time_max: number; rating: number; total_reviews: number
  is_open: boolean; badges: string[]; menu: Menu[]
}

declare global { interface Window { L: any } }

function ShopMap({ lat, lng, name, address }: { lat: number; lng: number; name: string; address: string }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const inst   = useRef<any>(null)

  useEffect(() => {
    const L = window.L
    if (!L || !mapRef.current || inst.current) return

    const map = L.map(mapRef.current, { scrollWheelZoom: false, zoomControl: true }).setView([lat, lng], 16)
    inst.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map)

    const icon = L.divIcon({
      className: '',
      html: `<div style="background:#f97316;width:32px;height:32px;border-radius:50% 50% 50% 0;
               transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
      iconSize: [32, 32], iconAnchor: [16, 32],
    })

    L.marker([lat, lng], { icon })
      .addTo(map)
      .bindPopup(`<strong>${name}</strong><br/><span style="font-size:12px;color:#6b7280">${address}</span>`)
      .openPopup()

    return () => { map.remove(); inst.current = null }
  }, [lat, lng, name, address])

  return <div ref={mapRef} style={{ height: 200, borderRadius: 12, overflow: 'hidden', zIndex: 0 }} />
}

// ─── Product Row ──────────────────────────────────────────────────────────────

function ProductRow({
  p, shopOpen, onAdd, getQty, updateQty,
}: {
  p: ShopProduct
  shopOpen: boolean
  onAdd: (p: ShopProduct) => void
  getQty: (id: string) => number
  updateQty: (id: string, qty: number) => void
}) {
  const qty     = getQty(p.id)
  const hasDisc = p.discount_price && p.discount_price < p.price
  const { ref: qtyRef, trigger: bumpQty } = useQtyBump()

  return (
    <div
      className={clsx(
        'card flex items-center gap-3 p-3 transition-all duration-150',
        !p.is_available ? 'opacity-50' : 'hover:shadow-md hover:-translate-y-px'
      )}
    >
      {/* Image */}
      <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-gray-100">
        {p.image_url
          ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
          : <span className="text-2xl">📦</span>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-gray-900 leading-snug line-clamp-1">{p.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {p.unit_value} {p.unit}
          {p.brand && <span className="text-gray-300"> · {p.brand}</span>}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-bold text-gray-900 text-sm">₹{p.discount_price ?? p.price}</span>
          {hasDisc && (
            <>
              <span className="text-xs text-gray-400 line-through">₹{p.price}</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                {Math.round((1 - p.discount_price! / p.price) * 100)}% OFF
              </span>
            </>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0">
        {!p.is_available ? (
          <span className="text-xs text-red-500 font-semibold bg-red-50 px-2 py-1 rounded-lg">
            Out of stock
          </span>
        ) : qty === 0 ? (
          <RippleButton
            onClick={() => onAdd(p)}
            disabled={!shopOpen}
            className="flex items-center gap-1 bg-brand-500 hover:bg-brand-600
                       text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors
                       shadow-sm shadow-brand-200 disabled:opacity-40"
          >
            <Plus size={13} /> Add
          </RippleButton>
        ) : (
          <div className="flex items-center gap-1.5 bg-brand-50 rounded-xl px-1.5 py-1">
            <RippleButton
              onClick={() => { updateQty(p.id, qty - 1); bumpQty() }}
              rippleColor="rgba(220,38,38,0.25)"
              className="w-7 h-7 bg-white border border-brand-200 text-brand-600 rounded-lg
                         flex items-center justify-center hover:bg-brand-100 shadow-sm"
            >
              <Minus size={13} />
            </RippleButton>
            <span ref={qtyRef} className="font-bold w-5 text-center text-sm text-brand-700">{qty}</span>
            <RippleButton
              onClick={() => { updateQty(p.id, qty + 1); bumpQty() }}
              className="w-7 h-7 bg-brand-500 text-white rounded-lg
                         flex items-center justify-center hover:bg-brand-600 shadow-sm"
            >
              <Plus size={13} />
            </RippleButton>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shop Page ────────────────────────────────────────────────────────────────

export default function ShopPage() {
  const { id }  = useParams<{ id: string }>()
  const [shop, setShop]         = useState<ShopDetail | null>(null)
  const [loading, setLoading]   = useState(true)
  const [activeCategory, setActiveCategory] = useState('')
  const { carts, addItem, updateQty } = useCartStore()
  const items = carts.flatMap((c) => c.items)
  // Cart bar shows the WHOLE cart total (all shops), not just this shop's —
  // the customer may already have items from another shop in their cart.
  const cartCount = items.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = items.reduce((s, i) => s + (i.discount_price ?? i.price) * i.quantity, 0)

  useEffect(() => {
    if (!id) return
    shopApi.getById(id)
      .then((res) => {
        setShop(res.data.data)
        setActiveCategory(res.data.data.menu?.[0]?.id || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const getQty = (spId: string) => items.find((i) => i.shopProductId === spId)?.quantity || 0

  const handleAdd = (p: ShopProduct) => {
    if (!shop) return
    addItem({
      shopProductId: p.id, productId: p.product_id, shopId: shop.id, shopName: shop.name,
      name: p.name, unit: p.unit, unit_value: p.unit_value,
      price: p.price, discount_price: p.discount_price, quantity: 1, image_url: p.image_url,
    })
    toast.success(`${p.name} added to cart`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!shop) return <div className="text-center py-20 text-gray-400">Shop not found</div>

  return (
    <div className="max-w-7xl mx-auto">
      {/* Shop header */}
      <div className="bg-gradient-to-br from-red-600 via-red-500 to-yellow-400 text-white px-4 pt-6 pb-5 relative overflow-hidden">
        {/* Decorative */}
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full pointer-events-none" />

        <div className="relative flex items-center gap-4">
          <div className="w-18 h-18 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl shrink-0 border border-white/20 shadow-lg w-16 h-16">
            {shop.logo_url
              ? <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover rounded-2xl" />
              : '🏪'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold leading-tight">{shop.name}</h1>
              {shop.is_open
                ? <span className="text-[10px] font-bold bg-green-400 text-green-900 px-2 py-0.5 rounded-full">OPEN</span>
                : <span className="text-[10px] font-bold bg-red-400/80 text-white px-2 py-0.5 rounded-full">CLOSED</span>
              }
            </div>
            {shop.description && (
              <p className="text-white/75 text-sm mt-0.5 line-clamp-1">{shop.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-white/80">
              <span className="flex items-center gap-1">
                <Star size={11} fill="currentColor" className="text-yellow-300" />
                <span className="font-semibold text-white">{shop.rating || '—'}</span>
                {shop.total_reviews > 0 && <span>({shop.total_reviews})</span>}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {shop.delivery_time_min}–{shop.delivery_time_max} min
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-2 mt-4 relative">
          {[
            { label: 'Delivery', value: `₹${shop.delivery_fee}` },
            { label: 'Min order', value: `₹${shop.minimum_order}` },
            { label: 'Reviews', value: shop.total_reviews || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex-1 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center border border-white/10">
              <div className="font-bold text-sm">{value}</div>
              <div className="text-[10px] text-white/70 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Badges */}
        {Array.isArray(shop.badges) && shop.badges.filter(Boolean).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 relative">
            {shop.badges.filter(Boolean).map((b: string) => (
              <span key={b} className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20">
                {b === 'citysante_verified' ? '✓ Verified' : b === 'zones_best' ? '🏆 Zone\'s Best' :
                 b === 'top_seller' ? '🔥 Top Seller' : b === 'fast_delivery' ? '⚡ Fast Delivery' : b}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      {shop.lat && shop.lng && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-500">
            <MapPin size={12} className="text-brand-600" />
            <span>{shop.address}, {shop.city}</span>
          </div>
          <ShopMap
            lat={Number(shop.lat)}
            lng={Number(shop.lng)}
            name={shop.name}
            address={`${shop.address}, ${shop.city}`}
          />
        </div>
      )}

      {/* Category tabs */}
      {shop.menu.length > 0 && (
        <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4">
          <div className="flex gap-1.5 overflow-x-auto py-3 scrollbar-hide">
            {shop.menu.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id)
                  document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={clsx(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0',
                  activeCategory === cat.id
                    ? 'bg-brand-500 text-white shadow-sm shadow-brand-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                )}
              >
                {cat.name}
                <span className={clsx('ml-1.5', activeCategory === cat.id ? 'text-white/70' : 'text-gray-400')}>
                  {cat.products.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div className="px-4 py-4 space-y-8 pb-32">
        {shop.menu.map((cat) => (
          <div key={cat.id} id={`cat-${cat.id}`}>
            <h2 className="section-title mb-3 flex items-center gap-2">
              {cat.name}
              <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {cat.products.length} items
              </span>
            </h2>
            <div className="space-y-2">
              {cat.products.map((p) => (
                <ProductRow
                  key={p.id}
                  p={p}
                  shopOpen={shop.is_open}
                  onAdd={handleAdd}
                  getQty={getQty}
                  updateQty={updateQty}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none">
          <div className="max-w-7xl mx-auto">
            <Link
              to="/cart"
              className="flex items-center justify-between bg-brand-500 hover:bg-brand-600 active:scale-[0.99]
                         text-white px-5 py-4 rounded-2xl shadow-2xl shadow-brand-300 pointer-events-auto
                         transition-all duration-150"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-xl w-8 h-8 flex items-center justify-center text-sm font-bold border border-white/20">
                  {cartCount}
                </div>
                <div>
                  <div className="font-bold text-sm leading-tight">View Cart</div>
                  <div className="text-white/70 text-[10px]">{cartCount} item{cartCount > 1 ? 's' : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg">₹{cartTotal.toFixed(0)}</span>
                <ShoppingCart size={18} className="opacity-80" />
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
