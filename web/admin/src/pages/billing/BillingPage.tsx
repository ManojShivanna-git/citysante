import { useEffect, useState } from 'react'
import { CreditCard, AlertCircle, CheckCircle } from 'lucide-react'
import { adminApi } from '../../services/api'
import type { BillingRecord } from '../../types'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function BillingPage() {
  const [records, setRecords]   = useState<BillingRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<BillingRecord | null>(null)
  const [amount, setAmount]     = useState('')

  const load = () => {
    setLoading(true)
    adminApi.getBilling()
      .then((res) => setRecords(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleMarkPaid = async () => {
    if (!selected || !amount) return
    try {
      await adminApi.markPayment(selected.shop_id, Number(amount))
      toast.success('Payment recorded')
      setSelected(null)
      setAmount('')
      load()
    } catch {}
  }

  const total = records.reduce((s, r) => s + r.commission_balance, 0)
  const overdue = records.filter((r) => r.billing_alert === 'early_payment_required' || r.billing_alert === 'payment_due')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Billing</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-sm text-gray-500">Total Pending</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">₹{total.toLocaleString()}</div>
        </div>
        <div className="card p-5 bg-red-50 border-red-200">
          <div className="text-sm text-red-600">Overdue Shops</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{overdue.length}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-gray-500">Commission Rate</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">₹2 / order</div>
        </div>
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-500 shrink-0" size={20} />
          <p className="text-sm text-red-700">
            <strong>{overdue.length} shops</strong> are overdue for payment and may be auto-suspended. Follow up immediately.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No billing records yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Shop', 'City', 'Balance', 'Orders', 'Shop Status', 'Alert', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => (
                  <tr key={r.shop_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.shop_name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.city}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">₹{(r.commission_balance || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{r.total_orders || 0}</td>
                    <td className="px-4 py-3">
                      <span className={r.shop_status === 'active' ? 'badge-green' : 'badge-red'}>
                        {r.shop_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        r.billing_alert === 'early_payment_required' ? 'badge-red' :
                        r.billing_alert === 'payment_due'            ? 'badge-yellow' :
                        'badge-green'
                      )}>
                        {(r.billing_alert || 'accumulating').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelected(r); setAmount(String(r.commission_balance)) }}
                        className="btn-primary text-xs py-1.5"
                      >
                        <CreditCard size={13} /> Mark Paid
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mark paid modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Record Payment</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Shop</span><span className="font-medium">{selected.shop_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Balance</span><span className="font-bold text-red-600">₹{(selected.commission_balance || 0).toLocaleString()}</span></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received (₹)</label>
              <input
                className="input"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSelected(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleMarkPaid} className="btn-primary flex-1">
                <CheckCircle size={16} /> Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
