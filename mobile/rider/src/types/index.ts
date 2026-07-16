export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: string
  profile_photo_url: string | null
}

export interface OrderItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
  unit: string
}

export interface ActiveOrder {
  id: string
  order_number: string
  status: 'assigned' | 'picked_up' | 'out_for_delivery' | 'delivered'
  total_amount: number
  delivery_fee: number
  // Shop (pickup)
  shop_name: string
  shop_address: string
  shop_phone: string
  // Customer (delivery)
  customer_name: string
  customer_phone: string
  delivery_address: string | Record<string, string>
  // Timestamps
  assigned_at: string
  created_at: string
  // Items
  items?: OrderItem[]
}

export interface DeliveredOrder {
  id: string
  order_number: string
  status: string
  total_amount: number
  shop_name: string
  customer_name: string
  delivered_at: string
  created_at: string
}
