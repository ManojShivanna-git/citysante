export type OrderStatus = 'pending' | 'confirmed' | 'packed' | 'assigned' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled'

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: string
}

export interface Shop {
  id: string
  name: string
  description: string
  phone: string
  address: string
  city: string
  logo_url: string | null
  cover_url: string | null
  delivery_fee: number
  minimum_order: number
  delivery_time_min: number
  delivery_time_max: number
  rating: number
  total_reviews: number
  is_open: boolean
  status: string
  commission_balance: number
  badges: string[]
}

export interface ShopProduct {
  id: string
  product_id: string
  name: string
  description: string
  image_url: string | null
  unit: string
  unit_value: string
  brand: string | null
  category_id: string
  category_name: string
  price: number
  discount_price: number | null
  stock_qty: number
  is_available: boolean
  total_sold: number
  low_stock_alert: number
}

export interface Order {
  id: string
  order_number: string
  status: OrderStatus
  total_amount: number
  delivery_fee: number
  delivery_address: string
  customer_name: string
  customer_phone: string
  created_at: string
  items: OrderItem[]
  rider_name?: string
}

export interface OrderItem {
  id: string
  product_name: string
  product_image: string | null
  quantity: number
  unit_price: number
  total_price: number
  unit: string
  unit_value?: string
}

export interface Rider {
  id: string
  name: string
  phone: string
  is_on_duty: boolean
  active_order_id: string | null
}

export type BillingAlert = 'accumulating' | 'payment_due' | 'early_payment_required'

export interface BillingHistoryRow {
  id: string
  period_start: string
  period_end: string | null
  total_orders: number
  commission_rate: number
  total_commission: number
  status: 'pending' | 'paid' | 'overdue' | 'waived'
  due_date: string | null
  paid_amount: number
  paid_at: string | null
  payment_reference: string | null
  created_at: string
}

export interface BillingInfo {
  commission_balance: number
  payment_due_at: string | null
  billing_alert: BillingAlert
  shop_status: string
  commission_rate: number
  payment_threshold: number
  fast_growth_threshold: number
  history: BillingHistoryRow[]
}

export interface Category {
  id: string
  name: string
  image_url: string | null
  sort_order: number
}

export interface CatalogProduct {
  id: string
  name: string
  category_id: string
  category_name: string
  unit: string
  unit_value: string
  brand: string | null
  image_url: string | null
}
