import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../services/api'
import { ArrowLeft, ArrowRight, Phone, Mail, User } from 'lucide-react'
import toast from 'react-hot-toast'

type Mode     = 'phone' | 'email'
type PhoneStep = 'phone' | 'otp'
type EmailStep = 'email' | 'otp'

export default function LoginPage() {
  const { loginWithOTP, loginWithEmailOTP } = useAuthStore()
  const navigate = useNavigate()

  const [mode, setMode]           = useState<Mode>('phone')
  const [loading, setLoading]     = useState(false)
  const [timer, setTimer]         = useState(0)
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null)

  // Phone OTP state
  const [phoneStep, setPhoneStep]   = useState<PhoneStep>('phone')
  const [phone, setPhone]           = useState('')
  const [otp, setOtp]               = useState(['', '', '', '', '', ''])
  const [name, setName]             = useState('')
  const [isNewUser, setIsNewUser]   = useState(false)
  const otpInputs                   = useRef<(HTMLInputElement | null)[]>([])

  // Email OTP state
  const [emailStep, setEmailStep]   = useState<EmailStep>('email')
  const [email, setEmail]           = useState('')
  const [emailOtp, setEmailOtp]     = useState('')

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const startTimer = () => {
    setTimer(30)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimer((t) => { if (t <= 1) { clearInterval(timerRef.current!); return 0 } return t - 1 })
    }, 1000)
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setPhoneStep('phone'); setOtp(['', '', '', '', '', ''])
    setEmailStep('email'); setEmailOtp('')
    setTimer(0)
  }

  // ── Phone OTP handlers ─────────────────────────────────────────────────
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = phone.replace(/\D/g, '')
    if (!/^[6-9]\d{9}$/.test(cleaned)) { toast.error('Enter a valid 10-digit Indian mobile number'); return }
    setLoading(true)
    try {
      const res = await authApi.sendOTP(cleaned)
      setIsNewUser(res.data.data.isNewUser)
      setPhoneStep('otp')
      startTimer()
      setTimeout(() => otpInputs.current[0]?.focus(), 100)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const otpStr = otp.join('')
    if (otpStr.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    if (isNewUser && !name.trim()) { toast.error('Please enter your name'); return }
    setLoading(true)
    try {
      await loginWithOTP(phone.replace(/\D/g, ''), otpStr, isNewUser ? name.trim() : undefined)
      toast.success(isNewUser ? 'Welcome to Isanthe! 🎉' : 'Welcome back! 👋')
      navigate('/')
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (timer > 0) return
    setLoading(true)
    try {
      await authApi.resendOTP(phone.replace(/\D/g, ''))
      setOtp(['', '', '', '', '', ''])
      otpInputs.current[0]?.focus()
      startTimer()
      toast.success('OTP resent!')
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleOtpInput = (val: string, idx: number) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[idx] = digit; setOtp(next)
    if (digit && idx < 5) otpInputs.current[idx + 1]?.focus()
  }
  const handleOtpKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) otpInputs.current[idx - 1]?.focus()
  }
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (digits.length === 6) { setOtp(digits.split('')); otpInputs.current[5]?.focus(); e.preventDefault() }
  }

  // ── Email OTP handlers ─────────────────────────────────────────────────
  const handleSendEmailOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) { toast.error('Enter a valid email address'); return }
    setLoading(true)
    try {
      await authApi.sendEmailOTP(email.trim())
      toast.success('OTP sent to your email')
      setEmailStep('otp')
      startTimer()
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyEmailOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (emailOtp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    setLoading(true)
    try {
      await loginWithEmailOTP(email.trim(), emailOtp)
      toast.success('Welcome back! 👋')
      navigate('/')
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleResendEmailOTP = async () => {
    if (timer > 0) return
    setLoading(true)
    try {
      await authApi.sendEmailOTP(email.trim())
      setEmailOtp('')
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
              { icon: '📱', title: 'No password',     sub: 'Phone or email OTP' },
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

          {/* ── Mode tab switcher ── */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8">
            {(['phone', 'email'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === m ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'phone' ? <><Phone size={14} /> Mobile</> : <><Mail size={14} /> Email</>}
              </button>
            ))}
          </div>

          {/* ── Phone: step 1 ── */}
          {mode === 'phone' && phoneStep === 'phone' && (
            <>
              <h1 className="text-2xl font-extrabold text-gray-900">Enter your mobile number</h1>
              <p className="text-gray-500 text-sm mt-1 mb-8">We'll send you a one-time verification code</p>
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
                        value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        autoFocus required />
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending OTP…</span>
                    : <span className="flex items-center justify-center gap-2">Send OTP <ArrowRight size={16} /></span>
                  }
                </button>
              </form>
            </>
          )}

          {/* ── Phone: step 2 ── */}
          {mode === 'phone' && phoneStep === 'otp' && (
            <>
              <button onClick={() => setPhoneStep('phone')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors">
                <ArrowLeft size={16} /> Change number
              </button>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-red-100">📱</div>
                <h1 className="text-2xl font-extrabold text-gray-900">{isNewUser ? 'Verify & create account' : 'Enter OTP'}</h1>
                <p className="text-gray-500 text-sm mt-2">OTP sent to <span className="font-semibold text-gray-700">+91 {phone}</span></p>
              </div>
              <form onSubmit={handleVerifyOTP} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">Enter OTP</label>
                  <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input key={i} ref={(el) => { otpInputs.current[i] = el }}
                        type="text" inputMode="numeric" maxLength={1} value={digit}
                        onChange={(e) => handleOtpInput(e.target.value, i)}
                        onKeyDown={(e) => handleOtpKey(e, i)}
                        className={`w-12 h-14 rounded-xl border-2 text-center text-2xl font-bold outline-none transition-all ${
                          digit ? 'border-red-500 bg-red-50 text-gray-900' : 'border-gray-200 bg-white text-gray-900 focus:border-red-400'
                        }`} />
                    ))}
                  </div>
                </div>
                {isNewUser && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your name <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" className="input pl-10 w-full" placeholder="e.g. Ravi Kumar"
                        value={name} onChange={(e) => setName(e.target.value)} required={isNewUser} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">You're creating a new account</p>
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{isNewUser ? 'Creating account…' : 'Verifying…'}</span>
                    : <span className="flex items-center justify-center gap-2">{isNewUser ? 'Create Account' : 'Verify & Login'} <ArrowRight size={16} /></span>
                  }
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-6">
                Didn't receive it?{' '}
                <button type="button" onClick={handleResendOTP} disabled={timer > 0 || loading}
                  className={`font-bold transition-colors ${timer > 0 ? 'text-gray-400 cursor-default' : 'text-red-500 hover:text-red-600'}`}>
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                </button>
              </p>
            </>
          )}

          {/* ── Email: step 1 ── */}
          {mode === 'email' && emailStep === 'email' && (
            <>
              <h1 className="text-2xl font-extrabold text-gray-900">Enter your email</h1>
              <p className="text-gray-500 text-sm mt-1 mb-8">We'll send a 6-digit code to your inbox</p>
              <form onSubmit={handleSendEmailOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="email" className="input pl-10 w-full" placeholder="you@example.com"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      autoFocus required />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending OTP…</span>
                    : <span className="flex items-center justify-center gap-2">Send OTP <ArrowRight size={16} /></span>
                  }
                </button>
              </form>
            </>
          )}

          {/* ── Email: step 2 ── */}
          {mode === 'email' && emailStep === 'otp' && (
            <>
              <button onClick={() => { setEmailStep('email'); setEmailOtp('') }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors">
                <ArrowLeft size={16} /> Change email
              </button>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-red-100">📧</div>
                <h1 className="text-2xl font-extrabold text-gray-900">Enter OTP</h1>
                <p className="text-gray-500 text-sm mt-2">OTP sent to <span className="font-semibold text-gray-700">{email}</span></p>
              </div>
              <form onSubmit={handleVerifyEmailOTP} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">6-digit OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full h-16 rounded-xl border-2 border-gray-200 text-center text-3xl font-bold outline-none tracking-widest focus:border-red-400 bg-white transition-all"
                    placeholder="000000"
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={loading || emailOtp.length !== 6} className="btn-primary w-full py-3 text-base">
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying…</span>
                    : <span className="flex items-center justify-center gap-2">Verify & Login <ArrowRight size={16} /></span>
                  }
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-6">
                Didn't receive it?{' '}
                <button type="button" onClick={handleResendEmailOTP} disabled={timer > 0 || loading}
                  className={`font-bold transition-colors ${timer > 0 ? 'text-gray-400 cursor-default' : 'text-red-500 hover:text-red-600'}`}>
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                </button>
              </p>
            </>
          )}

          <p className="text-center text-xs text-gray-400 mt-8 leading-relaxed">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
