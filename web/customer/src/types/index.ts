export interface User {
  id: string; name: string; email: string; phone: string; role: string
}

export interface Shop {
  id: string; name: string; description: string; logo_url: string | null
  delivery_fee: number; minimum_order: number; delivery_time_min: number
  delivery_time_max: number; rating: number; total_reviews: number
  is_open: boolean; distance: number; badges: string[]
  city: string; zone_category: string
}

export interface ShopProduct {
  id: string; product_id: string; name: string; description: string
  image_url: string | null; unit: string; unit_value: string; brand: string | null
  category_id: string; category_name: string; price: number
  discount_price: number | null; stock_qty: number; is_available: boolean
}

export interface Category {
  id: string; name: string; image_url: string; sort_order: number
}

export interface CartItem {
  shopProductId: string; productId: string; shopId: string; shopName: string
  name: string; unit: string; unit_value: string; price: number
  discount_price: number | null; quantity: number; image_url: string | null
}

export interface Order {
  id: string; order_number: string
  status: 'pending' | 'confirmed' | 'packed' | 'assigned' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled'
  total_amount: number; delivery_fee: number; subtotal: number; tax_amount: number
  shop_name: string; shop_id: string; shop_phone?: string | null; created_at: string
  delivery_address: string
  special_instructions: string | null
  rider_id?: string | null; rider_name?: string; rider_phone?: string
  shop_logo?: string | null
  items: { product_id: string; product_name: string; product_image?: string | null; quantity: number; unit_price: number; total_price: number; subtotal: number }[]
  tracking?: { status: string; created_at: string; note?: string }[]
  ratings?: { type: 'shop' | 'rider' | 'product'; target_id: string; stars: number; comment?: string | null }[]
}

export interface SearchResult {
  id: string; price: number; discount_price: number | null; effective_price: number
  product_id: string; product_name: string; image_url: string | null
  unit: string; unit_value: string; brand: string | null; category_name: string
  shop_id: string; shop_name: string; delivery_fee: number
  delivery_time_min: number; delivery_time_max: number; is_open: boolean
  rating: number; distance: number
}
