import { Bell, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '@/hooks/useNotifications'
import { CountBadge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const [showNotifs, setShowNotifs] = useState(false)
  const { data: notifications, unreadCount, markRead, markAllRead } = useNotifications()

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-brand-border bg-brand-dark">
      <h1 className="text-lg font-semibold text-slate-100">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-brand-surface transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-brand-dark border border-brand-border shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
                  <span className="text-sm font-medium text-slate-200">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="text-xs text-brand-teal hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {!notifications?.length ? (
                    <p className="text-xs text-slate-500 text-center py-6">No notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markRead.mutate(n.id)}
                        className={cn(
                          'px-4 py-3 border-b border-brand-border/50 cursor-pointer hover:bg-brand-surface transition-colors',
                          !n.is_read && 'bg-brand-teal/5',
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-brand-teal mt-1.5 flex-shrink-0" />}
                          <div className={cn(!n.is_read ? 'ml-0' : 'ml-3.5')}>
                            <p className="text-xs font-medium text-slate-200">{n.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
                            <p className="text-xs text-slate-600 mt-1">{formatDateTime(n.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
