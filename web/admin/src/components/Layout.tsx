import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Store, Package, MapPin, CreditCard,
  Users, LogOut, Menu, X, ChevronRight, Bell, ShoppingBag
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import clsx from 'clsx'

const navItems = [
  { to: '/dashboard',        icon: LayoutDashboard, label: 'Dashboard'        },
  { to: '/shops',            icon: Store,           label: 'Shops'             },
  { to: '/products',         icon: Package,         label: 'Products'          },
  { to: '/zones',            icon: MapPin,          label: 'Zones'             },
  { to: '/billing',          icon: CreditCard,      label: 'Billing'           },
  { to: '/users',            icon: Users,           label: 'Users'             },
  { to: '/product-requests', icon: ShoppingBag,     label: 'Product Requests'  },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col bg-gray-900 text-white transition-all duration-300 shrink-0',
        sidebarOpen ? 'w-60' : 'w-16'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-700">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm">
            CS
          </div>
          {sidebarOpen && (
            <div>
              <div className="font-bold text-sm leading-tight">Isanthe</div>
              <div className="text-xs text-gray-400">Admin Panel</div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-gray-400 hover:text-white"
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-gray-700 p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user?.name || 'Admin'}</div>
                <div className="text-xs text-gray-400 truncate">{user?.role}</div>
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-400">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full flex justify-center text-gray-400 hover:text-red-400 py-1">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <ChevronRight size={14} />
            <span className="capitalize">{location.pathname.split('/')[1] || 'dashboard'}</span>
          </div>
          <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <Bell size={18} />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
