import { Link, useLocation } from 'react-router-dom'
import { Home, Search, ShoppingCart, Package, User } from 'lucide-react'
import { useCartStore } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'
import clsx from 'clsx'

export default function BottomNav() {
  const location = useLocation()
  const { itemCount } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const count = itemCount()
  const path  = location.pathname

  const tabs = [
    { to: '/',        icon: Home,         label: 'Home'    },
    { to: '/search',  icon: Search,       label: 'Search'  },
    { to: '/cart',    icon: ShoppingCart, label: 'Cart',   badge: count },
    { to: '/orders',  icon: Package,      label: 'Orders', auth: true   },
    { to: '/profile', icon: User,         label: 'Profile'              },
  ]

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch h-14">
        {tabs.map(({ to, icon: Icon, label, badge, auth }) => {
          const href   = auth && !isAuthenticated ? '/login' : to
          const active = path === to || (to !== '/' && path.startsWith(to))
          return (
            <Link
              key={to}
              to={href}
              className={clsx(
                'flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors active:scale-95',
                active ? 'text-red-500' : 'text-gray-400'
              )}
            >
              {/* Active indicator bar at top */}
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-grad rounded-b-full" />
              )}

              <div className="relative">
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] bg-grad text-white
                                   text-[9px] font-bold rounded-full flex items-center justify-center px-1
                                   ring-1 ring-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>

              <span className={clsx('text-[10px] font-semibold', active ? 'text-red-500' : 'text-gray-400')}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Safe area for devices with home indicator */}
      <div className="h-safe-bottom bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
    </nav>
  )
}
