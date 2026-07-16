import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => Promise<void>
  logout: () => Promise<void>
  loadToken: () => Promise<string | null>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync('customer_token', token)
    set({ user, token, isAuthenticated: true })
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('customer_token')
    await SecureStore.deleteItemAsync('customer_refresh_token')
    set({ user: null, token: null, isAuthenticated: false })
  },

  loadToken: async () => {
    const token = await SecureStore.getItemAsync('customer_token')
    if (token) set({ token, isAuthenticated: true })
    return token
  },
}))
