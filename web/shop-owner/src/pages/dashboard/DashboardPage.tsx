import { useEffect, useState } from 'react'
import { ShoppingBag, Package, TrendingUp, AlertCircle, Star, Clock } from 'lucide-react'
import { orderApi, productApi } from '../../services/api'
import { useShopStore } from '../../store/shopStore'
import OrdersChart from '../../components/OrdersChart'
import type { Order, ShopProduct } from '../../types'
import clsx from 'clsx'

const statusColor: Record<string, string> = {
  pending:          'badge-yellow',
  confirmed:        'badge-blue',
  packed:           'badge-blue',
  assigned:         'badge-orange',
  picked_up:        'badge-orange',
  out_for_delivery: 'badge-orange',
  delivered:        'badge-green',
  cancelled:        'badge-red',
}

export default function DashboardPage() {
  const { shop } = useShopStore()
  const [orders, setOrders]    = useState<Order[]>([])
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    if (!shop) return
    Promise.all([
      orderApi.getShopOrders({ status: 'pending,confirmed,packed,assigned,picked_up,out_for_delivery', limit: '5' }),
      productApi.getShopProducts(shop.id, { available_only: 'false' }),
    ])
      .then(([ord, prod]) => {
        setOrders(ord.data.data)
        setProducts(prod.data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [shop?.id])

  const lowStock   = products.filter((p) => p.stock_qty > 0 && p.stock_qty <= p.low_stock_alert)
  const outOfStock = products.filter((p) => p.stock_qty === 0)
  const todayOrders = orders.length
  const pendingOrders = orders.filter((o) => o.status === 'pending').length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{shop?.name}</h1>
          <p className="text-gray-500 text-sm">{shop?.address}, {shop?.city}</p>
        </div>
        <div className={clsx('px-4 py-2 rounded-full font-semibold text-sm', shop?.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
          {shop?.is_open ? '🟢 Open' : '🔴 Closed'}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Orders',  value: todayOrders,           icon: ShoppingBag, color: 'bg-blue-50 text-blue-600'   },
          { label: 'Pending',        value: pendingOrders,         icon: Clock,       color: 'bg-yellow-50 text-yellow-600' },
          { label: 'Low Stock',      value: lowStock.length,       icon: AlertCircle, color: 'bg-orange-50 text-orange-600' },
          { label: 'Out of Stock',   value: outOfStock.length,     icon: Package,     color: 'bg-red-50 text-red-600'       },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">{label}</div>
                <div className="text-2xl font-bold mt-1">{value}</div>
              </div>
              <div className={clsx('p-3 rounded-xl', color)}><Icon size={20} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Shop info bar */}
      <div className="card p-4 flex flex-wrap gap-6">
        <div className="flex items-center gap-2 text-sm">
          <Star size={16} className="text-yellow-500" fill="currentColor" />
          <span className="font-semibold">{shop?.rating || '—'}</span>
          <span className="text-gray-400">rating</span>
        </div>
        <div className="text-sm"><span className="text-gray-400">Delivery fee: </span><span className="font-medium">₹{shop?.delivery_fee}</span></div>
        <div className="text-sm"><span className="text-gray-400">Min order: </span><span className="font-medium">₹{shop?.minimum_order}</span></div>
        <div className="text-sm"><span className="text-gray-400">Delivery time: </span><span className="font-medium">{shop?.delivery_time_min}–{shop?.delivery_time_max} min</span></div>
        <div className="text-sm"><span className="text-gray-400">Commission due: </span><span className="font-medium text-red-600">₹{shop?.commission_balance || 0}</span></div>
      </div>

      {/* Orders chart */}
      <OrdersChart />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active orders */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">Active Orders</h2>
            <a href="/orders" className="text-sm text-brand-600 hover:underline">View all →</a>
          </div>
          {orders.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No active orders</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {orders.slice(0, 5).map((order) => (
                <div key={order.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">#{order.order_number}</div>
                    <div className="text-xs text-gray-400">{order.customer_name} · ₹{order.total_amount}</div>
                  </div>
                  <span className={statusColor[order.status]}>{order.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock alerts */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">Stock Alerts</h2>
            <a href="/products" className="text-sm text-brand-600 hover:underline">Manage →</a>
          </div>
          {lowStock.length === 0 && outOfStock.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">All products well stocked ✓</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {[...outOfStock, ...lowStock].slice(0, 6).map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.unit_value} {p.unit}</div>
                  </div>
                  <span className={p.stock_qty === 0 ? 'badge-red' : 'badge-yellow'}>
                    {p.stock_qty === 0 ? 'Out of stock' : `${p.stock_qty} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
