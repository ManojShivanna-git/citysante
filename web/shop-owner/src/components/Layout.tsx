import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ShoppingBag, Package, Users, CreditCard, Settings, LogOut, Menu, X, Power } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useShopStore } from '../store/shopStore'
import { shopApi, orderApi } from '../services/api'
import NewOrderAlert from './NewOrderAlert'
import NotificationBell from './NotificationBell'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function Layout() {
  const [open, setOpen] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const { user, logout } = useAuthStore()
  const { shop, toggleOpen } = useShopStore()
  const navigate = useNavigate()

  // ── Poll pending order count every 15 s for sidebar badge ──────────────
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await orderApi.getShopOrders({ status: 'pending' })
        setPendingCount((res.data.data || []).length)
      } catch {}
    }
    fetchCount()
    const t = setInterval(fetchCount, 15_000)
    return () => clearInterval(t)
  }, [])

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: 0            },
    { to: '/orders',    icon: ShoppingBag,     label: 'Orders',    badge: pendingCount  },
    { to: '/products',  icon: Package,         label: 'Products',  badge: 0             },
    { to: '/riders',    icon: Users,           label: 'Riders',    badge: 0             },
    { to: '/billing',   icon: CreditCard,      label: 'Billing',   badge: 0             },
    { to: '/settings',  icon: Settings,        label: 'Settings',  badge: 0             },
  ]

  const handleLogout = () => { logout(); navigate('/login') }

  const handleToggleShop = async () => {
    try {
      await shopApi.toggleOpen()
      toggleOpen()
      toast.success(shop?.is_open ? 'Shop is now closed' : 'Shop is now open')
    } catch {}
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* New-order alert modal — renders over everything */}
      <NewOrderAlert />
      {/* Sidebar */}
      <aside className={clsx('flex flex-col bg-gray-900 text-white transition-all duration-300 shrink-0', open ? 'w-56' : 'w-16')}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-700">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs text-white">
            {shop?.name?.charAt(0) || 'S'}
          </div>
          {open && (
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{shop?.name || 'My Shop'}</div>
              <div className="text-xs text-gray-400">Shop Owner</div>
            </div>
          )}
          <button onClick={() => setOpen(!open)} className="text-gray-400 hover:text-white shrink-0">
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* Shop open/close toggle */}
        <div className="px-3 py-3 border-b border-gray-700">
          <button
            onClick={handleToggleShop}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              shop?.is_open ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
            )}
          >
            <Power size={15} className="shrink-0" />
            {open && <span>{shop?.is_open ? 'Shop Open' : 'Shop Closed'}</span>}
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink key={to} to={to} className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}>
              {/* Icon with optional badge dot when sidebar is collapsed */}
              <span className="relative shrink-0">
                <Icon size={18} />
                {badge > 0 && !open && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-orange-500 rounded-full border border-gray-900" />
                )}
              </span>
              {open && (
                <>
                  <span className="flex-1">{label}</span>
                  {badge > 0 && (
                    <span className="min-w-[20px] h-5 bg-orange-500 text-white text-[11px] font-bold
                                     rounded-full flex items-center justify-center px-1.5 leading-none">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-700 p-3">
          {open ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-brand-500 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                {user?.name?.charAt(0) || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{user?.name}</div>
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-400"><LogOut size={15} /></button>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full flex justify-center text-gray-400 hover:text-red-400 py-1">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — admin notifications only (billing, suspensions, approvals) */}
        <div className="flex items-center justify-end px-6 py-3 bg-white border-b border-gray-100 shrink-0">
          <NotificationBell />
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
