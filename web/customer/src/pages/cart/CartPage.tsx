import { useNavigate, Link } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight, Info, Store } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'
import RippleButton from '../../components/RippleButton'

export default function CartPage() {
  const { carts, updateQty, removeItem, clearShopCart, clearCart, shopTotal, total } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  const grandTotal = total()

  if (carts.length === 0) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
        <ShoppingCart size={40} className="text-gray-300" />
      </div>
      <h2 className="text-xl font-bold text-gray-700">Your cart is empty</h2>
      <p className="text-gray-400 text-sm mt-2">Add some groceries to get started</p>
      <Link to="/" className="btn-primary mt-6 mx-auto">Browse Shops</Link>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Cart</h1>
        <button onClick={() => { if (confirm('Clear cart?')) clearCart() }}
          className="text-sm text-red-500 hover:underline">Clear all</button>
      </div>

      {/* Split order notice — cart spans more than one shop */}
      {carts.length > 1 && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Items from {carts.length} shops — this will place {carts.length} separate orders, each with its own delivery and COD payment.
          </p>
        </div>
      )}

      {/* Per-shop sections */}
      {carts.map((cart) => (
        <div key={cart.shopId} className="space-y-2">
          <div className="flex items-center justify-between">
            <Link to={`/shop/${cart.shopId}`} className="flex items-center gap-2 hover:text-brand-600">
              <Store size={15} className="text-brand-600" />
              <span className="font-semibold text-sm">{cart.shopName}</span>
            </Link>
            <button
              onClick={() => { if (confirm(`Remove all items from ${cart.shopName}?`)) clearShopCart(cart.shopId) }}
              className="text-xs text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>

          <div className="card divide-y divide-gray-100">
            {cart.items.map((item) => (
              <div key={item.shopProductId} className="flex items-center gap-3 p-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-xl shrink-0">
                  {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover rounded-xl" /> : '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.name}</div>
                  <div className="text-xs text-gray-400">{item.unit_value} {item.unit}</div>
                  <div className="text-sm font-bold text-brand-700 mt-0.5">
                    ₹{(item.discount_price ?? item.price) * item.quantity}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RippleButton
                    onClick={() => updateQty(item.shopProductId, item.quantity - 1)}
                    rippleColor="rgba(220,38,38,0.2)"
                    className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200"
                  >
                    {item.quantity === 1 ? <Trash2 size={13} className="text-red-400" /> : <Minus size={13} />}
                  </RippleButton>
                  <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
                  <RippleButton
                    onClick={() => updateQty(item.shopProductId, item.quantity + 1)}
                    className="w-7 h-7 bg-brand-600 text-white rounded-lg flex items-center justify-center hover:bg-brand-700"
                  >
                    <Plus size={13} />
                  </RippleButton>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-sm px-1">
            <span className="text-gray-500">Subtotal ({cart.shopName})</span>
            <span className="font-semibold text-gray-700">₹{shopTotal(cart.shopId).toFixed(0)}</span>
          </div>
        </div>
      ))}

      {/* Grand total */}
      <div className="card p-4 space-y-1">
        <div className="flex justify-between font-bold text-gray-900">
          <span>Grand Total</span>
          <span>₹{grandTotal.toFixed(0)}</span>
        </div>
        <p className="text-xs text-gray-400">
          {carts.length} order{carts.length > 1 ? 's' : ''} · delivery fee added per shop at checkout
        </p>
        <p className="text-xs text-gray-400">💵 Cash on Delivery only</p>
      </div>

      {/* Checkout button */}
      <RippleButton
        onClick={() => isAuthenticated ? navigate('/checkout') : navigate('/login')}
        className="btn-primary w-full justify-between py-4 text-base shadow-lg shadow-brand-200"
      >
        <span className="font-bold">{isAuthenticated ? 'Proceed to Checkout' : 'Login to Checkout'}</span>
        <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-1.5">
          <span className="font-extrabold">₹{grandTotal.toFixed(0)}</span>
          <ArrowRight size={18} />
        </div>
      </RippleButton>
    </div>
  )
}
