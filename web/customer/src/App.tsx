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
      {/* Red Navbar is sticky — see Navbar.tsx */}
      <Navbar />

      {/* ── Swiggy-style gradient hero with SVG wave ── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #991b1b 0%, #dc2626 55%, #b91c1c 100%)',
          paddingBottom: 0,
        }}
      >
        {/* Decorative circles — large → small, creating depth */}
        <div style={{ position: 'absolute', right: -50, top: -80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 110, top: -24, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.045)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: -36, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: 90, bottom: 28, width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />

        {/* Content row */}
        <div
          className="relative flex items-center gap-4 max-w-7xl mx-auto"
          style={{ padding: '16px 24px 52px' }}
        >
          {/* Frosted icon box */}
          <div
            style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}
          >
            🛵
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: 0, letterSpacing: '-0.3px', lineHeight: 1.3 }}>
              Fresh groceries delivered in minutes
            </p>
            <p style={{ color: 'rgba(255,255,255,0.70)', fontSize: 12, margin: '3px 0 0', lineHeight: 1.4 }}>
              Nearby shops · Real-time tracking · Best prices
            </p>
          </div>

          {/* Live indicator — desktop only */}
          <div
            className="hidden sm:flex items-center gap-2 flex-shrink-0"
            style={{
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: 20, padding: '6px 14px',
            }}
          >
            <span
              style={{
                width: 7, height: 7, borderRadius: '50%',
                backgroundColor: '#4ade80', display: 'inline-block', flexShrink: 0,
                boxShadow: '0 0 0 3px rgba(74,222,128,0.28)',
              }}
            />
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Shops are open</span>
          </div>
        </div>

        {/* SVG wave — transitions hero red into the content background */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, lineHeight: 0 }}>
          <svg
            viewBox="0 0 1440 52"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            style={{ display: 'block', width: '100%', height: 52 }}
          >
            <path
              d="M0,20 C280,52 560,0 840,26 C1040,42 1240,8 1440,22 L1440,52 L0,52 Z"
              fill="#f9fafb"
            />
          </svg>
        </div>
      </div>

      {/* ── Content area ── */}
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
