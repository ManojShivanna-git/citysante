import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { orderApi } from '../services/api'
import { TrendingUp, ChevronDown } from 'lucide-react'

type Period = 'weekly' | 'monthly' | 'yearly'

interface StatRow {
  label:   string
  orders:  number
  revenue: number
}

const PERIOD_LABELS: Record<Period, string> = {
  weekly:  'Last 7 Days',
  monthly: 'Last 4 Weeks',
  yearly:  'Last 12 Months',
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-brand-600">Orders: <span className="font-bold">{payload[0]?.value}</span></p>
      <p className="text-emerald-600">Revenue: <span className="font-bold">₹{Number(payload[1]?.value || 0).toFixed(0)}</span></p>
    </div>
  )
}

export default function OrdersChart() {
  const [period, setPeriod]   = useState<Period>('weekly')
  const [data, setData]       = useState<StatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState(false)

  useEffect(() => {
    setLoading(true)
    orderApi.getOrderStats(period)
      .then((res) => setData(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  const totalOrders  = data.reduce((s, r) => s + r.orders, 0)
  const totalRevenue = data.reduce((s, r) => s + Number(r.revenue), 0)

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-brand-500" />
          <h2 className="font-semibold text-gray-900">Orders Overview</h2>
        </div>

        {/* Period dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 bg-gray-100
                       hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors"
          >
            {PERIOD_LABELS[period]}
            <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          {open && (
            <div className="absolute right-0 top-10 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden min-w-[150px]">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPeriod(p); setOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                    ${period === p ? 'font-semibold text-brand-600 bg-brand-50' : 'text-gray-700'}`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-4 mb-5">
        <div className="flex-1 bg-brand-50 rounded-xl px-4 py-3">
          <p className="text-xs text-brand-500 font-medium">Total Orders</p>
          <p className="text-xl font-bold text-brand-700 mt-0.5">{totalOrders}</p>
        </div>
        <div className="flex-1 bg-emerald-50 rounded-xl px-4 py-3">
          <p className="text-xs text-emerald-500 font-medium">Total Revenue</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5">₹{totalRevenue.toFixed(0)}</p>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex items-center justify-center h-52">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 || totalOrders === 0 ? (
        <div className="flex flex-col items-center justify-center h-52 text-gray-400 gap-2">
          <TrendingUp size={32} className="text-gray-200" />
          <span className="text-sm">No order data for this period</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-gray-500 capitalize">{value}</span>
              )}
              wrapperStyle={{ paddingTop: 12 }}
            />
            <Bar dataKey="orders"  name="Orders"  fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={40} />
            <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
