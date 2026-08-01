import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { authApi } from './services/api'
import { connectSocket } from './services/socketService'

import Navbar           from './components/Navbar'
import LoginPage        from './pages/auth/LoginPage'
import RegisterPage     from './pages/auth/RegisterPage'
import HomePage         from './pages/home/HomePage'
import SearchPage       from './pages/home/SearchPage'
import ShopsPage        from './pages/home/ShopsPage'
import ShopPage         from './pages/shop/ShopPage'
import CartPage         from './pages/cart/CartPage'
import CheckoutPage     from './pages/cart/CheckoutPage'
import OrdersPage       from './pages/orders/OrdersPage'
import OrderDetailPage  from './pages/orders/OrderDetailPage'
import ProfilePage      from './pages/profile/ProfilePage'
import AddressPage     from './pages/profile/AddressPage'

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <Navbar />
      <main className="w-full">{children}</main>
    </div>
  )
}

export default function App() {
  const { isAuthenticated, setUser } = useAuthStore()

  useEffect(() => {
    if (localStorage.getItem('cs_token')) {
      authApi.me()
        .then((res) => {
          setUser(res.data.data)
          connectSocket(res.data.data.id)
        })
        .catch(() => {})
    }
  }, [])

  return (
    <Routes>
      {/* Auth pages — no navbar */}
      <Route path="/login"    element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} />

      {/* All other pages — with navbar */}
      <Route path="/" element={<Layout><HomePage /></Layout>} />
      <Route path="/search" element={<Layout><SearchPage /></Layout>} />
      <Route path="/shops"  element={<Layout><ShopsPage /></Layout>} />
      <Route path="/shop/:id" element={<Layout><ShopPage /></Layout>} />
      <Route path="/cart" element={<Layout><CartPage /></Layout>} />
      <Route path="/checkout" element={
        isAuthenticated
          ? <Layout><CheckoutPage /></Layout>
          : <Navigate to="/login" replace />
      } />
      <Route path="/orders" element={
        isAuthenticated
          ? <Layout><OrdersPage /></Layout>
          : <Navigate to="/login" replace />
      } />
      <Route path="/orders/:id" element={
        isAuthenticated
          ? <Layout><OrderDetailPage /></Layout>
          : <Navigate to="/login" replace />
      } />
      <Route path="/profile" element={
        isAuthenticated
          ? <Layout><ProfilePage /></Layout>
          : <Navigate to="/login" replace />
      } />
      <Route path="/profile/addresses" element={
        isAuthenticated
          ? <Layout><AddressPage /></Layout>
          : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
