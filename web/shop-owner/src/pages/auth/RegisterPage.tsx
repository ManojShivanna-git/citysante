import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { auth } from '../../services/firebase'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
import { authApi } from '../../services/api'
import toast from 'react-hot-toast'

type Step = 'details' | 'otp'

export default function RegisterPage() {
  const { loginWithPhone } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep]   = useState<Step>('details')
  const [name, setName]   = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp]     = useState('')
  const [loading, setLoading] = useState(false)
  const [timer, setTimer] = useState(0)

  const confirmRef   = useRef<ConfirmationResult | null>(null)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
    recaptchaRef.current.render().catch(() => {})
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      recaptchaRef.current?.clear()
      recaptchaRef.current = null
    }
  }, [])

  const startTimer = () => {
    setTimer(30)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimer((t) => { if (t <= 1) { clearInterval(timerRef.current!); return 0 } return t - 1 })
    }, 1000)
  }

  const getRecaptcha = async () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
    }
    await recaptchaRef.current.render()
    return recaptchaRef.current
  }

  const resetRecaptcha = () => { recaptchaRef.current?.clear(); recaptchaRef.current = null }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = phone.replace(/\D/g, '')
    if (!name.trim()) { toast.error('Enter your name'); return }
    if (!/^[6-9]\d{9}$/.test(cleaned)) { toast.error('Enter a valid 10-digit mobile number'); return }

    // Check if phone already registered
    setLoading(true)
    try {
      const result = await signInWithPhoneNumber(auth, '+91' + cleaned, await getRecaptcha())
      confirmRef.current = result
      setStep('otp')
      startTimer()
      toast.success('OTP sent!')
    } catch (err: any) {
      resetRecaptcha()
      toast.error(err?.message?.includes('too-many-requests') ? 'Too many attempts. Try later.' : 'Failed to send OTP.')
    } finally { setLoading(false) }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    if (!confirmRef.current) { toast.error('Session expired. Resend OTP.'); return }
    setLoading(true)
    try {
      const credential = await confirmRef.current.confirm(otp)
      const idToken = await credential.user.getIdToken()
      // Register as shop_owner — backend auto-creates if phone not found
      const res = await authApi.firebasePhone(idToken, name.trim())
      const { user, accessToken, refreshToken } = res.data.data
      localStorage.setItem('accessToken', accessToken)
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
      useAuthStore.setState({ user, accessToken, isAuthenticated: true })
      toast.success('Account created! Now register your shop.')
      navigate('/register-shop')
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Verification failed'
      if (msg.includes('correct app')) {
        toast.error('This number is already registered. Please sign in instead.')
      } else {
        toast.error(msg)
      }
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    if (timer > 0) return
    setLoading(true)
    resetRecaptcha()
    try {
      const result = await signInWithPhoneNumber(auth, '+91' + phone.replace(/\D/g, ''), await getRecaptcha())
      confirmRef.current = result
      setOtp(''); startTimer()
      toast.success('OTP resent!')
    } catch { resetRecaptcha(); toast.error('Failed to resend OTP') }
    finally { setLoading(false) }
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const btnCls   = 'w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50'

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div id="recaptcha-container" />

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl">🏪</div>
          <h1 className="text-2xl font-bold text-white">Create Shop Account</h1>
          <p className="text-gray-400 text-sm mt-1">Join Isanthe and start selling</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 space-y-4">

          {step === 'details' && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Your Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className={inputCls} placeholder="e.g. Ravi Kumar" autoFocus required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Mobile Number *</label>
                <div className="flex gap-2">
                  <div className="px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-gray-400 text-sm shrink-0">🇮🇳 +91</div>
                  <input type="tel" value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={inputCls} placeholder="10-digit number" required />
                </div>
                <p className="text-xs text-gray-500 mt-1">You'll use this number to log in</p>
              </div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? 'Sending OTP…' : 'Send OTP'}
              </button>
              <p className="text-center text-sm text-gray-400">
                Already have an account?{' '}
                <Link to="/login" className="text-brand-400 hover:underline">Sign in</Link>
              </p>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="text-center">
                <p className="text-gray-300 text-sm">OTP sent to</p>
                <p className="text-white font-medium text-sm mt-0.5">+91 {phone}</p>
                <button type="button" onClick={() => { setStep('details'); setOtp(''); resetRecaptcha() }}
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
                {loading ? 'Creating account…' : 'Verify & Create Account'}
              </button>
              <button type="button" onClick={handleResend} disabled={timer > 0 || loading}
                className="w-full text-sm text-gray-400 hover:text-brand-400 disabled:opacity-40 transition-colors">
                {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
