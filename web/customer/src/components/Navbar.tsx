import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShoppingCart, MapPin, User, Search, Package, ChevronDown } from 'lucide-react'
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
    <header className="sticky top-0 z-40 bg-[#dc2626] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center gap-3">

          {/* ── Logo ── */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 bg-white/20 border border-white/30 rounded-xl
                            flex items-center justify-center
                            group-hover:bg-white/30 transition-colors">
              <span className="text-white text-base">🛒</span>
            </div>
            <span className="font-extrabold text-white hidden sm:block text-lg tracking-tight">
              City<span className="text-yellow-300">Sante</span>
            </span>
          </Link>

          {/* ── Location pill ── */}
          <button
            onClick={detect}
            className="hidden md:flex items-center gap-1.5 bg-white/15 hover:bg-white/25
                       border border-white/25 rounded-full px-3 py-1.5 text-sm text-white/90
                       hover:text-white transition-colors shrink-0 max-w-[200px]"
          >
            <MapPin size={13} className="text-yellow-300 shrink-0" />
            <span className="truncate">{address}</span>
            <ChevronDown size={12} className="text-white/60 shrink-0" />
          </button>

          {/* ── Search bar (grows) ── */}
          <Link
            to="/search"
            className="flex-1 hidden sm:flex items-center gap-2.5 bg-white/15 hover:bg-white/25
                       border border-white/25 rounded-full px-4 py-2.5 text-sm text-white/70
                       hover:text-white/90 transition-colors"
          >
            <Search size={15} className="text-white/50 shrink-0" />
            <span>{isHome ? 'Search tomatoes, milk, eggs…' : 'Search groceries…'}</span>
          </Link>

          {/* ── Right icons ── */}
          <div className="flex items-center gap-0.5 ml-auto sm:ml-0">
            {/* Mobile search */}
            <Link
              to="/search"
              className="p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors sm:hidden"
            >
              <Search size={20} />
            </Link>

            {/* Mobile location */}
            <button
              onClick={detect}
              className="p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors md:hidden"
            >
              <MapPin size={20} />
            </button>

            {isAuthenticated && (
              <Link
                to="/orders"
                className="p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors"
              >
                <Package size={20} />
              </Link>
            )}

            <NotificationBell />

            {/* Cart */}
            <Link
              to="/cart"
              className="relative p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors"
            >
              <ShoppingCart size={20} />
              {count > 0 && (
                <span
                  ref={badgeRef}
                  className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] bg-yellow-400 text-gray-900
                             text-[10px] font-bold rounded-full flex items-center justify-center px-1
                             ring-2 ring-[#dc2626]"
                >
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Link>

            {/* Profile */}
            <Link
              to={isAuthenticated ? '/profile' : '/login'}
              className="p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors"
            >
              <User size={20} />
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
