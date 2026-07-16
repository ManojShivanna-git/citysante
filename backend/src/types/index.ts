import { Request } from 'express'

// ─── User Roles ───────────────────────────────────────────────────────────

export type UserRole =
  | 'customer'
  | 'shop_owner'
  | 'rider'
  | 'field_agent'
  | 'admin'
  | 'super_admin'

// ─── Order Status ─────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'packed'
  | 'assigned'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'

// ─── Shop Status ──────────────────────────────────────────────────────────

export type ShopStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'rejected'
  | 'closed'

// ─── Auth ─────────────────────────────────────────────────────────────────

export interface AuthPayload {
  userId:    string
  role:      UserRole
  shopId?:   string   // only for shop_owner
}

export interface AuthRequest extends Request {
  user?: AuthPayload
}

// ─── Pagination ───────────────────────────────────────────────────────────

export interface PaginationQuery {
  page?:  number
  limit?: number
}

export interface PaginatedResponse<T> {
  data:        T[]
  total:       number
  page:        number
  limit:       number
  total_pages: number
}

// ─── Database Models ──────────────────────────────────────────────────────

export interface User {
  id:                string
  role:              UserRole
  name:              string
  email?:            string
  phone:             string
  profile_photo_url?: string
  is_active:         boolean
  is_verified:       boolean
  device_fcm_token?: string
  last_login_at?:    Date
  created_at:        Date
  updated_at:        Date
}

export interface Shop {
  id:                 string
  owner_id:           string
  zone_id?:           string
  name:               string
  description?:       string
  logo_url?:          string
  cover_url?:         string
  phone?:             string
  address:            string
  city:               string
  state:              string
  pincode:            string
  delivery_radius_km: number
  delivery_fee:       number
  minimum_order:      number
  delivery_time_min:  number
  delivery_time_max:  number
  status:             ShopStatus
  is_open:            boolean
  rating:             number
  total_reviews:      number
  commission_balance: number
  total_orders:       number
  created_at:         Date
  updated_at:         Date
}

export interface Category {
  id:         string
  name:       string
  image_url?: string
  sort_order: number
  is_active:  boolean
  created_at: Date
}

export interface Product {
  id:           string
  category_id:  string
  name:         string
  description?: string
  image_url?:   string
  unit:         string
  unit_value?:  number
  brand?:       string
  is_active:    boolean
  created_at:   Date
}

export interface ShopProduct {
  id:              string
  shop_id:         string
  product_id:      string
  price:           number
  discount_price?: number
  stock_qty:       number
  low_stock_alert: number
  is_available:    boolean
  total_sold:      number
  created_at:      Date
  updated_at:      Date
  // joined fields
  product_name?:   string
  product_image?:  string
  category_name?:  string
  unit?:           string
}

export interface Order {
  id:                  string
  parent_order_id?:    string
  customer_id:         string
  shop_id:             string
  rider_id?:           string
  delivery_address:    object
  status:              OrderStatus
  payment_method:      string
  subtotal:            number
  delivery_fee:        number
  tax_amount:          number
  total_amount:        number
  commission_amount:   number
  special_instructions?: string
  created_at:          Date
  updated_at:          Date
}

export interface Address {
  id:         string
  user_id:    string
  label:      string
  flat_no?:   string
  street:     string
  landmark?:  string
  city:       string
  state:      string
  pincode:    string
  is_default: boolean
  lat?:       number
  lng?:       number
}

export interface Notification {
  id:       string
  user_id:  string
  type:     string
  title:    string
  body:     string
  data?:    object
  is_read:  boolean
  sent_at:  Date
}

// ─── API Response ─────────────────────────────────────────────────────────

export interface ApiResponse<T = null> {
  success: boolean
  message: string
  data?:   T
  errors?: string[]
}

// ─── Location ─────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number
  lng: number
}

export interface RiderLocation extends LatLng {
  updated_at: string
}
