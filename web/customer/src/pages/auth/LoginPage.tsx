import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { ArrowLeft, ArrowRight, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

type Step = 'phone' | 'otp'

export default function LoginPage() {
  const { loginWithTokens } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep]           = useState<Step>('phone')
  const [phone, setPhone]         = useState('')
  const [otp, setOtp]             = useState('')
  const [loading, setLoading]     = useState(false)
  const [sending, setSending]     = useState(false)

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = phone.replace(/\D/g, '')
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      toast.error('Enter a valid 10-digit Indian mobile number')
      return
    }
    setSending(true)
    try {
      await api.post('/auth/send-otp', { phone: cleaned })
      setStep('otp')
      toast.success('OTP sent to your number')
    } catch {
      // error shown by interceptor
    } finally {
      setSending(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    setLoading(true)
    try {
      const res = await api.post('/auth/verify-otp', {
        phone: phone.replace(/\D/g, ''),
        otp,
      })
      const { user, accessToken, refreshToken, isNewUser } = res.data.data
      loginWithTokens(user, accessToken, refreshToken)
      toast.success(isNewUser ? 'Welcome to Isanthe! 🎉' : 'Welcome back! 👋')
      navigate('/')
    } catch {
      // error shown by interceptor
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setOtp('')
    try {
      await api.post('/auth/resend-otp', { phone: phone.replace(/\D/g, '') })
      toast.success('OTP resent')
    } catch {
      // error shown by interceptor
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col flex-1 text-white p-12 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 35%, #f97316 65%, #f59e0b 100%)' }}>
        <div className="absolute -top-16 -left-16 w-64 h-64 bg-white/10 rounded-full" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/25 rounded-xl flex items-center justify-center text-xl">🛒</div>
            <span className="font-extrabold text-2xl tracking-tight">Isanthe</span>
          </div>
          <h2 className="text-4xl font-extrabold leading-snug mb-4">Fresh groceries<br />at your door. 🚀</h2>
          <p className="text-white/80 text-lg leading-relaxed max-w-sm">
            Minutes away, every day.
          </p>
          <div className="mt-12 space-y-4">
            {[
              { icon: '⚡', title: 'Lightning fast',  sub: '10–30 min delivery' },
              { icon: '💰', title: 'Best prices',     sub: 'Direct from local shops' },
              { icon: '📱', title: 'No password',     sub: 'Just your phone number' },
            ].map(({ icon, title, sub }) => (
              <div key={title} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl shrink-0">{icon}</div>
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
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <div className="w-10 h-10 bg-grad rounded-xl flex items-center justify-center text-xl shadow-md">🛒</div>
          <span className="font-extrabold text-2xl">Isanthe</span>
        </div>

        <div className="w-full max-w-sm">

          {/* ── Step 1: Phone ── */}
          {step === 'phone' && (
            <>
              <h1 className="text-2xl font-extrabold text-gray-900">Enter your mobile number</h1>
              <p className="text-gray-500 text-sm mt-1 mb-8">We'll verify your number to sign you in</p>

              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mobile number</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm font-semibold text-gray-600 shrink-0">
                      🇮🇳 +91
                    </div>
                    <div className="relative flex-1">
                      <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="tel" className="input pl-10 w-full" placeholder="10-digit number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        autoFocus required />
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={sending} className="btn-primary w-full py-3 text-base">
                  {sending
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</span>
                    : <span className="flex items-center justify-center gap-2">Continue <ArrowRight size={16} /></span>
                  }
                </button>
              </form>

              <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
                By continuing, you agree to our Terms of Service and Privacy Policy.
                <br />New users are automatically registered.
              </p>
            </>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <>
              <button onClick={() => { setStep('phone'); setOtp('') }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors">
                <ArrowLeft size={16} /> Change number
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-orange-100">📱</div>
                <h1 className="text-2xl font-extrabold text-gray-900">Enter OTP</h1>
                <p className="text-gray-500 text-sm mt-2">
                  For <span className="font-semibold text-gray-700">+91 {phone}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">6-digit OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full h-16 rounded-xl border-2 border-gray-200 text-center text-3xl font-bold outline-none tracking-widest focus:border-orange-400 bg-white transition-all"
                    placeholder="000000"
                    autoFocus
                  />
                </div>

                <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full py-3 text-base">
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying…</span>
                    : <span className="flex items-center justify-center gap-2">Verify & Login <ArrowRight size={16} /></span>
                  }
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Didn't receive it?{' '}
                <button type="button" onClick={handleResend}
                  className="font-bold text-brand-500 hover:text-brand-600 transition-colors">
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
