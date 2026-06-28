import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  title?: string
  action?: ReactNode
}

export function Card({ children, className, title, action }: CardProps) {
  return (
    <div className={cn('rounded-xl bg-brand-surface border border-brand-border', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
          {title && <h3 className="text-sm font-semibold text-slate-100">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: { value: number; label: string }
  color?: 'teal' | 'gold' | 'red' | 'green' | 'purple'
}

export function KPICard({ title, value, subtitle, icon, color = 'teal' }: KPICardProps) {
  const colors = {
    teal: 'from-teal-500/20 to-transparent border-teal-500/30 text-teal-400',
    gold: 'from-yellow-500/20 to-transparent border-yellow-500/30 text-yellow-400',
    red: 'from-red-500/20 to-transparent border-red-500/30 text-red-400',
    green: 'from-green-500/20 to-transparent border-green-500/30 text-green-400',
    purple: 'from-purple-500/20 to-transparent border-purple-500/30 text-purple-400',
  }

  return (
    <div className={cn(
      'rounded-xl bg-gradient-to-br border p-5 flex flex-col gap-3',
      colors[color],
      'bg-brand-surface',
    )}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</p>
        {icon && <div className={cn('p-2 rounded-lg bg-brand-navy', colors[color])}>{icon}</div>}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}
