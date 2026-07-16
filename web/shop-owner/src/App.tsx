import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useShopStore } from './store/shopStore'
import { authApi, shopApi } from './services/api'
import { connectSocket } from './services/socketService'

import Layout             from './components/Layout'
import LoginPage          from './pages/auth/LoginPage'
import DashboardPage      from './pages/dashboard/DashboardPage'
import OrdersPage         from './pages/orders/OrdersPage'
import ProductsPage       from './pages/products/ProductsPage'
import RidersPage         from './pages/riders/RidersPage'
import BillingPage        from './pages/billing/BillingPage'
import SettingsPage       from './pages/settings/SettingsPage'
import RegisterShopPage   from './pages/onboarding/RegisterShopPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Guard that redirects to /register-shop when the owner has no shop yet */
function RequireShop({ children }: { children: React.ReactNode }) {
  const { shop, shopLoaded } = useShopStore()
  if (!shopLoaded) {
    // Still loading — show a minimal spinner so the user doesn't see a flash
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!shop) return <Navigate to="/register-shop" replace />
  return <>{children}</>
}

export default function App() {
  const { isAuthenticated, accessToken, setUser } = useAuthStore()
  const { setShop } = useShopStore()

  useEffect(() => {
    if (!accessToken) return
    authApi.me()
      .then((res) => {
        setUser(res.data.data)
        // Reconnect socket on page refresh (login already calls this on fresh login)
        connectSocket(res.data.data.id)
      })
      .catch(() => {})
    shopApi.getMyShop()
      .then((res) => setShop(res.data.data))
      .catch(() => setShop(null))   // ← null = no shop, triggers onboarding
  }, [accessToken])

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      {/* Onboarding — auth required, but no shop yet */}
      <Route path="/register-shop" element={
        <RequireAuth>
          <RegisterShopPage />
        </RequireAuth>
      } />

      {/* Main app — auth + shop required */}
      <Route element={
        <RequireAuth>
          <RequireShop>
            <Layout />
          </RequireShop>
        </RequireAuth>
      }>
        <Route path="/"          element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/orders"    element={<OrdersPage />} />
        <Route path="/products"  element={<ProductsPage />} />
        <Route path="/riders"    element={<RidersPage />} />
        <Route path="/billing"   element={<BillingPage />} />
        <Route path="/settings"  element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
