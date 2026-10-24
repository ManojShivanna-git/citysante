import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Silent token refresh on 401 ─────────────────────────────────────────────
// When the access token expires the server returns 401. Before giving up and
// sending the user to /login, try to silently get a new access token using the
// refresh token (valid for 7 days). If that also fails, THEN redirect to login.
// This is the same pattern used by Swiggy, Zomato, Amazon etc.

let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => error ? p.reject(error) : p.resolve(token!))
  failedQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    // Only attempt refresh for 401s that haven't been retried yet
    if (err.response?.status === 401 && !original._retry) {
      const refreshToken = localStorage.getItem('refreshToken')

      // No refresh token → go to login immediately
      if (!refreshToken) {
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(err)
      }

      // If a refresh is already in-flight, queue this request until it resolves
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
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh-token`,
          { refreshToken }
        )
        const { accessToken, refreshToken: newRefresh } = res.data.data
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', newRefresh)
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`
        processQueue(null, accessToken)
        original.headers.Authorization = `Bearer ${accessToken}`
        return api(original)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    // Non-401 errors — show toast (skip for refresh-token endpoint itself)
    if (!original?.url?.includes('/auth/refresh-token')) {
      toast.error(err.response?.data?.message || 'Something went wrong')
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login:          (email: string, password: string) => api.post('/auth/login', { email, password }),
  sendEmailOTP:   (email: string)                   => api.post('/auth/send-email-otp', { email }),
  verifyEmailOTP: (email: string, otp: string)      => api.post('/auth/verify-email-otp', { email, otp }),
  firebasePhone:  (idToken: string, name?: string)  => api.post('/auth/firebase-phone', { idToken, name, expectedRole: 'shop_owner' }),
  register: (data: { name: string; email: string; phone: string; password: string }) =>
    api.post('/auth/register', { ...data, role: 'shop_owner' }),
  me:     () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

export const shopApi = {
  getMyShop: () => api.get('/shops/my-shop'),
  registerShop: (data: object) => api.post('/shops', data),
  updateShop: (id: string, data: object) => api.put(`/shops/${id}`, data),
  toggleOpen: () => api.patch('/shops/toggle-open'),
  uploadImage: (file: File, type: 'logo' | 'cover') => {
    const formData = new FormData()
    formData.append('image', file)
    return api.post(`/shops/upload-image?type=${type}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getImages: (shopId: string) => api.get(`/shops/${shopId}/images`),
  addImage: (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    return api.post('/shops/my/images?type=shops', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteImage: (imageId: string) => api.delete(`/shops/my/images/${imageId}`),
}

export const billingApi = {
  getMyBilling: () => api.get('/shops/my-billing'),
}

export const productApi = {
  getShopProducts: (shopId: string, params?: Record<string, string>) =>
    api.get(`/products/shop/${shopId}`, { params }),
  addProduct: (data: object) => api.post('/products/shop', data),
  updateStock: (id: string, data: object) => api.patch(`/products/shop/${id}/stock`, data),
  removeProduct: (id: string) => api.delete(`/products/shop/${id}`),
  getCatalog: (params?: Record<string, string>) => api.get('/products/catalog', { params }),
  getCategories: () => api.get('/products/categories'),
  requestProduct: (data: object) => api.post('/products/request', data),
  uploadImage: (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    return api.post('/products/upload-image?type=requests', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const orderApi = {
  getShopOrders: (params?: Record<string, string>) => api.get('/orders/shop', { params }),
  getOrderStats: (period: 'weekly' | 'monthly' | 'yearly') =>
    api.get('/orders/shop/stats', { params: { period } }),
  getOrderById: (id: string) => api.get(`/orders/${id}`),
  updateStatus: (id: string, status: string, rider_id?: string) =>
    api.patch(`/orders/${id}/status`, { status, rider_id }),
}

export const riderApi = {
  getShopRiders: (_shopId?: string) => api.get('/riders/shop/my'),
  lookupByPhone: (phone: string) => api.get('/riders/lookup', { params: { phone } }),
  addRider: (phone: string) => api.post('/riders/shop/add', { phone }),
  removeRider: (riderId: string) => api.delete(`/riders/shop/${riderId}`),
}

export const notificationApi = {
  getAll:   () => api.get('/users/notifications'),
  markRead: (ids?: string[]) => api.post('/users/notifications/read', { ids }),
}

export default api
