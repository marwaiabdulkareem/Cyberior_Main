import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, CreditCard, Calendar,
  Package, UserCheck, BarChart3, Settings, LogOut, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { CountBadge } from '@/components/ui/Badge'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: string[]
  badge?: number
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/customers', label: 'Customers', icon: <Users size={18} /> },
  { to: '/deals', label: 'Deals', icon: <FileText size={18} /> },
  { to: '/payments', label: 'Payments', icon: <CreditCard size={18} /> },
  { to: '/installments', label: 'Installments', icon: <Calendar size={18} /> },
  { to: '/products', label: 'Programs', icon: <Package size={18} />, roles: ['admin', 'finance'] },
  { to: '/agents', label: 'Sales Agents', icon: <UserCheck size={18} />, roles: ['admin', 'finance'] },
  { to: '/reports', label: 'Reports', icon: <BarChart3 size={18} />, roles: ['admin', 'finance'] },
  { to: '/settings', label: 'Settings', icon: <Settings size={18} />, roles: ['admin'] },
]

export function Sidebar() {
  const { profile, signOut, isAdmin } = useAuth()

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true
    return item.roles.includes(profile?.role ?? '')
  })

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-brand-dark border-r border-brand-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-brand-border">
        <div className="w-8 h-8 rounded-lg bg-brand-teal flex items-center justify-center">
          <ShieldCheck size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100">Cyberior</p>
          <p className="text-xs text-slate-500">Payment Tracker</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-teal/20 text-brand-teal border border-brand-teal/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-brand-surface',
              )
            }
          >
            <span className="flex items-center gap-3">
              {item.icon}
              {item.label}
            </span>
            {item.badge != null && item.badge > 0 && (
              <CountBadge count={item.badge} color="red" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="px-3 py-4 border-t border-brand-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-brand-surface mb-2">
          <div className="w-8 h-8 rounded-full bg-brand-teal/20 border border-brand-teal/30 flex items-center justify-center text-xs font-bold text-brand-teal uppercase">
            {profile?.full_name?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{profile?.full_name}</p>
            <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
