import { useEffect, useRef, useState } from 'react'
import { Camera, Save, Store } from 'lucide-react'
import { shopApi } from '../../services/api'
import { useShopStore } from '../../store/shopStore'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL?.replace('/api', '') || ''

export default function SettingsPage() {
  const { shop, setShop } = useShopStore()
  const [form, setForm] = useState({
    name: '', description: '', phone: '',
    delivery_fee: '', minimum_order: '',
    delivery_time_min: '', delivery_time_max: '',
    open_time: '', close_time: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploadingLogo,  setUploadingLogo]  = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const logoRef  = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (file: File, type: 'logo' | 'cover') => {
    if (type === 'logo')  setUploadingLogo(true)
    else                  setUploadingCover(true)
    try {
      const res = await shopApi.uploadImage(file, type)
      setShop({ ...shop!, ...res.data.data })
      toast.success(`${type === 'logo' ? 'Logo' : 'Cover'} updated`)
    } catch {
      // error shown by interceptor
    } finally {
      if (type === 'logo')  setUploadingLogo(false)
      else                  setUploadingCover(false)
    }
  }

  useEffect(() => {
    if (shop) {
      setForm({
        name:              shop.name || '',
        description:       shop.description || '',
        phone:             shop.phone || '',
        delivery_fee:      String(shop.delivery_fee || 0),
        minimum_order:     String(shop.minimum_order || 0),
        delivery_time_min: String(shop.delivery_time_min || 20),
        delivery_time_max: String(shop.delivery_time_max || 45),
        open_time:         '',
        close_time:        '',
      })
    }
  }, [shop])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop) return
    setSaving(true)
    try {
      const res = await shopApi.updateShop(shop.id, {
        name:              form.name,
        description:       form.description,
        phone:             form.phone,
        delivery_fee:      Number(form.delivery_fee),
        minimum_order:     Number(form.minimum_order),
        delivery_time_min: Number(form.delivery_time_min),
        delivery_time_max: Number(form.delivery_time_max),
        open_time:         form.open_time  || undefined,
        close_time:        form.close_time || undefined,
      })
      setShop(res.data.data)
      toast.success('Settings saved')
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const F = (label: string, key: keyof typeof form, type = 'text', hint?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <input
        className="input"
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Shop Settings</h1>

      {/* Status banner */}
      {shop?.status !== 'active' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
          ⚠️ Your shop status is <strong>{shop?.status}</strong>. Contact admin if you believe this is an error.
        </div>
      )}

      {/* ── Shop Images ─────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {/* Cover image */}
        <div
          className="relative h-36 bg-gradient-to-r from-brand-500 to-brand-700 cursor-pointer group"
          style={shop?.cover_url ? {
            backgroundImage: `url(${API}${shop.cover_url})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          } : {}}
          onClick={() => coverRef.current?.click()}
        >
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 bg-black/60 text-white text-sm font-medium px-4 py-2 rounded-full">
              {uploadingCover
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera size={15} />}
              {uploadingCover ? 'Uploading…' : 'Change cover photo'}
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="px-5 pb-4 flex items-end gap-4 -mt-10">
          <div
            className="relative w-20 h-20 rounded-2xl border-4 border-white shadow-md bg-brand-100 flex items-center justify-center cursor-pointer group flex-shrink-0 overflow-hidden"
            onClick={() => logoRef.current?.click()}
          >
            {shop?.logo_url
              ? <img src={`${API}${shop.logo_url}`} alt="Logo" className="w-full h-full object-cover" />
              : <Store size={28} className="text-brand-400" />}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingLogo
                  ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                  : <Camera size={16} className="text-white" />}
              </div>
            </div>
          </div>
          <div className="pb-1">
            <p className="text-xs text-gray-400">Click logo or cover to upload a new image</p>
            <p className="text-xs text-gray-400">PNG, JPG or WEBP · max 5 MB</p>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input ref={logoRef}  type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'logo');  e.target.value = '' }} />
        <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'cover'); e.target.value = '' }} />
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic info */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b border-gray-100 pb-2">Basic Information</h2>
          {F('Shop Name', 'name')}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="input h-20 resize-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {F('Phone Number', 'phone', 'tel')}
        </div>

        {/* Delivery charges — primary section */}
        <div className="card p-5 space-y-4 border-2 border-brand-200">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <span className="text-xl">🛵</span>
            <h2 className="font-bold text-gray-800">Delivery Charge</h2>
            <span className="ml-auto text-xs bg-brand-100 text-brand-700 font-semibold px-2 py-0.5 rounded-full">Important</span>
          </div>

          <p className="text-sm text-gray-500">
            This is the fee charged to your customers for every order. Set ₹0 for free delivery.
          </p>

          {/* Big input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Fee</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">₹</span>
              <input
                className="input pl-8 text-2xl font-bold h-14"
                type="number"
                min="0"
                step="1"
                value={form.delivery_fee}
                onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          {/* Live preview */}
          <div className={`rounded-xl p-4 flex items-center justify-between text-sm font-medium ${
            Number(form.delivery_fee) === 0
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-orange-50 text-orange-700 border border-orange-200'
          }`}>
            <span>
              {Number(form.delivery_fee) === 0
                ? '🎉 Free delivery for your customers!'
                : `🛵 Customers will pay ₹${form.delivery_fee} for delivery`}
            </span>
            {Number(form.delivery_fee) > 0 && (
              <button type="button" onClick={() => setForm({ ...form, delivery_fee: '0' })}
                className="text-xs underline opacity-70 hover:opacity-100">
                Set free
              </button>
            )}
          </div>
        </div>

        {/* Other delivery settings */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b border-gray-100 pb-2">Delivery Settings</h2>
          {F('Minimum Order Amount (₹)', 'minimum_order', 'number', 'Orders below this amount will not be accepted')}
          <div className="grid grid-cols-2 gap-4">
            {F('Min Delivery Time (min)', 'delivery_time_min', 'number')}
            {F('Max Delivery Time (min)', 'delivery_time_max', 'number')}
          </div>
        </div>

        {/* Operating hours */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b border-gray-100 pb-2">Operating Hours</h2>
          <div className="grid grid-cols-2 gap-4">
            {F('Opening Time', 'open_time', 'time')}
            {F('Closing Time', 'close_time', 'time')}
          </div>
          <p className="text-xs text-gray-400">Leave blank to keep current hours</p>
        </div>

        {/* Billing info */}
        <div className="card p-5 bg-gray-50">
          <h2 className="font-semibold text-gray-800 mb-3">Billing</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Commission Balance</div>
              <div className="text-xl font-bold text-red-600 mt-1">₹{shop?.commission_balance || 0}</div>
            </div>
            <div>
              <div className="text-gray-500">Commission Rate</div>
              <div className="text-xl font-bold mt-1">₹2 / order</div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Pay your balance when it reaches ₹2,000. Contact admin for payment.
          </p>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
