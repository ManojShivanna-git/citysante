import { create } from 'zustand'
import type { CartItem } from '../types'

export interface ShopCart {
  shopId: string
  shopName: string
  items: CartItem[]
}

interface CartState {
  carts: ShopCart[]
  addItem: (item: CartItem) => void
  removeItem: (shopId: string, shopProductId: string) => void
  updateQty: (shopId: string, shopProductId: string, qty: number) => void
  clearShopCart: (shopId: string) => void
  clearAll: () => void
  totalItems: () => number
  shopTotal: (shopId: string) => number
  grandTotal: () => number
  getShopCart: (shopId: string) => ShopCart | undefined
  getItemQty: (shopId: string, shopProductId: string) => number
}

export const useCartStore = create<CartState>((set, get) => ({
  carts: [],

  addItem: (rawItem) => {
    const item = {
      ...rawItem,
      price: parseFloat(String(rawItem.price)),
      discount_price: rawItem.discount_price != null ? parseFloat(String(rawItem.discount_price)) : null,
    }
    const { carts } = get()
    const shopCart = carts.find((c) => c.shopId === item.shop_id)

    if (shopCart) {
      const existing = shopCart.items.find((i) => i.shop_product_id === item.shop_product_id)
      set({
        carts: carts.map((c) =>
          c.shopId === item.shop_id
            ? {
                ...c,
                items: existing
                  ? c.items.map((i) => i.shop_product_id === item.shop_product_id ? { ...i, quantity: i.quantity + 1 } : i)
                  : [...c.items, { ...item, quantity: 1 }],
              }
            : c
        ),
      })
    } else {
      set({ carts: [...carts, { shopId: item.shop_id, shopName: item.shop_name, items: [{ ...item, quantity: 1 }] }] })
    }
  },

  removeItem: (shopId, shopProductId) => {
    set({
      carts: get().carts
        .map((c) => c.shopId === shopId ? { ...c, items: c.items.filter((i) => i.shop_product_id !== shopProductId) } : c)
        .filter((c) => c.items.length > 0),
    })
  },

  updateQty: (shopId, shopProductId, qty) => {
    if (qty <= 0) { get().removeItem(shopId, shopProductId); return }
    set({
      carts: get().carts.map((c) =>
        c.shopId === shopId
          ? { ...c, items: c.items.map((i) => i.shop_product_id === shopProductId ? { ...i, quantity: qty } : i) }
          : c
      ),
    })
  },

  clearShopCart: (shopId) => set({ carts: get().carts.filter((c) => c.shopId !== shopId) }),

  clearAll: () => set({ carts: [] }),

  totalItems: () => get().carts.reduce((sum, c) => sum + c.items.reduce((s, i) => s + i.quantity, 0), 0),

  shopTotal: (shopId) => {
    const cart = get().carts.find((c) => c.shopId === shopId)
    return cart ? cart.items.reduce((sum, i) => {
      const price = parseFloat(String(i.discount_price ?? i.price))
      return sum + price * i.quantity
    }, 0) : 0
  },

  grandTotal: () => get().carts.reduce((sum, c) => sum + get().shopTotal(c.shopId), 0),

  getShopCart: (shopId) => get().carts.find((c) => c.shopId === shopId),

  getItemQty: (shopId, shopProductId) =>
    get().carts.find((c) => c.shopId === shopId)?.items.find((i) => i.shop_product_id === shopProductId)?.quantity ?? 0,
}))
