import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBag, X, ChevronRight } from 'lucide-react'
import { orderApi } from '../services/api'

interface PendingOrder {
  id: string
  order_number: string
  total_amount: string | number
  customer_name: string
}

// ─── Play a gentle alert chime via Web Audio API ─────────────────────────────
function playChime() {
  try {
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)

    const notes = [523.25, 659.25, 783.99] // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18)
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + i * 0.18 + 0.04)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.18 + 0.32)
      osc.start(ctx.currentTime + i * 0.18)
      osc.stop(ctx.currentTime + i * 0.18 + 0.35)
    })
  } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function NewOrderAlert() {
  const navigate = useNavigate()

  // Queue of new orders waiting to be shown
  const [queue, setQueue] = useState<PendingOrder[]>([])
  // IDs we've already seen (persists across polls)
  const seenIds = useRef<Set<string>>(new Set())
  // Auto-dismiss timer
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>()

  // The order currently shown (front of queue)
  const current = queue[0] ?? null

  // ── Poll every 15 s for new pending orders ──────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const res = await orderApi.getShopOrders({ status: 'pending' })
      const orders: PendingOrder[] = res.data.data || []

      // Find orders we haven't seen before
      const newOnes = orders.filter((o) => !seenIds.current.has(o.id))
      newOnes.forEach((o) => seenIds.current.add(o.id))

      if (newOnes.length > 0) {
        setQueue((prev) => [...prev, ...newOnes])
        playChime()
      }
    } catch {}
  }, [])

  useEffect(() => {
    // Seed seen IDs on first load so existing pending orders don't trigger alerts
    orderApi.getShopOrders({ status: 'pending' })
      .then((res) => {
        const orders: PendingOrder[] = res.data.data || []
        orders.forEach((o) => seenIds.current.add(o.id))
      })
      .catch(() => {})

    const interval = setInterval(poll, 15_000)
    return () => clearInterval(interval)
  }, [poll])

  // ── Auto-dismiss after 40 s of inaction ────────────────────────────────────
  useEffect(() => {
    clearTimeout(dismissTimer.current)
    if (current) {
      dismissTimer.current = setTimeout(() => dismiss(), 40_000)
    }
    return () => clearTimeout(dismissTimer.current)
  }, [current])

  const dismiss = () => setQueue((prev) => prev.slice(1))

  const goToOrders = () => {
    dismiss()
    navigate('/orders')
  }

  if (!current) return null

  return (
    /* Full-screen semi-transparent backdrop */
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop — click to dismiss */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={dismiss}
      />

      {/* Alert card */}
      <div className="relative w-full max-w-sm mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-bounceIn">
        {/* Orange top bar */}
        <div className="h-1.5 bg-gradient-to-r from-orange-400 to-orange-600" />

        {/* Dismiss ×  */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <X size={14} className="text-gray-500" />
        </button>

        <div className="px-7 pt-8 pb-7 flex flex-col items-center text-center gap-4">
          {/* Pulsing icon */}
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-orange-400 opacity-30 animate-ping" />
            <div className="relative w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
              <ShoppingBag size={28} className="text-white" />
            </div>
          </div>

          {/* Text */}
          <div>
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest mb-1">
              New Order Received
            </p>
            <h2 className="text-2xl font-extrabold text-gray-900">
              #{current.order_number}
            </h2>
            <p className="mt-1 text-gray-500 text-sm">
              {current.customer_name}
            </p>
            <p className="mt-0.5 text-xl font-bold text-gray-800">
              ₹{Number(current.total_amount).toFixed(2)}
            </p>
          </div>

          {/* Queue badge — e.g. "2 more waiting" */}
          {queue.length > 1 && (
            <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-3 py-1 rounded-full">
              {queue.length - 1} more waiting
            </span>
          )}

          {/* Actions */}
          <button
            onClick={goToOrders}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95
                       text-white font-bold py-3.5 rounded-2xl transition-all duration-150 shadow-md shadow-orange-200"
          >
            View Orders
            <ChevronRight size={18} />
          </button>

          <button
            onClick={dismiss}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
