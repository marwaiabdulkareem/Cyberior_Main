import { clsx, type ClassValue } from 'clsx'
import { format, isAfter, isBefore, parseISO, differenceInDays } from 'date-fns'
import type { InstallmentStatus, Currency } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number, currency: Currency = 'USD', otherLabel?: string | null): string {
  if (currency === 'IQD') {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      maximumFractionDigits: 0,
    }).format(amount)
  }
  if (currency === 'TRY') {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 2,
    }).format(amount)
  }
  if (currency === 'OTHER') {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount)} ${otherLabel || '(other currency)'}`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy')
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy, HH:mm')
  } catch {
    return dateStr
  }
}

export function isOverdue(dueDateStr: string, status: InstallmentStatus): boolean {
  if (status === 'paid' || status === 'cancelled' || status === 'paused') return false
  const dueDate = parseISO(dueDateStr)
  return isBefore(dueDate, new Date())
}

export function isDueSoon(dueDateStr: string, daysAhead = 3): boolean {
  const dueDate = parseISO(dueDateStr)
  const today = new Date()
  const diff = differenceInDays(dueDate, today)
  return diff >= 0 && diff <= daysAhead
}

export function calcRemainingBalance(totalAmount: number, totalPaid: number): number {
  return Math.max(0, totalAmount - totalPaid)
}

export function calcCollectionRate(collected: number, total: number): number {
  if (total === 0) return 0
  return Math.round((collected / total) * 100)
}

export function calcCommission(dealPrice: number, commissionRate: number): number {
  return (dealPrice * commissionRate) / 100
}

export function generateInstallmentDates(
  startDate: string,
  count: number,
  intervalDays = 30
): string[] {
  const dates: string[] = []
  let current = parseISO(startDate)
  for (let i = 0; i < count; i++) {
    dates.push(format(current, 'yyyy-MM-dd'))
    current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000)
  }
  return dates
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Deal + customer statuses
    active: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
    completed: 'bg-green-500/20 text-green-300 border border-green-500/30',
    cancelled: 'bg-red-500/20 text-red-300 border border-red-500/30',
    refunded: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    paused: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    lead: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
    contacted: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    enrolled: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    // Installment statuses
    pending: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    paid: 'bg-green-500/20 text-green-300 border border-green-500/30',
    partial: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    late: 'bg-red-500/20 text-red-300 border border-red-500/30',
  }
  return colors[status] ?? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
}

export function truncate(str: string, maxLen = 40): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '…'
}

export function isAfterToday(dateStr: string): boolean {
  return isAfter(parseISO(dateStr), new Date())
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms = 300): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}
