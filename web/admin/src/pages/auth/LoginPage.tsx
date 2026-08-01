import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

// ─── TODO: Re-enable phone OTP login after Fast2SMS / Firebase OTP is configured ───
// import { auth } from '../../services/firebase'
// import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
// type Step = 'phone' | 'otp'
// ... (full OTP flow preserved in git history — commit 95fab15 and earlier)

export default function LoginPage() {
  const { login } = useAuthStore()
  const navigate   = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Enter email and password'); return }
    setLoading(true)
    try {
      await login(email.trim(), password)
      const { user } = useAuthStore.getState()
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        toast.error('Access denied — admin accounts only')
        useAuthStore.getState().logout()
        return
      }
      navigate('/dashboard')
    } catch {
      // error shown by api interceptor
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
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl">IS</div>
          <h1 className="text-2xl font-bold text-white">Isanthe Admin</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to your admin account</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="admin@isanthe.com"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
