import { cn, getStatusColor } from '@/lib/utils'
import {
  CUSTOMER_STATUS_LABELS,
  DEAL_STATUS_LABELS,
  INSTALLMENT_STATUS_LABELS,
  type CustomerStatus,
  type DealStatus,
  type InstallmentStatus,
} from '@/types'

interface BadgeProps {
  status: CustomerStatus | DealStatus | InstallmentStatus | string
  className?: string
}

export function StatusBadge({ status, className }: BadgeProps) {
  const label =
    CUSTOMER_STATUS_LABELS[status as CustomerStatus] ??
    DEAL_STATUS_LABELS[status as DealStatus] ??
    INSTALLMENT_STATUS_LABELS[status as InstallmentStatus] ??
    status

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        getStatusColor(status),
        className,
      )}
    >
      {label}
    </span>
  )
}

interface CountBadgeProps {
  count: number
  color?: 'teal' | 'red' | 'yellow' | 'green'
}

export function CountBadge({ count, color = 'teal' }: CountBadgeProps) {
  const colors = {
    teal: 'bg-brand-teal text-white',
    red: 'bg-red-500 text-white',
    yellow: 'bg-yellow-500 text-black',
    green: 'bg-green-500 text-white',
  }
  return (
    <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold', colors[color])}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
