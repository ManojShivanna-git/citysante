import { create } from 'zustand'
import { authApi } from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socketService'
import type { User } from '../types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login:        (email: string, password: string) => Promise<void>
  loginWithOTP: (phone: string, otp: string, name?: string) => Promise<{ isNewUser: boolean }>
  logout:       () => void
  setUser:      (u: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('cs_token'),

  login: async (email, password) => {
    const res = await authApi.login(email, password)
    const { user, accessToken, refreshToken } = res.data.data
    localStorage.setItem('cs_token', accessToken)
    if (refreshToken) localStorage.setItem('cs_refresh', refreshToken)
    set({ user, isAuthenticated: true })
    connectSocket(user.id)
  },

  loginWithOTP: async (phone, otp, name) => {
    const res = await authApi.verifyOTP(phone, otp, name)
    const { user, accessToken, refreshToken, isNewUser } = res.data.data
    localStorage.setItem('cs_token', accessToken)
    if (refreshToken) localStorage.setItem('cs_refresh', refreshToken)
    set({ user, isAuthenticated: true })
    connectSocket(user.id)
    return { isNewUser: !!isNewUser }
  },

  logout: () => {
    authApi.logout().catch(() => {})
    localStorage.removeItem('cs_token')
    localStorage.removeItem('cs_refresh')
    disconnectSocket()
    set({ user: null, isAuthenticated: false })
  },

  setUser: (user) => set({ user }),
}))
