import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Phone, Mail, Save, LogOut, ShoppingBag, MapPin } from 'lucide-react'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { user, setUser, logout, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm]     = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return }
    if (user) setForm({ name: user.name, phone: user.phone })
    else {
      authApi.me().then((res) => { setUser(res.data.data); setForm({ name: res.data.data.name, phone: res.data.data.phone }) }).catch(() => {})
    }
  }, [isAuthenticated])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await authApi.updateProfile(form)
      setUser(res.data.data)
      toast.success('Profile updated')
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
    toast.success('Logged out')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-bold">My Profile</h1>

      {/* Avatar */}
      <div className="card p-6 flex items-center gap-4">
        <div className="w-16 h-16 bg-brand-100 text-brand-700 rounded-2xl flex items-center justify-center text-2xl font-bold">
          {user?.name?.charAt(0).toUpperCase() || '?'}
        </div>
        <div>
          <div className="font-bold text-lg">{user?.name}</div>
          <div className="text-sm text-gray-500">{user?.email}</div>
          <span className="badge-green mt-1">Customer</span>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: ShoppingBag, label: 'My Orders',  to: '/orders'  },
          { icon: MapPin,      label: 'Addresses',  to: '/profile/addresses' },
        ].map(({ icon: Icon, label, to }) => (
          <button key={label} onClick={() => navigate(to)}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
              <Icon size={18} className="text-brand-600" />
            </div>
            <span className="font-medium text-sm">{label}</span>
          </button>
        ))}
      </div>

      {/* Edit profile */}
      <form onSubmit={handleSave} className="card p-5 space-y-4">
        <h2 className="font-semibold">Edit Profile</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <User size={14} /> Full Name
          </label>
          <input className="input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Phone size={14} /> Phone
          </label>
          <input className="input" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Mail size={14} /> Email
          </label>
          <input className="input bg-gray-50 text-gray-400" value={user?.email || ''} disabled />
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
          <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* Logout */}
      <button onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-red-100 text-red-500 hover:bg-red-50 transition-colors font-medium">
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  )
}
