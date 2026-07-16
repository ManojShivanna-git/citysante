import { create } from 'zustand'
import { authApi } from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socketService'
import type { User } from '../types'

interface AuthState {
  user: User | null; isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void; setUser: (u: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('cs_token'),
  login: async (email, password) => {
    const res = await authApi.login(email, password)
    const { user, accessToken, refreshToken } = res.data.data
    localStorage.setItem('cs_token', accessToken)
    localStorage.setItem('cs_refresh', refreshToken)
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
