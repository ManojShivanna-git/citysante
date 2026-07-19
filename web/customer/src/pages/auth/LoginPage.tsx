import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../services/api'
import { ArrowLeft, ArrowRight, Phone, User } from 'lucide-react'
import toast from 'react-hot-toast'

type Step = 'phone' | 'otp' | 'name'

export default function LoginPage() {
  const { loginWithOTP } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep]       = useState<Step>('phone')
  const [phone, setPhone]     = useState('')
  const [otp, setOtp]         = useState(['', '', '', '', '', ''])
  const [name, setName]       = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [loading, setLoading] = useState(false)
  const [timer, setTimer]     = useState(0)
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null)
  const otpInputs             = useRef<(HTMLInputElement | null)[]>([])

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
    const cleaned = phone.replace(/\D/g, '')
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      toast.error('Enter a valid 10-digit Indian mobile number')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.sendOTP(cleaned)
      setIsNewUser(res.data.data.isNewUser)
      setStep('otp')
      startTimer()
      setTimeout(() => otpInputs.current[0]?.focus(), 100)
    } catch {
      // error toast handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const otpStr = otp.join('')
    if (otpStr.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    setLoading(true)
    try {
      const { isNewUser: newUser } = await loginWithOTP(phone.replace(/\D/g, ''), otpStr)
      if (newUser) {
        setStep('name')
      } else {
        toast.success('Welcome back! 👋')
        navigate('/')
      }
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

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Please enter your name'); return }
    setLoading(true)
    try {
      await authApi.updateProfile({ name: name.trim() })
      toast.success('Welcome to Isanthe! 🎉')
      navigate('/')
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleOtpInput = (val: string, idx: number) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    if (digit && idx < 5) otpInputs.current[idx + 1]?.focus()
  }

  const handleOtpKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpInputs.current[idx - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (digits.length === 6) {
      setOtp(digits.split(''))
      otpInputs.current[5]?.focus()
      e.preventDefault()
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

          <h2 className="text-4xl font-extrabold leading-snug mb-4">
            Fresh groceries<br />at your door. 🚀
          </h2>
          <p className="text-white/80 text-lg leading-relaxed max-w-sm">
            Order from local shops and get everything delivered in minutes.
          </p>

          <div className="mt-12 space-y-4">
            {[
              { icon: '⚡', title: 'Lightning fast',   sub: '10–30 min delivery' },
              { icon: '💰', title: 'Best prices',      sub: 'Direct from local shops' },
              { icon: '📱', title: 'No password',      sub: 'Just your phone number' },
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
          <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-yellow-400 rounded-xl flex items-center justify-center text-xl shadow-md shadow-red-200">🛒</div>
          <span className="font-extrabold text-2xl">Isanthe</span>
        </div>

        <div className="w-full max-w-sm">

          {/* ── Step 1: Phone ── */}
          {step === 'phone' && (
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
                      <input
                        type="tel"
                        className="input pl-10 w-full"
                        placeholder="10-digit number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        autoFocus
                        required
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending OTP…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Send OTP <ArrowRight size={16} />
                    </span>
                  )}
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
              <button
                onClick={() => setStep('phone')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors"
              >
                <ArrowLeft size={16} /> Change number
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-red-100">
                  📱
                </div>
                <h1 className="text-2xl font-extrabold text-gray-900">Enter OTP</h1>
                <p className="text-gray-500 text-sm mt-2">
                  Sent to <span className="font-semibold text-gray-700">+91 {phone}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-6">
                {/* 6-box OTP input */}
                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpInputs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpInput(e.target.value, i)}
                      onKeyDown={(e) => handleOtpKey(e, i)}
                      className={`w-12 h-14 rounded-xl border-2 text-center text-2xl font-bold outline-none transition-all
                        ${digit
                          ? 'border-red-500 bg-red-50 text-gray-900'
                          : 'border-gray-200 bg-white text-gray-900 focus:border-red-400'
                        }`}
                    />
                  ))}
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Verify OTP <ArrowRight size={16} />
                    </span>
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Didn't receive it?{' '}
                <button
                  onClick={handleResendOTP}
                  disabled={timer > 0 || loading}
                  className={`font-bold transition-colors ${timer > 0 ? 'text-gray-400 cursor-default' : 'text-red-500 hover:text-red-600'}`}
                >
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                </button>
              </p>
            </>
          )}

          {/* ── Step 3: Name (new users only) ── */}
          {step === 'name' && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-green-100">
                  🎉
                </div>
                <h1 className="text-2xl font-extrabold text-gray-900">Welcome to Isanthe!</h1>
                <p className="text-gray-500 text-sm mt-2">What should we call you?</p>
              </div>

              <form onSubmit={handleSaveName} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      className="input pl-10 w-full"
                      placeholder="e.g. Ravi Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Start Shopping <ArrowRight size={16} />
                    </span>
                  )}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
