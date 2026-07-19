import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({ baseURL: '/api', timeout: 15000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cs_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cs_token')
      window.location.href = '/login'
    }
    const msg = err.response?.data?.message
    if (msg) toast.error(msg)
    return Promise.reject(err)
  }
)

export const authApi = {
  // Phone OTP (customers)
  sendOTP:      (phone: string)                              => api.post('/auth/send-otp', { phone }),
  verifyOTP:    (phone: string, otp: string, name?: string) => api.post('/auth/verify-otp', { phone, otp, ...(name ? { name } : {}) }),
  resendOTP:    (phone: string)                              => api.post('/auth/resend-otp', { phone }),
  // Password (shop owners / riders)
  register:     (data: object)                               => api.post('/auth/register', data),
  login:        (email: string, password: string)            => api.post('/auth/login', { email, password }),
  // Shared
  me:           ()                                           => api.get('/auth/me'),
  logout:       ()                                           => api.post('/auth/logout'),
  updateProfile:(data: object)                               => api.put('/auth/profile', data),
}

export const shopApi = {
  getNearby:  (lat: number, lng: number, params?: object) =>
    api.get('/shops', { params: { lat, lng, ...params } }),
  getById:    (id: string) => api.get(`/shops/${id}`),
}

export const productApi = {
  getCategories: () => api.get('/products/categories'),
  browse: (lat: number, lng: number, mode: 'fast' | 'cost', params?: object) =>
    api.get('/products/browse', { params: { lat, lng, mode, ...params } }),
  search: (q: string, lat: number, lng: number, params?: object) =>
    api.get('/products/search', { params: { q, lat, lng, ...params } }),
  trending: (lat: number, lng: number, params?: object) =>
    api.get('/products/trending', { params: { lat, lng, ...params } }),
}

export const orderApi = {
  place:    (data: object)  => api.post('/orders', data),
  getMyOrders: (params?: object) => api.get('/orders/my', { params }),
  getById:  (id: string)    => api.get(`/orders/${id}`),
  getRiderLocation: (riderId: string) => api.get(`/riders/${riderId}/location`),
  rate:     (id: string, data: {
    shop: { stars: number; comment?: string }
    rider?: { stars: number }
    products?: { product_id: string; stars: number }[]
  }) => api.post(`/orders/${id}/rate`, data),
}

export const addressApi = {
  getAll:     ()                => api.get('/users/addresses'),
  create:     (data: object)    => api.post('/users/addresses', data),
  update:     (id: string, data: object) => api.put(`/users/addresses/${id}`, data),
  setDefault: (id: string)      => api.patch(`/users/addresses/${id}/default`),
  delete:     (id: string)      => api.delete(`/users/addresses/${id}`),
}

export const notificationApi = {
  getAll:   () => api.get('/users/notifications'),
  markRead: (ids?: string[]) => api.post('/users/notifications/read', { ids }),
}

export default api
