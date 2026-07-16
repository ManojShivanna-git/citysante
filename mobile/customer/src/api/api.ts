import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

export const API_BASE = 'http://192.168.0.100:5000/api'

// Host with no /api suffix — used to resolve relative image paths like
// "/uploads/products/butter.png" returned by the backend into an absolute
// URL the RN <Image> component can load (mobile has no "origin" to resolve against).
const API_HOST = API_BASE.replace(/\/api\/?$/, '')

export function getImageUrl(path?: string | null): string | undefined {
  if (!path) return undefined
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_HOST}${path}`
}

const api = axios.create({ baseURL: API_BASE, timeout: 15000 })

// ─── Request interceptor — attach access token ────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('customer_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Response interceptor — auto-refresh on 401 ───────────────────────────
let isRefreshing = false
let failedQueue: { resolve: (v: any) => void; reject: (e: any) => void }[] = []

const processQueue = (error: any, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)))
  failedQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const refreshToken = await SecureStore.getItemAsync('customer_refresh_token')
      if (!refreshToken) throw new Error('No refresh token')

      const res = await axios.post(`${API_BASE}/auth/refresh-token`, {
        refresh_token: refreshToken,
      })
      const { accessToken, refreshToken: newRefresh } = res.data.data

      await SecureStore.setItemAsync('customer_token', accessToken)
      if (newRefresh) await SecureStore.setItemAsync('customer_refresh_token', newRefresh)

      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`
      original.headers.Authorization = `Bearer ${accessToken}`
      processQueue(null, accessToken)
      return api(original)
    } catch (err) {
      processQueue(err, null)
      // Clear tokens and force logout
      await SecureStore.deleteItemAsync('customer_token')
      await SecureStore.deleteItemAsync('customer_refresh_token')
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────
export const authApi = {
  login:        (email: string, password: string) => api.post('/auth/login', { email, password }),
  register:     (name: string, email: string, phone: string, password: string) =>
    api.post('/auth/register', { name, email, phone, password, role: 'customer' }),
  me:           () => api.get('/auth/me'),
  logout:       () => api.post('/auth/logout'),
  saveFcmToken: (fcm_token: string) => api.post('/auth/fcm-token', { fcm_token }),
}

// ─── Shops ────────────────────────────────────────────────────────────────
// Default to Koramangala, Bangalore (where seed data shops are)
const DEFAULT_LAT = 12.9312
const DEFAULT_LNG = 77.6215

export const shopApi = {
  getAll:  (params?: any) => api.get('/shops', { params: { lat: DEFAULT_LAT, lng: DEFAULT_LNG, radius: 50, ...params } }),
  getById: (id: string)   => api.get(`/shops/${id}`),
}

// ─── Products ─────────────────────────────────────────────────────────────
export const productApi = {
  getShopProducts: (shopId: string, params?: any) =>
    api.get(`/products/shop/${shopId}`, { params }),
  search: (q: string, params?: any) =>
    api.get('/products/search', { params: { q, ...params } }),
  browse: (lat: number, lng: number, params?: any) =>
    api.get('/products/browse', { params: { lat, lng, mode: 'fast', ...params } }),
  trending: (lat: number, lng: number, params?: any) =>
    api.get('/products/trending', { params: { lat, lng, ...params } }),
  getCategories: () => api.get('/products/categories'),
}

// ─── Orders ───────────────────────────────────────────────────────────────
export const orderApi = {
  place:   (data: any)   => api.post('/orders', data),
  getAll:  (params?: any) => api.get('/orders/my', { params }),
  getById: (id: string)  => api.get(`/orders/${id}`),
  cancel:  (id: string)  => api.patch(`/orders/${id}/cancel`),
  rate:    (id: string, data: {
    shop: { stars: number; comment?: string }
    rider?: { stars: number }
    products?: { product_id: string; stars: number }[]
  }) => api.post(`/orders/${id}/rate`, data),
}

// ─── Addresses ────────────────────────────────────────────────────────────
export const addressApi = {
  getAll:  ()           => api.get('/users/addresses'),
  create:  (data: any)  => api.post('/users/addresses', data),
  delete:  (id: string) => api.delete(`/users/addresses/${id}`),
  setDefault: (id: string) => api.patch(`/users/addresses/${id}/default`),
}

export default api
