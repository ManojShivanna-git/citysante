import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { auth } from '../../services/firebase'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
import toast from 'react-hot-toast'

type Step = 'phone' | 'otp'

export default function LoginPage() {
  const { loginWithPhone } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep]   = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp]     = useState('')
  const [loading, setLoading] = useState(false)
  const [timer, setTimer] = useState(0)

  const confirmRef   = useRef<ConfirmationResult | null>(null)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    recaptchaRef.current?.clear()
    recaptchaRef.current = null
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

  const resetRecaptcha = () => {
    recaptchaRef.current?.clear()
    recaptchaRef.current = null
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = phone.replace(/\D/g, '')
    if (!/^[6-9]\d{9}$/.test(cleaned)) { toast.error('Enter a valid 10-digit Indian mobile number'); return }
    setLoading(true)
    try {
      const result = await signInWithPhoneNumber(auth, '+91' + cleaned, await getRecaptcha())
      confirmRef.current = result
      setStep('otp')
      startTimer()
      toast.success('OTP sent!')
    } catch (err: any) {
      console.error('Send OTP error:', err)
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
      await loginWithPhone(idToken)
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Invalid OTP')
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
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? 'Sending OTP...' : 'Send OTP'}
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
                <p className="text-gray-300 text-sm">OTP sent to</p>
                <p className="text-white font-medium text-sm mt-0.5">+91 {phone}</p>
                <button type="button" onClick={() => { setStep('phone'); setOtp(''); resetRecaptcha() }}
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
