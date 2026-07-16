import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell, X, CheckCheck, Package, CreditCard, ShoppingBag } from 'lucide-react'
import { notificationApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import clsx from 'clsx'

interface Notification {
  id: string
  title: string
  body: string
  type: string
  is_read: boolean
  sent_at: string
  reference_id?: string
}

// Map notification type to icon + colour
function NotifIcon({ type }: { type: string }) {
  // DB stores enum values: order_placed, order_confirmed … rider_assigned, rider_picked_up …
  if (type.startsWith('order') || type.startsWith('rider')) {
    return (
      <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Package size={16} className="text-brand-500" />
      </div>
    )
  }
  if (type === 'payment_due' || type === 'shop_suspended') {
    return (
      <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <CreditCard size={16} className="text-red-500" />
      </div>
    )
  }
  return (
    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
      <ShoppingBag size={16} className="text-gray-500" />
    </div>
  )
}

export default function NotificationBell() {
  const { isAuthenticated } = useAuthStore()
  const [open, setOpen]            = useState(false)
  const [notifications, setNotifs] = useState<Notification[]>([])
  const [unread, setUnread]        = useState(0)
  const [loading, setLoading]      = useState(false)
  const dropdownRef                = useRef<HTMLDivElement>(null)
  const timerRef                   = useRef<ReturnType<typeof setInterval>>()

  const fetchNotifs = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await notificationApi.getAll()
      const prev = notifications
      const next: Notification[] = res.data.data || []

      // Show browser notification for any new unread items since last poll
      if ('Notification' in window && Notification.permission === 'granted' && prev.length > 0) {
        const prevIds = new Set(prev.map((n) => n.id))
        next.filter((n) => !prevIds.has(n.id) && !n.is_read).forEach((n) => {
          new Notification(n.title, { body: n.body, icon: '/favicon.ico', tag: n.id })
        })
      }

      setNotifs(next)
      setUnread(res.data.unread_count || 0)
    } catch {}
  }, [isAuthenticated, notifications])

  useEffect(() => {
    if (!isAuthenticated) return
    fetchNotifs()
    timerRef.current = setInterval(fetchNotifs, 30_000) // poll every 30 s
    return () => clearInterval(timerRef.current)
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const handleOpen = async () => {
    // Request browser permission on user gesture
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    setOpen((v) => !v)
    if (!open) {
      setLoading(true)
      await fetchNotifs()
      setLoading(false)
    }
  }

  const handleMarkAllRead = async () => {
    await notificationApi.markRead()
    setUnread(0)
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  if (!isAuthenticated) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors"
        title="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-yellow-400 text-gray-900
                           text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-bold text-sm text-gray-900">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                <Bell size={28} className="text-gray-200" />
                <span className="text-sm">No notifications yet</span>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={clsx(
                    'flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-default',
                    !n.is_read && 'bg-orange-50/60'
                  )}
                >
                  <NotifIcon type={n.type} />
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm leading-snug', !n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.sent_at)}</p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
