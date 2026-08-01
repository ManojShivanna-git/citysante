import { create } from 'zustand'
import { authApi } from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socketService'
import type { User } from '../types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login:             (email: string, password: string) => Promise<void>
  loginWithOTP:      (phone: string, otp: string, name?: string) => Promise<{ isNewUser: boolean }>
  loginWithEmailOTP: (email: string, otp: string) => Promise<void>
  loginWithPhone:    (idToken: string, name?: string) => Promise<{ isNewUser: boolean }>
  loginWithTokens:   (user: User, accessToken: string, refreshToken: string) => void
  logout:            () => void
  setUser:           (u: User) => void
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

  loginWithPhone: async (idToken, name) => {
    const res = await authApi.firebasePhone(idToken, name)
    const { user, accessToken, refreshToken, isNewUser } = res.data.data
    localStorage.setItem('cs_token', accessToken)
    if (refreshToken) localStorage.setItem('cs_refresh', refreshToken)
    set({ user, isAuthenticated: true })
    connectSocket(user.id)
    return { isNewUser: !!isNewUser }
  },

  loginWithEmailOTP: async (email, otp) => {
    const res = await authApi.verifyEmailOTP(email, otp)
    const { user, accessToken, refreshToken } = res.data.data
    localStorage.setItem('cs_token', accessToken)
    if (refreshToken) localStorage.setItem('cs_refresh', refreshToken)
    set({ user, isAuthenticated: true })
    connectSocket(user.id)
  },

  loginWithTokens: (user, accessToken, refreshToken) => {
    localStorage.setItem('cs_token', accessToken)
    if (refreshToken) localStorage.setItem('cs_refresh', refreshToken)
    set({ user, isAuthenticated: true })
    connectSocket(user.id)
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
