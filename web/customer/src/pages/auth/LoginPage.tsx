import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail]       = useState('customer@citysante.com')
  const [password, setPassword] = useState('Password@123')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const { login } = useAuthStore()
  const navigate  = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/')
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel (illustration) — hidden on mobile ── */}
      <div className="hidden lg:flex flex-col flex-1 bg-gradient-to-br from-red-600 via-red-500 to-yellow-400 text-white p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-16 -left-16 w-64 h-64 bg-white/10 rounded-full" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🛒</div>
            <span className="font-extrabold text-2xl tracking-tight">Isanthe</span>
          </div>

          <h2 className="text-4xl font-extrabold leading-snug mb-4">
            Fresh groceries<br />at your door. 🚀
          </h2>
          <p className="text-white/80 text-lg leading-relaxed max-w-sm">
            Order from local shops and get everything delivered in minutes.
          </p>

          {/* Feature list */}
          <div className="mt-12 space-y-4">
            {[
              { icon: '⚡', title: 'Lightning fast', sub: '10–30 min delivery' },
              { icon: '💰', title: 'Best prices', sub: 'Direct from local shops' },
              { icon: '🏪', title: '50+ shops', sub: 'All categories covered' },
            ].map(({ icon, title, sub }) => (
              <div key={title} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl shrink-0">
                  {icon}
                </div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-white/70 text-sm">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 lg:max-w-md flex flex-col items-center justify-center p-8 bg-[#fafaf9]">

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-yellow-400 rounded-xl flex items-center justify-center text-xl shadow-md shadow-red-200">
            🛒
          </div>
          <span className="font-extrabold text-2xl">City<span className="text-brand-500">Sante</span></span>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-extrabold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-1 mb-8">Sign in to your Isanthe account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  className="input pl-10"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-2 text-base"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <p className="text-center text-sm text-gray-500">
            New to Isanthe?{' '}
            <Link to="/register" className="text-brand-500 font-bold hover:text-brand-600 transition-colors">
              Create a free account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
