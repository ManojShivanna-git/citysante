import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShoppingCart, MapPin, User, Search, Package, ChevronDown, Tag } from 'lucide-react'
import { useCartStore } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'
import { useLocationStore } from '../store/locationStore'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const { itemCount } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const { address, detect } = useLocationStore()
  const location = useLocation()
  const count    = itemCount()
  const isHome   = location.pathname === '/'

  const badgeRef  = useRef<HTMLSpanElement>(null)
  const prevCount = useRef(count)
  useEffect(() => {
    if (count > prevCount.current && badgeRef.current) {
      const el = badgeRef.current
      el.classList.remove('animate-badge-pop')
      void el.offsetWidth
      el.classList.add('animate-badge-pop')
      el.addEventListener('animationend', () => el.classList.remove('animate-badge-pop'), { once: true })
    }
    prevCount.current = count
  }, [count])

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center gap-4">

          {/* ── Logo ── */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm bg-grad">
              <span className="text-white text-base">🛒</span>
            </div>
            <span className="font-extrabold hidden sm:block text-lg tracking-tight text-grad">
              Isanthe
            </span>
          </Link>

          {/* ── Location ── */}
          <button
            onClick={detect}
            className="hidden md:flex items-center gap-1.5 text-sm text-gray-700 hover:text-red-600 transition-colors shrink-0 max-w-[200px]"
          >
            <MapPin size={14} className="text-brand-500 shrink-0" />
            <span className="font-semibold truncate">{address}</span>
            <ChevronDown size={13} className="text-gray-400 shrink-0" />
          </button>

          {/* ── Search bar ── */}
          <div className="flex-1 hidden sm:flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
            <Search size={15} className="text-gray-400 ml-4 shrink-0" />
            <Link
              to="/search"
              className="flex-1 px-3 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              {isHome ? 'Search tomatoes, milk, eggs…' : 'Search groceries…'}
            </Link>
            <Link
              to="/search"
              className="bg-grad text-white px-4 py-[11px] flex items-center justify-center transition-colors"
            >
              <Search size={16} />
            </Link>
          </div>

          {/* ── Right icons ── */}
          <div className="flex items-center gap-0.5 ml-auto sm:ml-0">

            {/* Mobile search */}
            <Link to="/search" className="p-2.5 rounded-xl text-gray-500 hover:text-red-600 hover:bg-gray-50 transition-colors sm:hidden">
              <Search size={20} />
            </Link>

            {/* Mobile location */}
            <button onClick={detect} className="p-2.5 rounded-xl text-gray-500 hover:text-red-600 hover:bg-gray-50 transition-colors md:hidden">
              <MapPin size={20} />
            </button>

            {/* Offers */}
            <Link to="/search" className="hidden md:flex flex-col items-center gap-0.5 px-3 py-2 text-gray-500 hover:text-red-600 transition-colors">
              <Tag size={19} />
              <span className="text-[10px] font-semibold">Offers</span>
            </Link>

            {/* Orders */}
            <Link to={isAuthenticated ? '/orders' : '/login'} className="hidden md:flex flex-col items-center gap-0.5 px-3 py-2 text-gray-500 hover:text-red-600 transition-colors">
              <Package size={19} />
              <span className="text-[10px] font-semibold">Orders</span>
            </Link>

            <NotificationBell />

            {/* Cart */}
            <Link to="/cart" className="relative flex flex-col items-center gap-0.5 px-3 py-2 text-gray-500 hover:text-red-600 transition-colors">
              <ShoppingCart size={19} />
              <span className="text-[10px] font-semibold hidden md:block">Cart</span>
              {count > 0 && (
                <span
                  ref={badgeRef}
                  className="absolute top-1 right-1 min-w-[17px] h-[17px] bg-grad text-white
                             text-[10px] font-bold rounded-full flex items-center justify-center px-1
                             ring-2 ring-white"
                >
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Link>

            {/* Profile */}
            <Link to={isAuthenticated ? '/profile' : '/login'} className="flex flex-col items-center gap-0.5 px-3 py-2 text-gray-500 hover:text-red-600 transition-colors">
              <User size={19} />
              <span className="text-[10px] font-semibold hidden md:block">Profile</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
