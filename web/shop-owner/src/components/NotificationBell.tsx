import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell, X, CheckCheck, ShoppingBag } from 'lucide-react'
import { notificationApi } from '../services/api'
import clsx from 'clsx'

interface Notification {
  id: string
  title: string
  body: string
  type: string
  is_read: boolean
  sent_at: string
}

// ─── Component ────────────────────────────────────────────────────────────────
// Note: new-order alerts are handled by <NewOrderAlert> in Layout.
// This bell shows the persistent notification history (billing, suspensions, etc.)
export default function NotificationBell() {
  const [open, setOpen]            = useState(false)
  const [notifications, setNotifs] = useState<Notification[]>([])
  const [unread, setUnread]        = useState(0)
  const [loading, setLoading]      = useState(false)
  const [browserBlocked, setBrowserBlocked] = useState(false)
  const dropdownRef                = useRef<HTMLDivElement>(null)
  const pollTimer                  = useRef<ReturnType<typeof setInterval>>()

  // Admin notification types shown in the bell
  const ADMIN_TYPES = new Set([
    'payment_due', 'payment_overdue',
    'shop_suspended', 'shop_approved',
    'low_stock',
  ])

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await notificationApi.getAll()
      // Show only admin-sent notifications here; order alerts use NewOrderAlert
      const all: Notification[] = res.data.data || []
      const adminOnly = all.filter((n) => ADMIN_TYPES.has(n.type))
      setNotifs(adminOnly)
      setUnread(adminOnly.filter((n) => !n.is_read).length)
    } catch {}
  }, [])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'denied') {
      setBrowserBlocked(true)
    }
    fetchNotifs()
    pollTimer.current = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(pollTimer.current)
  }, [fetchNotifs])

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
    if ('Notification' in window && Notification.permission === 'default') {
      const perm = await Notification.requestPermission()
      setBrowserBlocked(perm === 'denied')
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
        title={browserBlocked ? 'Notifications (browser popups blocked)' : 'Notifications'}
      >
        <Bell size={20} className={browserBlocked ? 'text-gray-400' : 'text-gray-600'} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white
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

          {browserBlocked && (
            <div className="px-4 py-2.5 bg-yellow-50 border-b border-yellow-100 text-xs text-yellow-700">
              Browser pop-ups are blocked. Enable in settings for extra alerts.
            </div>
          )}

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
                  <div className={clsx(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                    n.type === 'order_placed' ? 'bg-orange-100' : 'bg-gray-100'
                  )}>
                    <ShoppingBag size={16} className={n.type === 'order_placed' ? 'text-orange-500' : 'text-gray-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm leading-snug', !n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.sent_at)}</p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" />
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
