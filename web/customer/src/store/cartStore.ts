import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '../types'

export interface ShopCart {
  shopId: string
  shopName: string
  items: CartItem[]
}

interface CartState {
  carts: ShopCart[]
  addItem: (item: CartItem) => void
  removeItem: (shopProductId: string) => void
  updateQty: (shopProductId: string, qty: number) => void
  clearShopCart: (shopId: string) => void
  clearCart: () => void
  itemCount: () => number
  shopTotal: (shopId: string) => number
  total: () => number
}

// Items are grouped per shop (carts: ShopCart[]) rather than one flat list.
// A customer can add items from more than one shop — at checkout, one order
// is placed per shop cart, each with its own rider and its own COD payment.
// This is how Isanthe satisfies the "split orders" rule: if no single shop
// has everything the customer wants, the cart itself is already split by
// shop, so checkout naturally produces separate orders.
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      carts: [],

      addItem: (newItem) => set((s) => {
        const cart = s.carts.find((c) => c.shopId === newItem.shopId)
        if (cart) {
          const existing = cart.items.find((i) => i.shopProductId === newItem.shopProductId)
          return {
            carts: s.carts.map((c) =>
              c.shopId === newItem.shopId
                ? {
                    ...c,
                    items: existing
                      ? c.items.map((i) => i.shopProductId === newItem.shopProductId ? { ...i, quantity: i.quantity + 1 } : i)
                      : [...c.items, { ...newItem, quantity: 1 }],
                  }
                : c
            ),
          }
        }
        return { carts: [...s.carts, { shopId: newItem.shopId, shopName: newItem.shopName, items: [{ ...newItem, quantity: 1 }] }] }
      }),

      // shop_product_id is a globally unique UUID, so it's enough on its own
      // to find which shop's sub-cart an item lives in.
      removeItem: (shopProductId) => set((s) => ({
        carts: s.carts
          .map((c) => ({ ...c, items: c.items.filter((i) => i.shopProductId !== shopProductId) }))
          .filter((c) => c.items.length > 0),
      })),

      updateQty: (shopProductId, qty) => {
        if (qty <= 0) { get().removeItem(shopProductId); return }
        set((s) => ({
          carts: s.carts.map((c) => ({
            ...c,
            items: c.items.map((i) => i.shopProductId === shopProductId ? { ...i, quantity: qty } : i),
          })),
        }))
      },

      clearShopCart: (shopId) => set((s) => ({ carts: s.carts.filter((c) => c.shopId !== shopId) })),

      clearCart: () => set({ carts: [] }),

      itemCount: () => get().carts.reduce((sum, c) => sum + c.items.reduce((s, i) => s + i.quantity, 0), 0),

      shopTotal: (shopId) => {
        const cart = get().carts.find((c) => c.shopId === shopId)
        return cart ? cart.items.reduce((sum, i) => sum + (i.discount_price ?? i.price) * i.quantity, 0) : 0
      },

      total: () => get().carts.reduce((sum, c) => sum + get().shopTotal(c.shopId), 0),
    }),
    { name: 'citysante-cart' }
  )
)
