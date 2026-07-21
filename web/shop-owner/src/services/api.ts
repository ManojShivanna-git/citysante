import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken')
      window.location.href = '/login'
    }
    toast.error(err.response?.data?.message || 'Something went wrong')
    return Promise.reject(err)
  }
)

export const authApi = {
  login:    (email: string, password: string) => api.post('/auth/login', { email, password }),
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
