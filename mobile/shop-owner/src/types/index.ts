export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: string
  profile_photo_url?: string
}

export interface Shop {
  id: string
  name: string
  address: string
  phone: string
  is_open: boolean
  status: string
  logo_url?: string
  delivery_fee: number
  minimum_order?: number
  opening_time?: string
  closing_time?: string
  open_days?: Record<string, boolean>
  rating?: number
}

export interface OrderItem {
  id: string
  product_name: string
  product_image?: string
  unit: string
  unit_value?: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface Order {
  id: string
  order_number: string
  status: string
  customer_name: string
  customer_phone: string
  delivery_address: any
  subtotal: number
  delivery_fee: number
  tax_amount: number
  total_amount: number
  special_instructions?: string
  rider_id?: string
  rider_name?: string
  rider_phone?: string
  items?: OrderItem[]
  created_at: string
  // extended fields used in ActiveOrderScreen / HistoryScreen
  shop_name?: string
  shop_address?: string
  shop_phone?: string
  delivered_at?: string | null
}

// Aliases used by orderStore and history/active screens
export type ActiveOrder = Order
export type DeliveredOrder = Order

export interface ShopProduct {
  id: string
  product_id: string
  name: string
  brand?: string
  category_name?: string
  image_url?: string
  unit: string
  unit_value?: string
  price: number
  discount_price?: number
  stock_qty: number
  is_available: boolean
}

export interface Rider {
  id: string
  name: string
  phone: string
  profile_photo_url?: string
  is_on_duty: boolean
  is_active: boolean
}

export interface Notification {
  id: string
  title: string
  body: string
  type: string
  is_read: boolean
  reference_id?: string
  created_at: string
}
