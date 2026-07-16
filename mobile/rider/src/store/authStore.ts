import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isOnDuty: boolean
  isAuthenticated: boolean
  setAuth: (user: User, token: string, refreshToken?: string) => Promise<void>
  setOnDuty: (val: boolean) => void
  logout: () => Promise<void>
  loadToken: () => Promise<string | null>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isOnDuty: false,
  isAuthenticated: false,

  setAuth: async (user, token, refreshToken?: string) => {
    await SecureStore.setItemAsync('rider_token', token)
    if (refreshToken) await SecureStore.setItemAsync('rider_refresh', refreshToken)
    set({ user, token, isAuthenticated: true, isOnDuty: (user as any).is_on_duty ?? false })
  },

  setOnDuty: (val) => set({ isOnDuty: val }),

  logout: async () => {
    await SecureStore.deleteItemAsync('rider_token')
    set({ user: null, token: null, isAuthenticated: false, isOnDuty: false })
  },

  loadToken: async () => {
    const token = await SecureStore.getItemAsync('rider_token')
    if (token) set({ token, isAuthenticated: true })
    return token
  },
}))
