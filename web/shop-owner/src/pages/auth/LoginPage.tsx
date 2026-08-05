import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

type Step = 'phone' | 'otp'

export default function LoginPage() {
  const { loginWithTokens } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep]       = useState<Step>('phone')
  const [phone, setPhone]     = useState('')
  const [otp, setOtp]         = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = phone.replace(/\D/g, '')
    if (!/^[6-9]\d{9}$/.test(cleaned)) { toast.error('Enter a valid 10-digit Indian mobile number'); return }
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
        expectedRole: 'shop_owner',
      })
      const { user, accessToken, refreshToken } = res.data.data
      if (user.role !== 'shop_owner') {
        toast.error('Please use the correct app for your role')
        return
      }
      loginWithTokens(user, accessToken, refreshToken)
      navigate('/dashboard')
    } catch {
      // error shown by interceptor
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const btnCls   = 'w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50'

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl">🏪</div>
          <h1 className="text-2xl font-bold text-white">Shop Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in with your mobile number</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 space-y-4">

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
                <p className="text-xs text-gray-500 mt-1">Must be registered with your shop account</p>
              </div>
              <button type="submit" disabled={sending} className={btnCls}>
                {sending ? 'Sending…' : 'Continue'}
              </button>
              <p className="text-center text-sm text-gray-400">
                New shop owner?{' '}
                <Link to="/register" className="text-brand-400 hover:underline">Create an account</Link>
              </p>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="text-center">
                <p className="text-gray-300 text-sm">Signing in as</p>
                <p className="text-white font-medium text-sm mt-0.5">+91 {phone}</p>
                <button type="button" onClick={() => { setStep('phone'); setOtp('') }}
                  className="text-brand-400 text-xs mt-1 hover:underline">Change number</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 text-center">6-digit OTP</label>
                <input type="text" value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${inputCls} text-center text-2xl font-bold tracking-widest`}
                  placeholder="000000" maxLength={6} autoFocus required />
              </div>
              <button type="submit" disabled={loading || otp.length !== 6} className={btnCls}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button type="button" onClick={async () => {
                setOtp('')
                try {
                  await api.post('/auth/resend-otp', { phone: phone.replace(/\D/g, '') })
                  toast.success('OTP resent')
                } catch {}
              }} className="w-full text-sm text-gray-400 hover:text-brand-400 transition-colors">
                Resend OTP
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
