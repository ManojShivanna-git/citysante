import { useEffect, useState } from 'react'
import { ShoppingBag, Store, Users, AlertCircle, TrendingUp, Clock } from 'lucide-react'
import { adminApi } from '../../services/api'
import StatCard from '../../components/StatCard'
import type { DashboardStats } from '../../types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getDashboard()
      .then((res) => setStats(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of Isanthe platform</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Orders"
          value={stats?.orders.today ?? 0}
          subtitle={`${stats?.orders.pending ?? 0} active / in-progress`}
          icon={ShoppingBag}
          color="green"
        />
        <StatCard
          title="Active Shops"
          value={stats?.shops.active ?? 0}
          subtitle={`${stats?.shops.pending ?? 0} awaiting review`}
          icon={Store}
          color="blue"
        />
        <StatCard
          title="Total Users"
          value={stats?.users.total ?? 0}
          subtitle={`${stats?.users.customers ?? 0} customers`}
          icon={Users}
          color="purple"
        />
        <StatCard
          title="Overdue Bills"
          value={stats?.billing.overdue_count ?? 0}
          subtitle={`₹${Number(stats?.billing.total_pending ?? 0).toLocaleString('en-IN')} pending`}
          icon={AlertCircle}
          color="red"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly orders chart — real data from DB */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Orders — Last 7 Days</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Total this week: {stats?.weekly_orders?.reduce((s, d) => s + d.orders, 0) ?? 0} orders
              </p>
            </div>
            <span className="badge badge-green flex items-center gap-1">
              <TrendingUp size={12} /> Live data
            </span>
          </div>
          {(stats?.weekly_orders?.length ?? 0) === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No orders in the last 7 days yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.weekly_orders ?? []} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} orders`, 'Orders']} />
                <Bar dataKey="orders" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick stats */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Platform Summary</h2>
          {[
            { label: 'Total Orders',        value: stats?.orders.total ?? 0,          color: 'text-green-600'  },
            { label: 'Delivered Today',     value: stats?.orders.delivered_today ?? 0, color: 'text-green-700' },
            { label: 'Total Shops',         value: stats?.shops.total ?? 0,           color: 'text-blue-600'   },
            { label: 'Pending Review',      value: stats?.shops.pending ?? 0,         color: 'text-yellow-600' },
            { label: 'Suspended Shops',     value: stats?.shops.suspended ?? 0,       color: 'text-orange-600' },
            { label: 'Shop Owners',         value: stats?.users.shop_owners ?? 0,     color: 'text-purple-600' },
            { label: 'Riders',              value: stats?.users.riders ?? 0,          color: 'text-indigo-600' },
            { label: 'Overdue Shops',       value: stats?.billing.overdue_count ?? 0, color: 'text-red-600'    },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className={`font-bold text-sm ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pending shops alert */}
      {(stats?.shops.pending ?? 0) > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <Clock className="text-yellow-600 shrink-0" size={20} />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              {stats?.shops.pending} shop{(stats?.shops.pending ?? 0) > 1 ? 's' : ''} waiting for approval
            </p>
            <p className="text-xs text-yellow-600 mt-0.5">
              Review them in the Shops section to get them live.
            </p>
          </div>
          <a href="/shops?status=pending" className="ml-auto text-sm font-medium text-yellow-700 hover:underline">
            Review →
          </a>
        </div>
      )}
    </div>
  )
}
