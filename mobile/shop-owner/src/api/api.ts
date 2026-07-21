import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

export const API_BASE = 'https://api.isanthe.com/api'

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

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('shop_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Auto-refresh on 401 ──────────────────────────────────────────────────
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
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error)
    if (isRefreshing) {
      return new Promise((resolve, reject) => { failedQueue.push({ resolve, reject }) })
        .then((token) => { original.headers.Authorization = `Bearer ${token}`; return api(original) })
    }
    original._retry = true
    isRefreshing = true
    try {
      const refreshToken = await SecureStore.getItemAsync('shop_refresh_token')
      if (!refreshToken) throw new Error('No refresh token')
      const res = await axios.post(`${API_BASE}/auth/refresh-token`, { refresh_token: refreshToken })
      const { accessToken, refreshToken: newRefresh } = res.data.data
      await SecureStore.setItemAsync('shop_token', accessToken)
      if (newRefresh) await SecureStore.setItemAsync('shop_refresh_token', newRefresh)
      processQueue(null, accessToken)
      original.headers.Authorization = `Bearer ${accessToken}`
      return api(original)
    } catch (err) {
      processQueue(err, null)
      await SecureStore.deleteItemAsync('shop_token')
      await SecureStore.deleteItemAsync('shop_refresh_token')
      return Promise.reject(err)
    } finally { isRefreshing = false }
  }
)

export const authApi = {
  login:        (email: string, password: string) => api.post('/auth/login', { email, password }),
  me:           () => api.get('/auth/me'),
  logout:       () => api.post('/auth/logout'),
  saveFcmToken: (fcm_token: string) => api.post('/auth/fcm-token', { fcm_token }),
}

export const shopApi = {
  getMyShop:    () => api.get('/shops/my-shop'),
  registerShop: (data: object) => api.post('/shops', data),
  toggleOpen:   () => api.patch('/shops/toggle-open'),
  update:       (id: string, data: any) => api.put(`/shops/${id}`, data),
}

export const orderApi = {
  getShopOrders: (params?: any) => api.get('/orders/shop', { params }),
  getById:       (id: string)   => api.get(`/orders/${id}`),
  updateStatus:  (id: string, status: string, rider_id?: string, note?: string) =>
    api.patch(`/orders/${id}/status`, { status, rider_id, note }),
  getHistory:    () => api.get('/orders/shop', { params: { status: 'delivered' } }),
}

export const productApi = {
  getShopProducts:   (shopId: string) => api.get(`/products/shop/${shopId}`),
  updateStock:       (id: string, stock_qty: number) =>
    api.patch(`/products/shop/${id}/stock`, { stock_qty }),
  updateStockFull:   (id: string, data: { stock_qty?: number; price?: number; discount_price?: number; is_available?: boolean }) =>
    api.patch(`/products/shop/${id}/stock`, data),
  toggleAvailable:   (id: string, is_available: boolean) =>
    api.patch(`/products/shop/${id}/stock`, { is_available }),
  removeProduct:     (id: string) => api.delete(`/products/shop/${id}`),
  // Master catalog — browse + add
  getCatalog:        (params?: { search?: string; category_id?: string; page?: number }) =>
    api.get('/products', { params: { limit: 30, ...params } }),
  getCategories:     () => api.get('/products/categories'),
  addFromCatalog:    (data: { product_id: string; price: number; discount_price?: number; stock_qty: number }) =>
    api.post('/products/shop', data),
  // Request new product to admin
  requestNewProduct: (data: { name: string; description?: string; unit: string; brand?: string }) =>
    api.post('/products/requests', data),
}

export const billingApi = {
  getHistory: () => api.get('/shops/my-billing'),
}

export const riderApi = {
  getShopRiders:  () => api.get('/riders/shop/my'),
  lookupByPhone:  (phone: string) => api.get('/riders/lookup', { params: { phone } }),
  addRider:       (phone: string) => api.post('/riders/shop/add', { phone }),
}

export const notificationApi = {
  getAll:   () => api.get('/users/notifications'),
  markRead: (ids?: string[]) => api.post('/users/notifications/read', { ids }),
}

export default api
