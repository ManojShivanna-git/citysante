import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      window.location.href = '/login'
    }
    const message = err.response?.data?.message || 'Something went wrong'
    toast.error(message)
    return Promise.reject(err)
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

// ─── Admin ────────────────────────────────────────────────────────────────
export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  // Shops
  getShops: (params?: Record<string, string>) =>
    api.get('/admin/shops', { params }),
  getShopDetail: (id: string) => api.get(`/admin/shops/${id}`),
  getShopOrders: (id: string, params?: Record<string, string>) =>
    api.get(`/admin/shops/${id}/orders`, { params }),
  reviewShop: (id: string, status: 'active' | 'rejected', note?: string) =>
    api.patch(`/admin/shops/${id}/review`, { status, note }),
  suspendShop: (id: string, reason: string) =>
    api.patch(`/admin/shops/${id}/suspend`, { reason }),
  reactivateShop: (id: string) =>
    api.patch(`/admin/shops/${id}/reactivate`),
  awardBadge: (shopId: string, badge: string) =>
    api.post(`/admin/shops/${shopId}/badges`, { badge }),
  removeBadge: (shopId: string, badge: string) =>
    api.delete(`/admin/shops/${shopId}/badges/${badge}`),
  // Zones
  getZones: () => api.get('/admin/zones'),
  createZone: (data: { name: string; city: string; state: string }) =>
    api.post('/admin/zones', data),
  getZoneCoverage: () => api.get('/admin/zones/coverage'),
  getZoneShops: (id: string) => api.get(`/admin/zones/${id}/shops`),
  updateZoneBoundary: (id: string, boundary: { lat: number; lng: number }[]) =>
    api.patch(`/admin/zones/${id}/boundary`, { boundary: JSON.stringify(boundary) }),
  assignShopZone: (shopId: string, zoneId: string, zoneCategory?: string) =>
    api.patch(`/admin/shops/${shopId}/zone`, { zone_id: zoneId, zone_category: zoneCategory }),
  // Billing
  getBilling: () => api.get('/admin/billing'),
  markPayment: (shopId: string, amount: number) =>
    api.post(`/admin/billing/${shopId}/payment`, { amount }),
  runBillingCheck: () => api.post('/admin/billing/run-check'),
  // Badge computation
  runBadgeCompute: () => api.post('/admin/badges/run-compute'),
  // Users
  getUsers: (params?: Record<string, string>) =>
    api.get('/admin/users', { params }),
  toggleUser: (id: string) => api.patch(`/admin/users/${id}/toggle`),
  // Product requests
  getProductRequests: (status?: string) =>
    api.get('/admin/product-requests', { params: { status } }),
  reviewProductRequest: (id: string, action: 'approve' | 'reject', extra?: { category_id?: string; admin_note?: string }) =>
    api.patch(`/admin/product-requests/${id}`, { action, ...extra }),
}

// ─── Products ─────────────────────────────────────────────────────────────
export const productApi = {
  getCategories: () => api.get('/products/categories'),
  createCategory: (data: { name: string; image_url?: string; sort_order?: number }) =>
    api.post('/products/categories', data),
  getMasterProducts: (params?: Record<string, string>) =>
    api.get('/products/catalog', { params }),
  createProduct: (data: object) => api.post('/products/catalog', data),
  updateProduct: (id: string, data: object) =>
    api.put(`/products/catalog/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/products/catalog/${id}`),
  uploadImage: (file: File, type: 'products' | 'categories') => {
    const formData = new FormData()
    formData.append('image', file)
    return api.post(`/products/upload-image?type=${type}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export default api
