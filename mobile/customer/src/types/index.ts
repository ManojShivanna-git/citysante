export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: string
  profile_photo_url: string | null
}

export interface Address {
  id: string
  label: string
  street: string
  city: string
  state: string
  pincode: string
  lat: number | null
  lng: number | null
  is_default: boolean
}

export interface Shop {
  id: string
  name: string
  description: string
  address: string
  city: string
  phone: string
  rating: number
  delivery_fee: number
  minimum_order: number
  delivery_time_min: number
  delivery_time_max: number
  is_open: boolean
  badges: string[]
  distance_km?: number
}

export interface Category {
  id: string
  name: string
  image_url: string
}

export interface Product {
  id: string
  name: string
  description: string
  unit: string
  unit_value: string
  brand: string
  category_name: string
  image_url: string | null
}

export interface ShopProduct {
  shop_product_id: string
  product_id: string
  name: string
  description: string
  brand: string
  unit: string
  unit_value: string
  category_name: string
  image_url: string | null
  price: number
  discount_price: number | null
  stock_qty: number
  is_available: boolean
}

export interface CartItem {
  shop_product_id: string
  product_id: string
  name: string
  price: number
  discount_price: number | null
  unit: string
  unit_value: string
  quantity: number
  shop_id: string
  shop_name: string
  image_url?: string | null
}

export type OrderStatus =
  | 'pending' | 'confirmed' | 'packed'
  | 'assigned' | 'picked_up' | 'out_for_delivery'
  | 'delivered' | 'cancelled'

export interface Order {
  id: string
  order_number: string
  status: OrderStatus
  shop_id: string
  rider_id?: string | null
  total_amount: number
  delivery_fee: number
  special_instructions: string | null
  created_at: string
  shop_name: string
  shop_address: string
  shop_phone?: string | null
  delivery_address: string | Record<string, string>
  items: OrderItem[]
  rider_name?: string
  rider_phone?: string
  ratings?: OrderRating[]
}

export interface OrderItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface OrderRating {
  type: 'shop' | 'rider' | 'product'
  target_id: string
  stars: number
  comment?: string | null
}
