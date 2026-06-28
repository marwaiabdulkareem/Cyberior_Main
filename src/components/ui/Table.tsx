import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  sortable?: boolean
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField?: keyof T
  loading?: boolean
  emptyMessage?: string
  onSort?: (key: string) => void
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onRowClick?: (row: T) => void
}

export function Table<T extends object>({
  columns, data, keyField = 'id' as keyof T,
  loading, emptyMessage = 'No records found',
  onSort, sortKey, sortDir, onRowClick,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-border bg-brand-navy">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide',
                  col.sortable && 'cursor-pointer hover:text-slate-200 select-none',
                  col.className,
                )}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Loading...
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={String((row as Record<string | symbol, unknown>)[keyField as string | symbol])}
                className={cn(
                  'border-b border-brand-border/50 bg-brand-surface transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-brand-border',
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 text-slate-300', col.className)}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
