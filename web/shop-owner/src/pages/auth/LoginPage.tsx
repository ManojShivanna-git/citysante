import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

type Step = 'phone' | 'otp'

export default function LoginPage() {
  const { loginWithTokens, setUser } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep]           = useState<Step>('phone')
  const [phone, setPhone]         = useState('')
  const [otp, setOtp]             = useState('')
  const [name, setName]           = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [sending, setSending]     = useState(false)

  const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-gray-500'
  const btnCls   = 'w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50'

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = phone.replace(/\D/g, '')
    if (!/^[6-9]\d{9}$/.test(cleaned)) { toast.error('Enter a valid 10-digit Indian mobile number'); return }
    setSending(true)
    try {
      const res = await api.post('/auth/send-otp', { phone: cleaned })
      const newUser = res.data?.data?.isNewUser ?? false
      setIsNewUser(newUser)
      setStep('otp')
      toast.success(newUser ? 'OTP sent — create your account' : 'OTP sent to your number')
    } catch {
      // error shown by interceptor
    } finally {
      setSending(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    if (isNewUser && !name.trim()) { toast.error('Please enter your name'); return }
    setLoading(true)
    try {
      const res = await api.post('/auth/verify-otp', {
        phone: phone.replace(/\D/g, ''),
        otp,
        expectedRole: 'shop_owner',
      })
      const { user, accessToken, refreshToken } = res.data.data
      loginWithTokens(user, accessToken, refreshToken)

      if (isNewUser) {
        // Save profile immediately
        try {
          const profileRes = await api.put('/auth/profile', { name: name.trim() })
          setUser(profileRes.data.data)
        } catch {
          // profile update failed — still proceed
        }
        toast.success('Welcome to Isanthe Shop! 🎉')
      } else {
        toast.success('Welcome back! 👋')
      }
      navigate('/dashboard')
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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl">🏪</div>
          <h1 className="text-2xl font-bold text-white">Shop Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in with your mobile number</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 space-y-4">

          {/* ── Step 1: Phone ── */}
          {step === 'phone' && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Mobile number</label>
                <div className="flex gap-2">
                  <div className="px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-gray-400 text-sm shrink-0">🇮🇳 +91</div>
                  <input type="tel" value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={inputCls} placeholder="10-digit number" autoFocus required />
                </div>
              </div>
              <button type="submit" disabled={sending} className={btnCls}>
                {sending ? 'Sending…' : 'Continue'}
              </button>
            </form>
          )}

          {/* ── Step 2: OTP (+ name for new users) ── */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="text-center">
                {isNewUser
                  ? <p className="text-gray-300 text-sm font-semibold">Create your shop account</p>
                  : <p className="text-gray-300 text-sm">Signing in as</p>
                }
                <p className="text-white font-medium text-sm mt-0.5">+91 {phone}</p>
                <button type="button" onClick={() => { setStep('phone'); setOtp(''); setName('') }}
                  className="text-brand-400 text-xs mt-1 hover:underline">Change number</button>
              </div>

              {isNewUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Your name <span className="text-red-400">*</span></label>
                  <input type="text" value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls} placeholder="e.g. Suresh Kumar" autoFocus required />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 text-center">6-digit OTP</label>
                <input type="text" value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${inputCls} text-center text-2xl font-bold tracking-widest`}
                  placeholder="000000" maxLength={6}
                  autoFocus={!isNewUser} required />
              </div>

              <button type="submit" disabled={loading || otp.length !== 6 || (isNewUser && !name.trim())} className={btnCls}>
                {loading ? 'Verifying…' : isNewUser ? 'Create Account' : 'Verify & Sign In'}
              </button>

              <button type="button" onClick={handleResend}
                className="w-full text-sm text-gray-400 hover:text-brand-400 transition-colors">
                Resend OTP
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
