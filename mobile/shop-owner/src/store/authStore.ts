import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { User, Shop } from '../types'

interface AuthState {
  user: User | null
  shop: Shop | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string, shop?: Shop) => Promise<void>
  setShop: (shop: Shop) => void
  logout: () => Promise<void>
  loadToken: () => Promise<string | null>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  shop: null,
  token: null,
  isAuthenticated: false,

  setAuth: async (user, token, shop) => {
    await SecureStore.setItemAsync('shop_token', token)
    set({ user, token, shop: shop || null, isAuthenticated: true })
  },

  setShop: (shop) => set({ shop }),

  logout: async () => {
    await SecureStore.deleteItemAsync('shop_token')
    await SecureStore.deleteItemAsync('shop_refresh_token')
    set({ user: null, shop: null, token: null, isAuthenticated: false })
  },

  loadToken: async () => {
    const token = await SecureStore.getItemAsync('shop_token')
    if (token) set({ token, isAuthenticated: true })
    return token
  },
}))
