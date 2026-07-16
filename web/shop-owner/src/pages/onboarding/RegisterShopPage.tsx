import { useState } from 'react'
import { Store, MapPin, Phone, Clock, ChevronRight } from 'lucide-react'
import { shopApi } from '../../services/api'
import { useShopStore } from '../../store/shopStore'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const ZONE_CATEGORIES = [
  { value: 'grocery',  label: '🛒 Grocery',          desc: 'General groceries & staples' },
  { value: 'vegetable', label: '🥦 Vegetables & Fruits', desc: 'Fresh produce' },
  { value: 'dairy',    label: '🥛 Dairy & Bakery',   desc: 'Milk, eggs, bread, baked goods' },
]

export default function RegisterShopPage() {
  const { setShop } = useShopStore()
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    lat: '',
    lng: '',
    zone_category: 'grocery',
    delivery_fee: '0',
    minimum_order: '0',
    delivery_time_min: '20',
    delivery_time_max: '45',
  })

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        delivery_fee: parseFloat(form.delivery_fee) || 0,
        minimum_order: parseFloat(form.minimum_order) || 0,
        delivery_time_min: parseInt(form.delivery_time_min) || 20,
        delivery_time_max: parseInt(form.delivery_time_max) || 45,
      }
      const res = await shopApi.registerShop(payload)
      // The shop is now pending admin approval — store it so App knows we have one
      setShop(res.data.data)
      toast.success('Shop registered! Waiting for admin approval.')
      navigate('/dashboard')
    } catch {
      // error shown by api interceptor
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Register Your Shop</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Fill in your shop details. Once submitted, Isanthe will review and approve your shop.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step >= s ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{s}</div>
              {s < 2 && <ChevronRight size={14} className="text-gray-300" />}
            </div>
          ))}
        </div>

        <div className="card p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Store size={16} className="text-brand-600" /> Basic Info
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name *</label>
                <input className="input" placeholder="e.g. Green Fresh Groceries"
                  value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea className="input" rows={2} placeholder="Brief description of your shop"
                  value={form.description} onChange={(e) => set('description', e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone size={12} className="inline mr-1" /> Shop Contact Number *
                </label>
                <input className="input" placeholder="+91 98765 43210"
                  value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shop Type *</label>
                <div className="grid gap-2">
                  {ZONE_CATEGORIES.map((cat) => (
                    <label key={cat.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                        form.zone_category === cat.value
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <input type="radio" className="sr-only"
                        checked={form.zone_category === cat.value}
                        onChange={() => set('zone_category', cat.value)} />
                      <div>
                        <div className="font-medium text-sm">{cat.label}</div>
                        <div className="text-xs text-gray-500">{cat.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!form.name || !form.phone) { toast.error('Name and phone are required'); return }
                  setStep(2)
                }}
                className="btn-primary w-full justify-center mt-2"
              >
                Next: Location & Delivery
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <MapPin size={16} className="text-brand-600" /> Location & Delivery
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                <input className="input" placeholder="Shop no., building, street"
                  value={form.address} onChange={(e) => set('address', e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input className="input" placeholder="Bangalore"
                    value={form.city} onChange={(e) => set('city', e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input className="input" placeholder="Karnataka"
                    value={form.state} onChange={(e) => set('state', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                <input className="input" placeholder="560001"
                  value={form.pincode} onChange={(e) => set('pincode', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude (optional)</label>
                  <input className="input" placeholder="12.9352"
                    value={form.lat} onChange={(e) => set('lat', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude (optional)</label>
                  <input className="input" placeholder="77.6244"
                    value={form.lng} onChange={(e) => set('lng', e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">You can get coordinates from Google Maps. Isanthe team can also set this for you.</p>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                  <Clock size={14} /> Delivery Settings
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Delivery Fee (₹)</label>
                    <input className="input" type="number" min="0"
                      value={form.delivery_fee} onChange={(e) => set('delivery_fee', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Minimum Order (₹)</label>
                    <input className="input" type="number" min="0"
                      value={form.minimum_order} onChange={(e) => set('minimum_order', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Min Delivery Time (min)</label>
                    <input className="input" type="number" min="5"
                      value={form.delivery_time_min} onChange={(e) => set('delivery_time_min', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Max Delivery Time (min)</label>
                    <input className="input" type="number" min="5"
                      value={form.delivery_time_max} onChange={(e) => set('delivery_time_max', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">
                  Back
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? 'Registering…' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Wrong account?{' '}
          <button onClick={() => { logout(); navigate('/login') }}
            className="text-brand-600 hover:underline">Sign out</button>
        </p>
      </div>
    </div>
  )
}
