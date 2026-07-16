/**
 * AddressPage
 *
 * Customers add addresses ONLY through the map picker — no manual text entry.
 * Flow:
 *   "Add Address" → MapPickerModal → pick label (Home / Work / Other) → auto-save
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Trash2, Star, ArrowLeft, Map, CheckCircle } from 'lucide-react'
import { addressApi } from '../../services/api'
import toast from 'react-hot-toast'
import MapPickerModal, { type MapPickResult } from '../../components/MapPickerModal'

interface Address {
  id: string; label: string; street: string
  city: string | null; state: string | null; pincode: string | null
  lat: number | null; lng: number | null; is_default: boolean
}

const LABELS = ['Home', 'Work', 'Other'] as const

export default function AddressPage() {
  const navigate = useNavigate()
  const [addresses, setAddresses]   = useState<Address[]>([])
  const [loading, setLoading]       = useState(true)
  const [mapOpen, setMapOpen]       = useState(false)

  // After the user picks a location on the map we show the label picker
  const [pendingPick, setPendingPick] = useState<MapPickResult | null>(null)
  const [chosenLabel, setChosenLabel] = useState<string>('Home')
  const [houseNo,     setHouseNo]     = useState('')
  const [floor,       setFloor]       = useState('')
  const [tower,       setTower]       = useState('')
  const [landmark,    setLandmark]    = useState('')
  const [saving,      setSaving]      = useState(false)

  const load = () => {
    setLoading(true)
    addressApi.getAll()
      .then((res) => setAddresses(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleMapPick = (result: MapPickResult) => {
    setPendingPick(result)
    setChosenLabel('Home')
    setHouseNo(''); setFloor(''); setTower(''); setLandmark('')
  }

  const handleSave = async () => {
    if (!pendingPick) return
    if (!houseNo.trim()) { toast.error('House / Flat No is required'); return }
    setSaving(true)
    try {
      const details = [
        houseNo.trim(),
        floor.trim()  && `Floor ${floor.trim()}`,
        tower.trim()  && `Tower ${tower.trim()}`,
      ].filter(Boolean).join(', ')
      const street = details ? `${details}, ${pendingPick.street}` : pendingPick.street

      await addressApi.create({
        label:      chosenLabel,
        street,
        city:       pendingPick.city,
        state:      pendingPick.state,
        pincode:    pendingPick.pincode,
        lat:        pendingPick.lat,
        lng:        pendingPick.lng,
        is_default: addresses.length === 0,
        ...(landmark.trim() ? { landmark: landmark.trim() } : {}),
      })
      toast.success('Address saved')
      setPendingPick(null)
      setHouseNo(''); setFloor(''); setTower(''); setLandmark('')
      load()
    } catch {
      toast.error('Could not save address')
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    try { await addressApi.setDefault(id); toast.success('Default address updated'); load() } catch {}
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this address?')) return
    try { await addressApi.delete(id); toast.success('Address deleted'); load() } catch {}
  }

  return (
    <>
      <MapPickerModal open={mapOpen} onClose={() => setMapOpen(false)} onConfirm={handleMapPick} />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/profile')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold">My Addresses</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">

            {addresses.length === 0 && !pendingPick && (
              <div className="card p-12 text-center">
                <div className="text-4xl mb-3">📍</div>
                <div className="font-medium text-gray-700">No addresses yet</div>
                <div className="text-sm text-gray-400 mt-1">Tap the button below to add your first delivery address</div>
              </div>
            )}

            {/* Saved addresses */}
            {addresses.map((addr) => (
              <div key={addr.id}
                className={`card p-4 flex items-start gap-3 ${addr.is_default ? 'border-brand-300 border-2' : ''}`}>
                <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={16} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-800">{addr.label}</span>
                    {addr.is_default && (
                      <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-md font-medium">Default</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-0.5">{addr.street}</div>
                  {(addr.city || addr.pincode) && (
                    <div className="text-xs text-gray-400">
                      {[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!addr.is_default && (
                    <button onClick={() => handleSetDefault(addr.id)}
                      className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"
                      title="Set as default">
                      <Star size={15} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(addr.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}

            {/* ── Address detail card — shown after map pick ── */}
            {pendingPick && (
              <div className="card p-5 space-y-4 border-2 border-brand-300">
                <h3 className="font-semibold text-gray-800">Add address details</h3>

                {/* Auto-detected area */}
                <div className="flex items-start gap-2 text-sm bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                  <Map size={14} className="text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 text-xs">{pendingPick.street}</p>
                    <p className="text-blue-600 text-xs mt-0.5">
                      {[pendingPick.city, pendingPick.state, pendingPick.pincode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setPendingPick(null); setMapOpen(true) }}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium shrink-0">
                    Change
                  </button>
                </div>

                {/* House / Flat No — required */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    House / Flat No <span className="text-red-500">*</span>
                  </label>
                  <input className="input" placeholder="e.g. 42, Flat 302, Villa 7"
                    value={houseNo} onChange={(e) => setHouseNo(e.target.value)} />
                </div>

                {/* Floor + Tower */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Floor</label>
                    <input className="input" placeholder="e.g. 3rd, Ground"
                      value={floor} onChange={(e) => setFloor(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tower / Block</label>
                    <input className="input" placeholder="e.g. Tower B, Block C"
                      value={tower} onChange={(e) => setTower(e.target.value)} />
                  </div>
                </div>

                {/* Landmark */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Landmark (optional)</label>
                  <input className="input" placeholder="e.g. Near City Mall, Opp. Park"
                    value={landmark} onChange={(e) => setLandmark(e.target.value)} />
                </div>

                {/* Label chips */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Label</label>
                  <div className="flex gap-2">
                    {LABELS.map((lbl) => (
                      <button key={lbl} type="button" onClick={() => setChosenLabel(lbl)}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                          chosenLabel === lbl
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save */}
                <button type="button" onClick={handleSave} disabled={saving}
                  className="btn-primary w-full justify-center gap-2">
                  <CheckCircle size={16} />
                  {saving ? 'Saving…' : 'Save Address'}
                </button>
              </div>
            )}

            {/* ── Add address button ── */}
            {!pendingPick && (
              <button onClick={() => setMapOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                           border-2 border-dashed border-brand-300 text-sm text-brand-600
                           hover:bg-brand-50 transition-colors font-medium">
                <Map size={15} /> Add Address on Map
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
