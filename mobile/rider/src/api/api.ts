import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

// ─── Change this to your Mac's local IP when testing on a physical device
export const API_BASE = 'http://192.168.0.100:5000/api'
// Socket.IO root (no /api suffix)
export const SOCKET_BASE = API_BASE.replace(/\/api\/?$/, '')

const api = axios.create({ baseURL: API_BASE, timeout: 15000 })

// ─── Attach access token to every request ─────────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('rider_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── 401 auto-refresh interceptor ────────────────────────────────────────
let isRefreshing = false
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: any) => void }> = []

const processQueue = (error: any, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }
      original._retry  = true
      isRefreshing     = true
      try {
        const refresh = await SecureStore.getItemAsync('rider_refresh')
        if (!refresh) throw new Error('No refresh token')
        const res      = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: refresh })
        const newToken: string = res.data.data.accessToken
        await SecureStore.setItemAsync('rider_token', newToken)
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (err) {
        processQueue(err, null)
        await SecureStore.deleteItemAsync('rider_token')
        await SecureStore.deleteItemAsync('rider_refresh')
        // Dynamic import avoids circular dependency
        const { useAuthStore } = await import('../store/authStore')
        useAuthStore.getState().logout()
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  saveFcmToken: (fcm_token: string) =>
    api.post('/auth/fcm-token', { fcm_token }),
}

// ─── Rider ────────────────────────────────────────────────────────────────

export const riderApi = {
  toggleDuty: () => api.patch('/riders/duty'),
  updateLocation: (lat: number, lng: number) =>
    api.post('/riders/location', { lat, lng }),
  getMyShops: () => api.get('/riders/my-shops'),
}

// ─── Orders ───────────────────────────────────────────────────────────────

export const orderApi = {
  getActive: () => api.get('/orders/rider/active'),
  getHistory: (page = 1) =>
    api.get('/orders/my', { params: { status: 'delivered', page, limit: 20 } }),
  updateStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}/status`, { status }),
}

export default api
