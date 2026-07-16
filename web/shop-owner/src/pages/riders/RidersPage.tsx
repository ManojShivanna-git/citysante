import { useEffect, useState } from 'react'
import { UserPlus, Trash2, Circle, Search, CheckCircle } from 'lucide-react'
import { riderApi } from '../../services/api'
import { useShopStore } from '../../store/shopStore'
import type { Rider } from '../../types'
import toast from 'react-hot-toast'

export default function RidersPage() {
  const { shop } = useShopStore()
  const [riders, setRiders]     = useState<Rider[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]       = useState(false)
  const [phone, setPhone]           = useState('')
  const [foundRider, setFoundRider] = useState<{ id: string; name: string; phone: string } | null>(null)
  const [looking, setLooking]       = useState(false)

  const load = () => {
    if (!shop) return
    setLoading(true)
    riderApi.getShopRiders()
      .then((res) => setRiders(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [shop?.id])

  const resetModal = () => {
    setShowAdd(false)
    setPhone('')
    setFoundRider(null)
    setLooking(false)
  }

  const handleLookup = async () => {
    if (!phone.trim()) { toast.error('Enter a phone number'); return }
    setLooking(true)
    setFoundRider(null)
    try {
      const res = await riderApi.lookupByPhone(phone.trim())
      setFoundRider(res.data.data)
    } catch {
      // error toast shown by interceptor
    } finally {
      setLooking(false)
    }
  }

  const handleAdd = async () => {
    if (!foundRider) return
    try {
      await riderApi.addRider(phone.trim())
      toast.success(`${foundRider.name} added to your shop`)
      resetModal()
      load()
    } catch {}
  }

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your shop?`)) return
    try {
      await riderApi.removeRider(id)
      toast.success('Rider removed')
      load()
    } catch {}
  }

  const onDuty = riders.filter((r) => r.is_on_duty)
  const offDuty = riders.filter((r) => !r.is_on_duty)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Riders</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <UserPlus size={16} /> Add Rider
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{riders.length}</div>
          <div className="text-sm text-gray-500 mt-1">Total Riders</div>
        </div>
        <div className="card p-4 text-center bg-green-50 border-green-200">
          <div className="text-2xl font-bold text-green-700">{onDuty.length}</div>
          <div className="text-sm text-green-600 mt-1">On Duty</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-400">{offDuty.length}</div>
          <div className="text-sm text-gray-500 mt-1">Off Duty</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : riders.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-4xl mb-3">🛵</div>
          <div className="font-medium text-gray-700">No riders yet</div>
          <div className="text-sm text-gray-400 mt-1">Add riders to your shop to start assigning deliveries</div>
          <button onClick={() => setShowAdd(true)} className="btn-primary mt-4 mx-auto">
            <UserPlus size={16} /> Add First Rider
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Rider', 'Phone', 'Duty Status', 'Current Order', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {riders.map((rider) => (
                <tr key={rider.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-sm">
                        {rider.name.charAt(0)}
                      </div>
                      <span className="font-medium">{rider.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{rider.phone}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Circle size={8} fill={rider.is_on_duty ? '#22c55e' : '#9ca3af'}
                        className={rider.is_on_duty ? 'text-green-500' : 'text-gray-400'} />
                      <span className={rider.is_on_duty ? 'text-green-700 font-medium' : 'text-gray-400'}>
                        {rider.is_on_duty ? 'On Duty' : 'Off Duty'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {rider.active_order_id ? (
                      <span className="badge-orange">On Delivery</span>
                    ) : (
                      <span className="text-gray-400 text-xs">No active order</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleRemove(rider.id, rider.name)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Rider Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Add Rider</h2>
              <button onClick={resetModal} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Enter the rider's phone number to find their account and add them to your shop.
            </p>
            <div className="space-y-3">
              {/* Phone input + lookup */}
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setFoundRider(null) }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                />
                <button
                  onClick={handleLookup}
                  disabled={looking}
                  className="btn-secondary px-3 flex items-center gap-1"
                  title="Look up rider"
                >
                  <Search size={15} className={looking ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Found rider confirmation card */}
              {foundRider && (
                <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-green-300 bg-green-50">
                  <CheckCircle size={20} className="text-green-600 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-gray-800">{foundRider.name}</div>
                    <div className="text-xs text-gray-500">{foundRider.phone}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={resetModal} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={handleAdd}
                  disabled={!foundRider}
                  className="btn-primary flex-1"
                >
                  Add to Shop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
