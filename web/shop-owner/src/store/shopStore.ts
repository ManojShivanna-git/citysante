import { create } from 'zustand'
import type { Shop } from '../types'

interface ShopState {
  shop: Shop | null
  shopLoaded: boolean
  setShop: (shop: Shop | null) => void
  toggleOpen: () => void
}

export const useShopStore = create<ShopState>((set) => ({
  shop: null,
  shopLoaded: false,
  setShop: (shop) => set({ shop, shopLoaded: true }),
  toggleOpen: () => set((s) => s.shop ? { shop: { ...s.shop, is_open: !s.shop.is_open } } : {}),
}))
