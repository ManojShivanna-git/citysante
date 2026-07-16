import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { Eye, EyeOff, User, Mail, Phone, Lock, ArrowRight, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const [step, setStep]       = useState<'form' | 'otp'>('form')
  const [form, setForm]       = useState({ name: '', email: '', phone: '', password: '' })
  const [otp, setOtp]         = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate  = useNavigate()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.register({ ...form, role: 'customer' })
      toast.success('OTP sent to your phone!')
      setStep('otp')
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.verifyOTP(form.phone, otp)
      await login(form.email, form.password)
      toast.success('Account created! Welcome 🎉')
      navigate('/')
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { label: 'Full Name',    key: 'name',     type: 'text',     icon: User,  placeholder: 'Ravi Kumar' },
    { label: 'Email',        key: 'email',    type: 'email',    icon: Mail,  placeholder: 'ravi@example.com' },
    { label: 'Phone',        key: 'phone',    type: 'tel',      icon: Phone, placeholder: '+91 98765 43210' },
  ]

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col flex-1 bg-gradient-to-br from-red-600 via-red-500 to-yellow-400 text-white p-12 relative overflow-hidden">
        <div className="absolute -top-16 -left-16 w-64 h-64 bg-white/10 rounded-full" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🛒</div>
            <span className="font-extrabold text-2xl tracking-tight">Isanthe</span>
          </div>

          <h2 className="text-4xl font-extrabold leading-snug mb-4">
            Join thousands of<br />happy customers. 🎉
          </h2>
          <p className="text-white/80 text-lg leading-relaxed max-w-sm">
            Sign up in 60 seconds and get groceries from your neighbourhood delivered fast.
          </p>

          <div className="mt-12 space-y-4">
            {[
              { icon: '🆓', title: 'Free to join',     sub: 'No subscription needed' },
              { icon: '📍', title: 'Multiple addresses', sub: 'Home, office, anywhere' },
              { icon: '🔔', title: 'Live order updates', sub: 'Track your rider in real time' },
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

      {/* ── Right panel ── */}
      <div className="flex-1 lg:max-w-md flex flex-col items-center justify-center p-8 bg-[#fafaf9]">

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-yellow-400 rounded-xl flex items-center justify-center text-xl shadow-md shadow-red-200">
            🛒
          </div>
          <span className="font-extrabold text-2xl">City<span className="text-brand-500">Sante</span></span>
        </div>

        <div className="w-full max-w-sm">

          {step === 'form' ? (
            <>
              <h1 className="text-2xl font-extrabold text-gray-900">Create account</h1>
              <p className="text-gray-500 text-sm mt-1 mb-8">Get started — it's free and takes 60 seconds</p>

              <form onSubmit={handleRegister} className="space-y-4">
                {fields.map(({ label, key, type, icon: Icon, placeholder }) => (
                  <div key={key}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
                    <div className="relative">
                      <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={type}
                        className="input pl-10"
                        placeholder={placeholder}
                        value={form[key as keyof typeof form]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                ))}

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      className="input pl-10 pr-10"
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
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

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2 text-base">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Continue <ArrowRight size={16} />
                    </span>
                  )}
                </button>
              </form>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">OR</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="text-brand-500 font-bold hover:text-brand-600 transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('form')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors"
              >
                <ArrowLeft size={16} /> Back
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-brand-100">
                  📱
                </div>
                <h1 className="text-2xl font-extrabold text-gray-900">Verify your phone</h1>
                <p className="text-gray-500 text-sm mt-2">
                  We sent a 6-digit OTP to{' '}
                  <span className="font-semibold text-gray-700">{form.phone}</span>
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 text-center">Enter OTP</label>
                  <input
                    className="input text-center text-2xl tracking-[0.5em] font-bold"
                    placeholder="• • • • • •"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Verify & Create Account <ArrowRight size={16} />
                    </span>
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Didn't receive it?{' '}
                <button className="text-brand-500 font-bold hover:text-brand-600 transition-colors">
                  Resend OTP
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
