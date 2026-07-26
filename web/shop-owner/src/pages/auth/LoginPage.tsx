import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../services/api'
import toast from 'react-hot-toast'

type Mode = 'password' | 'otp'
type OtpStep = 'email' | 'code'

export default function LoginPage() {
  const [mode, setMode]         = useState<Mode>('password')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [otpEmail, setOtpEmail] = useState('')
  const [otp, setOtp]           = useState('')
  const [otpStep, setOtpStep]   = useState<OtpStep>('email')
  const [timer, setTimer]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const { login, loginWithTokens } = useAuthStore()
  const navigate = useNavigate()

  // ── Timer for resend cooldown ──────────────────────────────────────────
  const startTimer = () => {
    setTimer(60)
    const id = setInterval(() => {
      setTimer((t) => { if (t <= 1) { clearInterval(id); return 0 } return t - 1 })
    }, 1000)
  }

  // ── Password login ─────────────────────────────────────────────────────
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      toast.error('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  // ── Send email OTP ─────────────────────────────────────────────────────
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpEmail.trim()) { toast.error('Enter your email'); return }
    setLoading(true)
    try {
      await authApi.sendEmailOTP(otpEmail.trim())
      toast.success('OTP sent to your email')
      setOtpStep('code')
      startTimer()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  // ── Verify email OTP ───────────────────────────────────────────────────
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    setLoading(true)
    try {
      const res = await authApi.verifyEmailOTP(otpEmail.trim(), otp.trim())
      const { user, accessToken, refreshToken } = res.data.data
      if (user.role !== 'shop_owner') {
        toast.error('This portal is for shop owners only')
        return
      }
      loginWithTokens(user, accessToken, refreshToken)
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid or expired OTP')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const btnCls   = 'w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50'

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl">🏪</div>
          <h1 className="text-2xl font-bold text-white">Shop Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to manage your shop</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-800 rounded-xl p-1 mb-4 gap-1">
          {(['password', 'otp'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setOtpStep('email'); setOtp('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {m === 'password' ? '🔑 Password' : '📧 Email OTP'}
            </button>
          ))}
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 space-y-4">

          {/* ── Password mode ─────────────────────────────────── */}
          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className={inputCls} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className={inputCls} required />
              </div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <p className="text-center text-sm text-gray-400">
                New shop owner?{' '}
                <Link to="/register" className="text-brand-400 hover:underline">Create an account</Link>
              </p>
            </form>
          )}

          {/* ── Email OTP mode ────────────────────────────────── */}
          {mode === 'otp' && otpStep === 'email' && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email address</label>
                <input type="email" value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)}
                  className={inputCls} placeholder="your@email.com" autoFocus required />
              </div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          {mode === 'otp' && otpStep === 'code' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="text-center">
                <p className="text-gray-300 text-sm">OTP sent to</p>
                <p className="text-white font-medium text-sm mt-0.5">{otpEmail}</p>
                <button type="button" onClick={() => { setOtpStep('email'); setOtp('') }}
                  className="text-brand-400 text-xs mt-1 hover:underline">Change email</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">6-digit OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${inputCls} text-center text-2xl font-bold tracking-widest`}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>
              <button type="submit" disabled={loading || otp.length !== 6} className={btnCls}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button
                type="button"
                onClick={handleSendOTP}
                disabled={timer > 0 || loading}
                className="w-full text-sm text-gray-400 hover:text-brand-400 disabled:opacity-40 transition-colors"
              >
                {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
