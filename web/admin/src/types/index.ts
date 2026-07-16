export type UserRole = 'customer' | 'shop_owner' | 'rider' | 'admin' | 'super_admin' | 'field_agent'
export type ShopStatus = 'pending' | 'active' | 'suspended' | 'rejected'
export type OrderStatus = 'pending' | 'confirmed' | 'packed' | 'assigned' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled'

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  is_active: boolean
  is_verified: boolean
  profile_photo_url: string | null
  created_at: string
}

export interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export interface Shop {
  id: string
  name: string
  description: string
  phone: string
  address: string
  city: string
  state: string
  pincode: string
  lat: number
  lng: number
  delivery_fee: number
  minimum_order: number
  delivery_time_min: number
  delivery_time_max: number
  rating: number
  total_reviews: number
  status: ShopStatus
  is_open: boolean
  zone_id: string | null
  zone_category: string
  logo_url: string | null
  badges: string[]
  owner_name: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  image_url: string
  sort_order: number
  is_active: boolean
}

export interface Product {
  id: string
  category_id: string
  category_name: string
  name: string
  description: string
  image_url: string | null
  unit: string
  unit_value: string
  brand: string | null
  is_active: boolean
  created_at: string
}

export interface Zone {
  id: string
  name: string
  city: string
  state: string
  boundary: string | null
  is_active: boolean
  created_at: string
}

export interface ZoneCoverage {
  zone_id: string
  zone_name: string
  city: string
  has_grocery: boolean
  has_vegetable: boolean
  has_dairy: boolean
  shop_count: number
  coverage_status: 'complete' | 'partial' | 'empty'
}

export interface BillingRecord {
  shop_id: string
  shop_name: string
  city: string
  commission_balance: number
  total_orders: number
  shop_status: string
  billing_alert: 'early_payment_required' | 'payment_due' | 'accumulating'
  updated_at: string
}

export interface DashboardStats {
  orders:  { today: number; total: number; pending: number; delivered_today: number }
  shops:   { active: number; pending: number; total: number; suspended: number }
  users:   { total: number; customers: number; shop_owners: number; riders: number }
  billing: { overdue_count: number; total_pending: number }
  weekly_orders: { day: string; orders: number }[]
}

export interface ProductRequest {
  id: string
  shop_id: string
  shop_name: string
  name: string
  description: string
  image_url: string | null
  unit: string
  brand: string | null
  category_id: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}
