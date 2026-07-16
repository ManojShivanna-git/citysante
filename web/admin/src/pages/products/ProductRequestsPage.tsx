import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Package } from 'lucide-react'
import { adminApi, productApi } from '../../services/api'
import type { ProductRequest, Category } from '../../types'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import SearchableSelect from '../../components/SearchableSelect'

export default function ProductRequestsPage() {
  const [requests, setRequests] = useState<ProductRequest[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('pending')
  // Requests don't collect a category from the shop, so the admin picks one
  // per-card right before approving — keyed by request id.
  const [chosenCategory, setChosenCategory] = useState<Record<string, string>>({})

  const load = () => {
    setLoading(true)
    Promise.all([
      adminApi.getProductRequests(filter),
      productApi.getCategories(),
    ])
      .then(([reqs, cats]) => {
        setRequests(reqs.data.data)
        setCategories(cats.data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const handleApprove = async (id: string) => {
    const category_id = chosenCategory[id]
    if (!category_id) {
      toast.error('Pick a category before approving')
      return
    }
    try {
      await adminApi.reviewProductRequest(id, 'approve', { category_id })
      toast.success('Approved — added to catalog')
      load()
    } catch {}
  }

  const handleReject = async (id: string) => {
    try {
      await adminApi.reviewProductRequest(id, 'reject')
      toast.success('Request rejected')
      load()
    } catch {}
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Product Requests</h1>
      <p className="text-gray-500 text-sm">Shops have requested these products to be added to the master catalog.</p>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {['pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="card p-16 text-center text-gray-400">No {filter} requests</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.map((r) => (
            <div key={r.id} className="card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.name} className="w-12 h-12 rounded-lg object-cover bg-gray-50 border border-gray-100 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package size={18} className="text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{r.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Requested by: {r.shop_name}</p>
                  </div>
                </div>
                <span className={clsx(
                  r.status === 'pending'  ? 'badge-yellow' :
                  r.status === 'approved' ? 'badge-green' : 'badge-red'
                )}>
                  {r.status}
                </span>
              </div>
              {r.description && <p className="text-sm text-gray-600">{r.description}</p>}
              <div className="flex gap-4 text-xs text-gray-500">
                {r.unit && <span>Unit: {r.unit}</span>}
                {r.brand && <span>Brand: {r.brand}</span>}
              </div>
              <div className="text-xs text-gray-400">
                {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              {r.status === 'pending' && (
                <>
                  <SearchableSelect
                    value={chosenCategory[r.id] || ''}
                    onChange={(v) => setChosenCategory((c) => ({ ...c, [r.id]: v }))}
                    placeholder="Select category to approve into…"
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleApprove(r.id)}
                      className="btn-primary flex-1 justify-center py-2"
                    >
                      <CheckCircle size={15} /> Approve & Add
                    </button>
                    <button
                      onClick={() => handleReject(r.id)}
                      className="btn-danger flex-1 justify-center py-2"
                    >
                      <XCircle size={15} /> Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
