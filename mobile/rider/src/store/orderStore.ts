import { create } from 'zustand'
import type { ActiveOrder } from '../types'

interface OrderState {
  activeOrder: ActiveOrder | null
  setActiveOrder: (order: ActiveOrder | null) => void
}

export const useOrderStore = create<OrderState>((set) => ({
  activeOrder: null,
  setActiveOrder: (order) => set({ activeOrder: order }),
}))
