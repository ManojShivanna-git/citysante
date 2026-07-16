import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { authApi } from './services/api'

import Layout           from './components/Layout'
import LoginPage        from './pages/auth/LoginPage'
import DashboardPage    from './pages/dashboard/DashboardPage'
import ShopsPage        from './pages/shops/ShopsPage'
import ShopDetailPage   from './pages/shops/ShopDetailPage'
import ProductsPage     from './pages/products/ProductsPage'
import ZonesPage        from './pages/zones/ZonesPage'
import BillingPage      from './pages/billing/BillingPage'
import UsersPage        from './pages/users/UsersPage'
import ProductRequestsPage from './pages/products/ProductRequestsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { isAuthenticated, accessToken } = useAuthStore()

  // Fetch user profile on load if token exists
  useEffect(() => {
    if (accessToken) {
      authApi.me()
        .then((res) => useAuthStore.setState({ user: res.data.data }))
        .catch(() => {})
    }
  }, [])

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
      } />

      <Route element={
        <RequireAuth>
          <Layout />
        </RequireAuth>
      }>
        <Route path="/"                 element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"        element={<DashboardPage />} />
        <Route path="/shops"            element={<ShopsPage />} />
        <Route path="/shops/:id"        element={<ShopDetailPage />} />
        <Route path="/products"         element={<ProductsPage />} />
        <Route path="/zones"            element={<ZonesPage />} />
        <Route path="/billing"          element={<BillingPage />} />
        <Route path="/users"            element={<UsersPage />} />
        <Route path="/product-requests" element={<ProductRequestsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
