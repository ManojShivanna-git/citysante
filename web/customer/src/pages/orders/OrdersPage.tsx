import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, ChevronRight } from 'lucide-react'
import { orderApi } from '../../services/api'
import { getSocket } from '../../services/socketService'
import type { Order } from '../../types'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import Pagination from '../../components/Pagination'

const STATUS_COLOR: Record<string, string> = {
  pending:          'badge-yellow',
  confirmed:        'badge-blue',
  packed:           'badge-blue',
  assigned:         'badge-orange',
  picked_up:        'badge-orange',
  out_for_delivery: 'badge-orange',
  delivered:        'badge-green',
  cancelled:        'badge-red',
}

const STATUS_ICON: Record<string, string> = {
  pending:          '⏳',
  confirmed:        '✅',
  packed:           '📦',
  assigned:         '🛵',
  picked_up:        '🛵',
  out_for_delivery: '🚀',
  delivered:        '🎉',
  cancelled:        '❌',
}

export default function OrdersPage() {
  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('active')
  const [page, setPage]       = useState(1)
  const [total, setTotal]     = useState(0)
  const LIMIT = 10
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback((silent = false, p?: number) => {
    if (!silent) setLoading(true)
    const currentPage = p ?? page
    const statusMap: Record<string, string> = {
      active:    'pending,confirmed,packed,assigned,picked_up,out_for_delivery',
      delivered: 'delivered',
      cancelled: 'cancelled',
    }
    orderApi.getMyOrders({ status: statusMap[filter], page: String(currentPage), limit: String(LIMIT) })
      .then((res) => { setOrders(res.data.data); setTotal(res.data.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter, page])

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1); load(false, 1) }, [filter])  // eslint-disable-line react-hooks/exhaustive-deps

  // Poll every 30 s as fallback
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => load(true), 30_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load])

  // Real-time: update order status instantly via Socket.IO
  useEffect(() => {
    const socket = getSocket()
    const handler = (data: { order_id: string; order_number: string; status: string }) => {
      // Update matching order in the list immediately (optimistic)
      setOrders((prev) => prev.map((o) =>
        o.id === data.order_id ? { ...o, status: data.status as Order['status'] } : o
      ))
      // If the order's new status moves it to a different tab, reload
      const activeStatuses = ['pending','confirmed','packed','assigned','picked_up','out_for_delivery']
      if (data.status === 'cancelled') {
        toast.error(`Order #${data.order_number} was cancelled`, { duration: 6000 })
        if (filter === 'active') load(true)   // remove from active list
      } else if (data.status === 'delivered' && filter === 'active') {
        load(true)   // remove from active, move to delivered
      } else if (activeStatuses.includes(data.status) && filter !== 'active') {
        load(true)
      }
    }
    socket.on('order_status_changed', handler)
    return () => { socket.off('order_status_changed', handler) }
  }, [filter, load])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">My Orders</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {['active', 'delivered', 'cancelled'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx('px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors',
              filter === f ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600')}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-16 text-center">
          <Package size={48} className="mx-auto text-gray-200 mb-3" />
          <div className="font-semibold text-gray-600">No {filter} orders</div>
          {filter === 'active' && (
            <Link to="/" className="btn-primary mt-4 mx-auto">Start Shopping</Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link key={order.id} to={`/orders/${order.id}`}
              className="card p-4 hover:shadow-md transition-shadow block">
              {/* Top row: order number + status */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{STATUS_ICON[order.status] || '📦'}</span>
                  <span className="font-bold text-sm">#{order.order_number}</span>
                  <span className={STATUS_COLOR[order.status]}>{order.status.replace(/_/g, ' ')}</span>
                </div>
                <ChevronRight size={16} className="text-gray-400 shrink-0" />
              </div>

              {/* Shop row */}
              <div className="flex items-center gap-2 mb-3">
                {order.shop_logo ? (
                  <img src={order.shop_logo} alt={order.shop_name}
                    className="w-8 h-8 rounded-lg object-cover border border-gray-100" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-base">🏪</div>
                )}
                <span className="text-sm font-semibold text-gray-800">{order.shop_name}</span>
              </div>

              {/* Products list with images */}
              {order.items && order.items.length > 0 && (
                <div className="bg-gray-50 rounded-xl px-3 py-2 mb-2 space-y-2">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {/* Product image */}
                      {item.product_image ? (
                        <img src={item.product_image} alt={item.product_name}
                          className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center text-sm shrink-0">📦</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-700 truncate">{item.product_name}</div>
                        <div className="text-xs text-gray-400">× {item.quantity}</div>
                      </div>
                      <span className="text-xs font-semibold text-gray-700 shrink-0">₹{item.subtotal ?? item.total_price}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer: total + date */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
                <span className="font-semibold text-gray-700">Total ₹{order.total_amount}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {total > LIMIT && (
        <Pagination page={page} total={total} limit={LIMIT}
          onChange={(p) => { setPage(p); load(false, p) }} />
      )}
    </div>
  )
}
