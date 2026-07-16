import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckSquare, ChevronRight, RefreshCw, Search, Square, X } from 'lucide-react'
import { orderApi, riderApi } from '../../services/api'
import { getSocket } from '../../services/socketService'
import { useShopStore } from '../../store/shopStore'
import type { Order, Rider } from '../../types'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import Pagination from '../../components/Pagination'

const STATUS_FLOW: Record<string, string> = {
  pending:          'confirmed',
  confirmed:        'packed',
  packed:           'assigned',
  assigned:         'picked_up',
  picked_up:        'out_for_delivery',
  out_for_delivery: 'delivered',
}

const STATUS_LABEL: Record<string, string> = {
  pending:          'Confirm Order',
  confirmed:        'Mark as Packed',
  packed:           'Assign Rider',
  assigned:         'Mark Picked Up',
  picked_up:        'Out for Delivery',
  out_for_delivery: 'Mark Delivered',
}

const badgeClass: Record<string, string> = {
  pending:          'badge-yellow',
  confirmed:        'badge-blue',
  packed:           'badge-blue',
  assigned:         'badge-orange',
  picked_up:        'badge-orange',
  out_for_delivery: 'badge-orange',
  delivered:        'badge-green',
  cancelled:        'badge-red',
}

export default function OrdersPage() {
  const { shop }  = useShopStore()
  const [orders, setOrders]     = useState<Order[]>([])
  const [riders, setRiders]     = useState<Rider[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('active')
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<Order | null>(null)
  const [riderId, setRiderId]   = useState('')
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [refreshing, setRefreshing]       = useState(false)
  const [checkedIds, setCheckedIds]       = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading]     = useState(false)
  const [page, setPage]   = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 20
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback((silent = false, p?: number) => {
    if (!shop) return
    const currentPage = p ?? page
    if (!silent) setLoading(true)
    else setRefreshing(true)
    const statusMap: Record<string, string> = {
      active:    'pending,confirmed,packed,assigned,picked_up,out_for_delivery',
      delivered: 'delivered',
      cancelled: 'cancelled',
    }
    orderApi.getShopOrders({ status: statusMap[filter] || statusMap.active, page: String(currentPage), limit: String(LIMIT) })
      .then((res) => { setOrders(res.data.data); setTotal(res.data.total ?? 0) })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [shop, filter, page])

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1); load(false, 1) }, [shop, filter])  // eslint-disable-line react-hooks/exhaustive-deps

  // Poll every 30 s as fallback
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => load(true), 30_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load])

  // Real-time: listen for new orders via Socket.IO
  useEffect(() => {
    const socket = getSocket()
    const handler = (data: { order_number: string; customer: string; total: number }) => {
      toast.success(`🛒 New order #${data.order_number} from ${data.customer}!`, { duration: 6000 })
      setFilter('active')   // switch to active tab if on another tab
      load(true)            // refresh list immediately
    }
    socket.on('new_order', handler)
    return () => { socket.off('new_order', handler) }
  }, [load])

  useEffect(() => {
    if (shop?.id) {
      riderApi.getShopRiders()
        .then((res) => setRiders(res.data.data))
        .catch(() => {})
    }
  }, [shop?.id])

  const handleAdvance = async (order: Order) => {
    const next = STATUS_FLOW[order.status]
    if (!next) return
    // Require a rider to be selected before assigning
    if (order.status === 'packed' && !riderId) {
      toast.error('Please select an on-duty rider before assigning')
      return
    }
    try {
      await orderApi.updateStatus(order.id, next, order.status === 'packed' ? riderId : undefined)
      toast.success(`Order updated to ${next}`)
      load()
      setSelected(null)
    } catch {}
  }

  const handleCancel = async (order: Order) => {
    try {
      await orderApi.updateStatus(order.id, 'cancelled')
      toast.success(`Order #${order.order_number} cancelled`)
      setCancelConfirm(false)
      setSelected(null)
      setFilter('cancelled')   // switch tab so user can see the cancelled order
    } catch (e: any) {
      setCancelConfirm(false)
      toast.error(e?.response?.data?.message || 'Could not cancel order')
    }
  }

  const filtered = orders.filter((o) =>
    o.order_number?.includes(search) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase())
  )

  // ── Bulk helpers ────────────────────────────────────────────────────────
  const checkedOrders  = filtered.filter((o) => checkedIds.has(o.id))
  // The status all checked orders must share — null when nothing is checked
  const lockedStatus   = checkedOrders.length > 0 ? checkedOrders[0].status : null

  const toggleCheck = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation()
    // If a status is already locked in, reject orders of a different status
    if (lockedStatus !== null && order.status !== lockedStatus) {
      toast.error(`Can only select "${lockedStatus.replace(/_/g, ' ')}" orders together`)
      return
    }
    setCheckedIds((prev) => {
      const next = new Set(prev)
      next.has(order.id) ? next.delete(order.id) : next.add(order.id)
      return next
    })
  }

  // "Select all" only targets orders that share the locked status
  // (or the first order's status when nothing is checked yet)
  const toggleAll = () => {
    const targetStatus = lockedStatus || filtered[0]?.status
    if (!targetStatus) return
    const eligible = filtered.filter((o) => o.status === targetStatus)
    const allSelected = eligible.every((o) => checkedIds.has(o.id))
    if (allSelected) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(eligible.map((o) => o.id)))
    }
  }

  const clearChecked = () => setCheckedIds(new Set())

  const bulkStatus      = lockedStatus
  const bulkNextStatus  = bulkStatus && bulkStatus !== 'packed' ? STATUS_FLOW[bulkStatus] : null
  const allCancellable  = checkedOrders.every((o) => ['pending', 'confirmed', 'packed'].includes(o.status))

  // Orders that CAN'T be checked right now (different status from lock)
  const isCheckDisabled = (order: Order) => lockedStatus !== null && order.status !== lockedStatus

  const handleBulkAdvance = async () => {
    if (!bulkNextStatus) return
    setBulkLoading(true)
    try {
      await Promise.all(
        checkedOrders.map((o) => orderApi.updateStatus(o.id, STATUS_FLOW[o.status]))
      )
      toast.success(`${checkedOrders.length} orders updated to ${bulkNextStatus.replace('_', ' ')}`)
      clearChecked()
      load()
    } catch {
      toast.error('Some orders could not be updated')
      load()
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkCancel = async () => {
    if (!window.confirm(`Cancel ${checkedOrders.length} orders?`)) return
    setBulkLoading(true)
    try {
      await Promise.all(checkedOrders.map((o) => orderApi.updateStatus(o.id, 'cancelled')))
      toast.success(`${checkedOrders.length} orders cancelled`)
      clearChecked()
      setFilter('cancelled')
      load()
    } catch {
      toast.error('Some orders could not be cancelled')
      load()
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>

      {/* Filter tabs */}
      <div className="card p-3 flex flex-wrap gap-2 items-center">
        {['active', 'delivered', 'cancelled'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors',
              filter === f ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {f}
          </button>
        ))}
        <button
          onClick={() => load()}
          title="Refresh orders"
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
        >
          <RefreshCw size={15} className={clsx(refreshing && 'animate-spin')} />
        </button>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input className="input pl-9 w-52" placeholder="Search orders..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Bulk action bar */}
      {checkedIds.size > 0 && (
        <div className="card p-3 flex items-center gap-3 bg-brand-50 border border-brand-200">
          <button onClick={clearChecked} className="p-1 rounded hover:bg-brand-100 text-brand-600">
            <X size={16} />
          </button>
          <span className="text-sm font-semibold text-brand-700">{checkedIds.size} selected</span>
          <div className="flex gap-2 ml-auto">
            {bulkNextStatus && (
              <button
                onClick={handleBulkAdvance}
                disabled={bulkLoading}
                className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
              >
                {bulkLoading ? 'Updating…' : `${STATUS_LABEL[bulkStatus!]} all`}
              </button>
            )}
            {allCancellable && (
              <button
                onClick={handleBulkCancel}
                disabled={bulkLoading}
                className="btn-danger text-sm py-1.5 px-4 disabled:opacity-50"
              >
                Cancel all
              </button>
            )}
            {!bulkNextStatus && !allCancellable && (
              <span className="text-xs text-gray-400 self-center">Mixed statuses — open each order to update</span>
            )}
          </div>
        </div>
      )}

      {/* Orders list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No orders</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Select-all row */}
            {(() => {
              const targetStatus = lockedStatus || filtered[0]?.status
              const eligible     = targetStatus ? filtered.filter((o) => o.status === targetStatus) : []
              const allSelected  = eligible.length > 0 && eligible.every((o) => checkedIds.has(o.id))
              return (
                <div className="flex items-center gap-3 px-5 py-2 bg-gray-50 border-b border-gray-100">
                  <button onClick={toggleAll} className="text-gray-400 hover:text-brand-600 transition-colors">
                    {allSelected
                      ? <CheckSquare size={18} className="text-brand-600" />
                      : <Square size={18} />}
                  </button>
                  <span className="text-xs text-gray-400 font-medium">
                    {allSelected
                      ? 'Deselect all'
                      : targetStatus
                        ? `Select all "${targetStatus.replace(/_/g, ' ')}" (${eligible.length})`
                        : 'Select all'}
                  </span>
                </div>
              )
            })()}

            {filtered.map((order) => {
              const isChecked  = checkedIds.has(order.id)
              const isDisabled = isCheckDisabled(order)
              return (
                <div key={order.id}
                  className={clsx(
                    'flex items-center gap-3 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors',
                    isChecked   && 'bg-brand-50 hover:bg-brand-50',
                    isDisabled  && 'opacity-50'
                  )}
                  onClick={() => { setSelected(order); setRiderId(''); setCancelConfirm(false) }}>
                  {/* Checkbox — click stops propagation so it doesn't open drawer */}
                  <button
                    onClick={(e) => toggleCheck(e, order)}
                    title={isDisabled ? `Only "${lockedStatus?.replace(/_/g, ' ')}" orders can be selected` : undefined}
                    className={clsx(
                      'shrink-0 transition-colors',
                      isDisabled ? 'cursor-not-allowed text-gray-200' : 'text-gray-300 hover:text-brand-600'
                    )}
                  >
                    {isChecked
                      ? <CheckSquare size={18} className="text-brand-600" />
                      : <Square size={18} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">#{order.order_number}</span>
                      <span className={badgeClass[order.status]}>{order.status.replace('_', ' ')}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {order.customer_name} · {order.items?.length || 0} items · ₹{order.total_amount}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="card px-4">
          <Pagination page={page} total={total} limit={LIMIT} onChange={(p) => { setPage(p); load(false, p) }} />
        </div>
      )}

      {/* Order detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-50">
          <div className="bg-white h-full w-full max-w-md overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-lg">Order #{selected.order_number}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            <div className="p-5 space-y-5">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className={clsx('text-sm font-semibold px-3 py-1.5 rounded-full', badgeClass[selected.status])}>
                  {selected.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(selected.created_at).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Customer */}
              <div className="card p-4 space-y-1">
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Customer</div>
                <div className="font-semibold">{selected.customer_name}</div>
                <div className="text-sm text-gray-500">{selected.customer_phone}</div>
                <div className="text-sm text-gray-500">
                  {typeof selected.delivery_address === 'object' && selected.delivery_address !== null
                    ? (selected.delivery_address as Record<string, string>).street || JSON.stringify(selected.delivery_address)
                    : selected.delivery_address}
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
                  Items ({selected.items?.length || 0})
                </div>
                <div className="card divide-y divide-gray-100 overflow-hidden">
                  {selected.items?.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      {/* Product image */}
                      {item.product_image ? (
                        <img
                          src={item.product_image}
                          alt={item.product_name}
                          className="w-11 h-11 rounded-xl object-cover border border-gray-100 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center text-lg">
                          📦
                        </div>
                      )}
                      {/* Name + unit */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 leading-snug">{item.product_name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {item.unit} × {item.quantity}
                          {item.quantity > 1 && (
                            <span className="ml-1 text-gray-300">@ ₹{item.unit_price} each</span>
                          )}
                        </div>
                      </div>
                      {/* Price */}
                      <span className="font-semibold text-sm shrink-0">₹{item.total_price}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-3 bg-gray-50 font-semibold text-sm">
                    <span>Total</span>
                    <span>₹{selected.total_amount}</span>
                  </div>
                </div>
              </div>

              {/* Assign rider if ready */}
              {selected.status === 'packed' && (
                <div>
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
                    Assign Rider <span className="text-red-500">*</span>
                  </div>
                  {riders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
                      No riders attached to this shop yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {riders.map((r) => {
                        const onDuty = r.is_on_duty
                        const selected_rider = riderId === r.id
                        return (
                          <button
                            key={r.id}
                            disabled={!onDuty}
                            onClick={() => onDuty && setRiderId(r.id)}
                            className={[
                              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                              selected_rider
                                ? 'border-brand-500 bg-brand-50'
                                : onDuty
                                ? 'border-gray-200 hover:border-brand-300 bg-white cursor-pointer'
                                : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed',
                            ].join(' ')}
                          >
                            {/* Avatar */}
                            <div className={[
                              'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
                              selected_rider ? 'bg-brand-500 text-white' : 'bg-gray-200 text-gray-600',
                            ].join(' ')}>
                              {r.name?.charAt(0).toUpperCase()}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm text-gray-900">{r.name}</div>
                              <div className="text-xs text-gray-500">{r.phone}</div>
                            </div>
                            {/* Duty badge */}
                            <span className={[
                              'text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0',
                              onDuty ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400',
                            ].join(' ')}>
                              {onDuty ? '● On Duty' : '○ Off Duty'}
                            </span>
                          </button>
                        )
                      })}
                      {riders.every((r) => !r.is_on_duty) && (
                        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                          ⚠️ No riders are currently on duty. Ask a rider to go on duty first.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {cancelConfirm ? (
                <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-700 text-center">
                    Cancel order #{selected.order_number}?
                  </p>
                  <p className="text-xs text-red-500 text-center">
                    Customer will be notified. This cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCancelConfirm(false)}
                      className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      ← Go back
                    </button>
                    <button
                      onClick={() => handleCancel(selected)}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-sm font-semibold transition-all"
                    >
                      Cancel order
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  {STATUS_FLOW[selected.status] && (
                    <button onClick={() => handleAdvance(selected)} className="btn-primary flex-1 justify-center">
                      {STATUS_LABEL[selected.status]}
                    </button>
                  )}
                  {['pending', 'confirmed', 'packed'].includes(selected.status) && (
                    <button onClick={() => setCancelConfirm(true)} className="btn-danger justify-center px-4">
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
