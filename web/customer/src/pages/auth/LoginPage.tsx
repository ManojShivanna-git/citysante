import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../services/api'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

type Step = 'email' | 'otp'

export default function LoginPage() {
  const { loginWithEmailOTP } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep]       = useState<Step>('email')
  const [email, setEmail]     = useState('')
  const [otp, setOtp]         = useState('')
  const [loading, setLoading] = useState(false)
  const [timer, setTimer]     = useState(0)
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const startTimer = () => {
    setTimer(30)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimer((t) => { if (t <= 1) { clearInterval(timerRef.current!); return 0 } return t - 1 })
    }, 1000)
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) { toast.error('Enter a valid email address'); return }
    setLoading(true)
    try {
      await authApi.sendEmailOTP(email.trim())
      toast.success('OTP sent to your email')
      setStep('otp')
      startTimer()
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    setLoading(true)
    try {
      await loginWithEmailOTP(email.trim(), otp)
      toast.success('Welcome back! 👋')
      navigate('/')
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (timer > 0) return
    setLoading(true)
    try {
      await authApi.sendEmailOTP(email.trim())
      setOtp('')
      startTimer()
      toast.success('OTP resent!')
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col flex-1 bg-gradient-to-br from-red-600 via-red-500 to-yellow-400 text-white p-12 relative overflow-hidden">
        <div className="absolute -top-16 -left-16 w-64 h-64 bg-white/10 rounded-full" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🛒</div>
            <span className="font-extrabold text-2xl tracking-tight">Isanthe</span>
          </div>
          <h2 className="text-4xl font-extrabold leading-snug mb-4">Fresh groceries<br />at your door. 🚀</h2>
          <p className="text-white/80 text-lg leading-relaxed max-w-sm">
            Order from local shops and get everything delivered in minutes.
          </p>
          <div className="mt-12 space-y-4">
            {[
              { icon: '⚡', title: 'Lightning fast',  sub: '10–30 min delivery' },
              { icon: '💰', title: 'Best prices',     sub: 'Direct from local shops' },
              { icon: '📧', title: 'No password',     sub: 'Just your email' },
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

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-yellow-400 rounded-xl flex items-center justify-center text-xl shadow-md shadow-red-200">🛒</div>
          <span className="font-extrabold text-2xl">Isanthe</span>
        </div>

        <div className="w-full max-w-sm">

          {/* ── Step 1: Enter email ── */}
          {step === 'email' && (
            <>
              <h1 className="text-2xl font-extrabold text-gray-900">Sign in to Isanthe</h1>
              <p className="text-gray-500 text-sm mt-1 mb-8">We'll send a 6-digit code to your email</p>

              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      className="input pl-10 w-full"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending OTP…</span>
                    : <span className="flex items-center justify-center gap-2">Send OTP <ArrowRight size={16} /></span>
                  }
                </button>
              </form>

              <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </p>
            </>
          )}

          {/* ── Step 2: Enter OTP ── */}
          {step === 'otp' && (
            <>
              <button onClick={() => { setStep('email'); setOtp('') }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors">
                <ArrowLeft size={16} /> Change email
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-red-100">📧</div>
                <h1 className="text-2xl font-extrabold text-gray-900">Enter OTP</h1>
                <p className="text-gray-500 text-sm mt-2">
                  Sent to <span className="font-semibold text-gray-700">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">6-digit code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full h-16 rounded-xl border-2 border-gray-200 text-center text-3xl font-bold outline-none tracking-widest focus:border-red-400 bg-white transition-all"
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
                <button type="button" onClick={handleResend} disabled={timer > 0 || loading}
                  className={`font-bold transition-colors ${timer > 0 ? 'text-gray-400 cursor-default' : 'text-red-500 hover:text-red-600'}`}>
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                </button>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
