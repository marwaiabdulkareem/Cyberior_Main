import { useMemo, useState } from 'react'

export function useTableSort<T extends object>(data: T[], initialKey?: string) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function onSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data
    const dir = sortDir === 'asc' ? 1 : -1
    return [...data].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey]
      const bv = (b as Record<string, unknown>)[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [data, sortKey, sortDir])

  return { sorted, sortKey, sortDir, onSort }
}
