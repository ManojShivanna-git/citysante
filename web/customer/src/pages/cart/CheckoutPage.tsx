/**
 * CheckoutPage
 *
 * Delivery address is set ONLY via the map picker — no manual text form.
 * Flow:
 *   "Add from Map" → MapPickerModal → auto-save address + select it
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, ShoppingBag, Check, Info, Map } from 'lucide-react'
import { orderApi, addressApi, shopApi } from '../../services/api'
import { useCartStore } from '../../store/cartStore'
import toast from 'react-hot-toast'
import MapPickerModal, { type MapPickResult } from '../../components/MapPickerModal'

interface Address {
  id: string; label: string; street: string
  city: string | null; state: string | null; pincode: string | null
  lat: number | null; lng: number | null; is_default: boolean
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { carts, total, clearCart } = useCartStore()
  const [addresses, setAddresses]   = useState<Address[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [placing, setPlacing]       = useState(false)
  const [mapOpen, setMapOpen]             = useState(false)
  const [savingAddr, setSavingAddr]       = useState(false)
  // Detail fields shown after map pick (before saving)
  const [pendingMapPick, setPendingMapPick] = useState<MapPickResult | null>(null)
  const [pickHouseNo,   setPickHouseNo]   = useState('')
  const [pickFloor,     setPickFloor]     = useState('')
  const [pickTower,     setPickTower]     = useState('')
  const [pickLandmark,  setPickLandmark]  = useState('')
  const [deliveryFees, setDeliveryFees]   = useState<Record<string, number>>({})

  // Fetch delivery fee for each shop in cart
  useEffect(() => {
    const shopIds = carts.map((c) => c.shopId)
    Promise.all(
      shopIds.map((id) => shopApi.getById(id).then((r) => ({ id, fee: Number(r.data.data?.delivery_fee ?? 0) })))
    )
      .then((results) => {
        const map: Record<string, number> = {}
        results.forEach(({ id, fee }) => { map[id] = fee })
        setDeliveryFees(map)
      })
      .catch(() => {})
  }, [carts])

  const totalDelivery = carts.reduce((sum, c) => sum + (deliveryFees[c.shopId] ?? 0), 0)
  const grandTotal    = total() + totalDelivery

  useEffect(() => { if (carts.length === 0) navigate('/cart') }, [carts])

  useEffect(() => {
    addressApi.getAll()
      .then((res) => {
        const addrs: Address[] = res.data.data || []
        setAddresses(addrs)
        const def = addrs.find((a) => a.is_default) || addrs[0]
        if (def) setSelectedId(def.id)
      })
      .catch(() => {})
  }, [])

  // Map picker → store pending pick, show detail fields
  const handleMapPick = (result: MapPickResult) => {
    setPendingMapPick(result)
    setPickHouseNo(''); setPickFloor(''); setPickTower(''); setPickLandmark('')
  }

  // After filling detail fields → save the address
  const savePickedAddress = async () => {
    if (!pendingMapPick) return
    if (!pickHouseNo.trim()) { toast.error('House / Flat No is required'); return }
    setSavingAddr(true)
    try {
      const details = [
        pickHouseNo.trim(),
        pickFloor.trim() && `Floor ${pickFloor.trim()}`,
        pickTower.trim() && `Tower ${pickTower.trim()}`,
      ].filter(Boolean).join(', ')
      const street = details ? `${details}, ${pendingMapPick.street}` : pendingMapPick.street

      const res = await addressApi.create({
        label:      'Home',
        street,
        city:       pendingMapPick.city,
        state:      pendingMapPick.state,
        pincode:    pendingMapPick.pincode,
        lat:        pendingMapPick.lat,
        lng:        pendingMapPick.lng,
        is_default: addresses.length === 0,
        ...(pickLandmark.trim() ? { landmark: pickLandmark.trim() } : {}),
      })
      const saved: Address = res.data.data
      setAddresses((prev) => [...prev, saved])
      setSelectedId(saved.id)
      setPendingMapPick(null)
      toast.success('Address added!')
    } catch {
      toast.error('Could not save address')
    } finally {
      setSavingAddr(false)
    }
  }

  const handlePlace = async () => {
    const addr = addresses.find((a) => a.id === selectedId)
    if (!addr) { toast.error('Please pick a delivery address'); return }

    setPlacing(true)
    try {
      const deliveryAddress = `${addr.street}${addr.city ? ', ' + addr.city : ''}`
      const placedOrders: string[] = []

      for (const cart of carts) {
        const res = await orderApi.place({
          shop_id:          cart.shopId,
          items:            cart.items.map((i) => ({ shop_product_id: i.shopProductId, quantity: i.quantity })),
          delivery_address: deliveryAddress,
          delivery_lat:     addr.lat ?? 12.9330,
          delivery_lng:     addr.lng ?? 77.6230,
          payment_method:   'cod',
          notes:            '',
        })
        if (res.data.data?.id) placedOrders.push(res.data.data.id)
      }

      clearCart()
      const count = placedOrders.length
      toast.success(count > 1 ? `${count} orders placed!` : 'Order placed!')
      if (count === 1) navigate(`/orders/${placedOrders[0]}`)
      else navigate('/orders')
    } catch {
      toast.error('Failed to place order')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <>
      <MapPickerModal open={mapOpen} onClose={() => setMapOpen(false)} onConfirm={handleMapPick} />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <h1 className="text-2xl font-bold">Checkout</h1>

        {/* Split order notice */}
        {carts.length > 1 && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              {carts.length} separate orders will be placed — one per shop. You'll pay COD separately for each.
            </p>
          </div>
        )}

        {/* ── Delivery address ─────────────────────────────────── */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <MapPin size={18} className="text-brand-600" /> Delivery Address
          </h2>

          {/* Saved addresses */}
          {addresses.map((addr) => (
            <label key={addr.id}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                selectedId === addr.id
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
              <input type="radio" className="mt-1 accent-brand-600"
                checked={selectedId === addr.id}
                onChange={() => setSelectedId(addr.id)} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{addr.label}</span>
                  {addr.is_default && (
                    <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-md font-medium">Default</span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-0.5">{addr.street}</div>
                {(addr.city || addr.pincode) && (
                  <div className="text-xs text-gray-400">
                    {[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </label>
          ))}

          {/* Detail form shown after map pick */}
          {pendingMapPick && (
            <div className="space-y-3 border border-brand-200 rounded-2xl p-4 bg-brand-50">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-brand-700">📍 Location picked</p>
                  <p className="text-xs text-brand-600 mt-0.5">{pendingMapPick.street}</p>
                </div>
                <button onClick={() => { setPendingMapPick(null); setMapOpen(true) }}
                  className="text-xs text-brand-600 hover:text-brand-800 font-medium shrink-0">Change</button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  House / Flat No <span className="text-red-500">*</span>
                </label>
                <input className="input text-sm" placeholder="e.g. Flat 302, Villa 7"
                  value={pickHouseNo} onChange={(e) => setPickHouseNo(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Floor</label>
                  <input className="input text-sm" placeholder="e.g. 3rd"
                    value={pickFloor} onChange={(e) => setPickFloor(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tower / Block</label>
                  <input className="input text-sm" placeholder="e.g. Tower B"
                    value={pickTower} onChange={(e) => setPickTower(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Landmark</label>
                <input className="input text-sm" placeholder="e.g. Near City Mall"
                  value={pickLandmark} onChange={(e) => setPickLandmark(e.target.value)} />
              </div>

              <button onClick={savePickedAddress} disabled={savingAddr}
                className="btn-primary w-full justify-center text-sm py-2.5">
                {savingAddr ? 'Saving…' : 'Use this Address'}
              </button>
            </div>
          )}

          {/* Add address via map */}
          {!pendingMapPick && (
            <button onClick={() => setMapOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                         border-2 border-dashed border-brand-300 text-sm text-brand-600
                         hover:bg-brand-50 transition-colors font-medium">
              <Map size={14} />
              {addresses.length === 0 ? 'Pick Delivery Address on Map' : '+ Add Another Address'}
            </button>
          )}
        </div>

        {/* ── Order summary ────────────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <ShoppingBag size={18} className="text-brand-600" /> Order Summary
          </h2>
          {carts.map((cart) => (
            <div key={cart.shopId} className="space-y-2">
              {carts.length > 1 && (
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cart.shopName}</div>
              )}
              {cart.items.map((item) => (
                <div key={item.shopProductId} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.name} × {item.quantity}</span>
                  <span className="font-medium">₹{(item.discount_price ?? item.price) * item.quantity}</span>
                </div>
              ))}
            </div>
          ))}

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Items subtotal</span><span>₹{total().toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>🛵 Delivery charge</span>
              <span className={totalDelivery === 0 ? 'text-green-600 font-medium' : ''}>
                {Object.keys(deliveryFees).length === 0 ? '—' : totalDelivery === 0 ? 'FREE' : `₹${totalDelivery}`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2">
              <span>Grand Total</span><span>₹{grandTotal.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* ── Payment method ───────────────────────────────────── */}
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Payment Method</h2>
          <div className="flex items-center gap-3 p-3 bg-brand-50 border-2 border-brand-500 rounded-xl">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Check size={16} className="text-white" />
            </div>
            <div>
              <div className="font-medium text-sm">Cash on Delivery</div>
              <div className="text-xs text-gray-500">
                {carts.length > 1 ? 'Pay separately for each order on arrival' : 'Pay when your order arrives'}
              </div>
            </div>
          </div>
        </div>

        <button onClick={handlePlace} disabled={placing || !selectedId}
          className="btn-primary w-full justify-center py-4 text-base">
          {placing
            ? 'Placing Order...'
            : `Place ${carts.length > 1 ? `${carts.length} Orders` : 'Order'} · ₹${grandTotal.toFixed(0)}`}
        </button>
      </div>
    </>
  )
}
