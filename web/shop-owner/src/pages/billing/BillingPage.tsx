import { useEffect, useState } from 'react'
import { IndianRupee, AlertTriangle, Clock, ShieldAlert } from 'lucide-react'
import clsx from 'clsx'
import { billingApi } from '../../services/api'
import type { BillingInfo } from '../../types'

const alertCopy: Record<BillingInfo['billing_alert'], { label: string; badge: string; banner: string }> = {
  accumulating: {
    label: 'Accumulating',
    badge: 'badge-green',
    banner: '',
  },
  payment_due: {
    label: 'Payment Due',
    badge: 'badge-yellow',
    banner: 'Your commission balance has crossed ₹2,000. Please pay Isanthe within 7 days to avoid suspension.',
  },
  early_payment_required: {
    label: 'Immediate Payment Required',
    badge: 'badge-red',
    banner: 'Your commission balance has crossed ₹5,000 — fast growth threshold. Please pay Isanthe as soon as possible.',
  },
}

const statusBadge: Record<string, string> = {
  pending: 'badge-yellow',
  paid:    'badge-green',
  overdue: 'badge-red',
  waived:  'badge-blue',
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    billingApi.getMyBilling()
      .then((res) => setBilling(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!billing) return (
    <div className="py-12 text-center text-gray-400 text-sm">Could not load billing info</div>
  )

  const { commission_balance, payment_due_at, billing_alert, history } = billing
  const copy = alertCopy[billing_alert]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-gray-500 text-sm">Your Isanthe commission balance and payment status</p>
      </div>

      {copy.banner && (
        <div className={clsx(
          'rounded-xl px-5 py-4 flex items-start gap-3 text-sm',
          billing_alert === 'early_payment_required' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
        )}>
          {billing_alert === 'early_payment_required' ? <ShieldAlert size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
          <span>{copy.banner}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Commission Balance</div>
              <div className="text-2xl font-bold mt-1">₹{Number(commission_balance).toLocaleString('en-IN')}</div>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600"><IndianRupee size={20} /></div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <div className="mt-2"><span className={copy.badge}>{copy.label}</span></div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Payment Due By</div>
              <div className="text-lg font-semibold mt-1">
                {payment_due_at ? new Date(payment_due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 text-orange-600"><Clock size={20} /></div>
          </div>
        </div>
      </div>

      <div className="card p-4 text-sm text-gray-500">
        Rs. 2 commission per order · pay within 7 days once balance crosses ₹2,000 · immediate payment requested if balance reaches ₹5,000 quickly · unpaid balances may lead to automatic suspension after 7 days.
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold">Payment History</h2>
        </div>
        {history.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No billing history yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">Period</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Due Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Paid On</th>
                  <th className="px-5 py-3 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3">{new Date(row.period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-5 py-3 font-medium">₹{Number(row.total_commission).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3">{row.due_date ? new Date(row.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-5 py-3"><span className={statusBadge[row.status] || 'badge-yellow'}>{row.status}</span></td>
                    <td className="px-5 py-3">{row.paid_at ? new Date(row.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-5 py-3 text-gray-400">{row.payment_reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
