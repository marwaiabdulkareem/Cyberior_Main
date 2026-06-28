import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Download, AlertCircle, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Table, type Column } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDate, isOverdue, isDueSoon } from '@/lib/utils'
import { exportInstallmentsToExcel } from '@/lib/export'
import { INSTALLMENT_STATUS_LABELS, type Installment, type InstallmentStatus } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

function useInstallments() {
  const { profile, isAdmin, isFinance } = useAuth()
  return useQuery({
    queryKey: ['installments', profile?.id, profile?.role],
    queryFn: async () => {
      let q = supabase
        .from('installments')
        .select('*, deal:deals(*, customer:customers(*), product:products(*), agent:sales_agents(*))')
        .neq('status', 'cancelled')
        .order('due_date', { ascending: true })

      if (!isAdmin && !isFinance && profile) {
        const { data: agentData } = await supabase
          .from('sales_agents').select('id').eq('profile_id', profile.id).single()
        if (agentData) {
          const { data: dealIds } = await supabase
            .from('deals').select('id').eq('agent_id', agentData.id)
          const ids = dealIds?.map((d: { id: string }) => d.id) ?? []
          if (ids.length) q = q.in('deal_id', ids)
        }
      }

      const { data, error } = await q
      if (error) throw error

      // Auto-mark late
      return (data ?? []).map((i: Installment) => ({
        ...i,
        status: isOverdue(i.due_date, i.status) ? 'late' as InstallmentStatus : i.status,
      })) as Installment[]
    },
    refetchInterval: 60 * 1000,
  })
}

type TabType = 'all' | 'pending' | 'overdue' | 'upcoming' | 'paid' | 'paused'

export default function Installments() {
  const navigate = useNavigate()
  const { data: installments = [], isLoading } = useInstallments()
  const [tab, setTab] = useState<TabType>('all')
  const [agentFilter, setAgentFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const agents = Array.from(
    new Map(installments.map((i) => [i.deal?.agent?.name, i.deal?.agent])).values()
  ).filter(Boolean)

  const today = new Date().toISOString().slice(0, 10)
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const filtered = installments.filter((i) => {
    const matchAgent = !agentFilter || i.deal?.agent?.name === agentFilter
    const matchFrom = !dateFrom || i.due_date >= dateFrom
    const matchTo = !dateTo || i.due_date <= dateTo

    let matchTab = true
    if (tab === 'pending') matchTab = i.status === 'pending'
    else if (tab === 'overdue') matchTab = i.status === 'late'
    else if (tab === 'upcoming') matchTab = i.status === 'pending' && i.due_date >= today && i.due_date <= in7days
    else if (tab === 'paid') matchTab = i.status === 'paid'
    else if (tab === 'paused') matchTab = i.status === 'paused'

    return matchAgent && matchFrom && matchTo && matchTab
  })

  const overdueCount = installments.filter((i) => i.status === 'late').length
  const overdueAmount = installments.filter((i) => i.status === 'late').reduce((s, i) => s + (i.amount_due - i.amount_paid), 0)
  const upcomingCount = installments.filter((i) => i.status === 'pending' && i.due_date >= today && i.due_date <= in7days).length

  const tabs: { key: TabType; label: string; count?: number; color?: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending', count: installments.filter((i) => i.status === 'pending').length },
    { key: 'upcoming', label: 'Due Soon', count: upcomingCount, color: 'text-yellow-400' },
    { key: 'overdue', label: 'Overdue', count: overdueCount, color: 'text-red-400' },
    { key: 'paid', label: 'Paid' },
    { key: 'paused', label: 'Paused' },
  ]

  const columns: Column<Installment>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (i) => (
        <div>
          <p className="font-medium text-slate-200">{i.deal?.customer?.full_name}</p>
          <p className="text-xs text-slate-500">{i.deal?.customer?.phone}</p>
        </div>
      ),
    },
    {
      key: 'program',
      header: 'Program',
      render: (i) => (
        <div>
          <p className="text-slate-300">{i.deal?.product?.name}</p>
          <p className="text-xs text-slate-500">#{i.installment_number}</p>
        </div>
      ),
    },
    {
      key: 'agent',
      header: 'Agent',
      render: (i) => i.deal?.agent?.name ?? '—',
    },
    {
      key: 'amount_due',
      header: 'Amount Due',
      sortable: true,
      render: (i) => (
        <div>
          <p className={cn('font-medium', i.status === 'late' ? 'text-red-400' : 'text-slate-200')}>
            {formatCurrency(i.amount_due)}
          </p>
          {i.amount_paid > 0 && i.amount_paid < i.amount_due && (
            <p className="text-xs text-green-400">{formatCurrency(i.amount_paid)} paid</p>
          )}
        </div>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      render: (i) => (
        <div className="flex items-center gap-2">
          <span className={cn(
            i.status === 'late' && 'text-red-400 font-medium',
            isDueSoon(i.due_date) && i.status === 'pending' && 'text-yellow-400 font-medium',
          )}>
            {formatDate(i.due_date)}
          </span>
          {i.status === 'late' && <AlertCircle size={12} className="text-red-400" />}
          {isDueSoon(i.due_date) && i.status === 'pending' && <Calendar size={12} className="text-yellow-400" />}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (i) => <StatusBadge status={i.status} />,
    },
    {
      key: 'paid_date',
      header: 'Paid Date',
      render: (i) => i.paid_date ? formatDate(i.paid_date) : '—',
    },
    {
      key: 'payment_method',
      header: 'Method',
      render: (i) => i.payment_method?.replace('_', ' ') ?? '—',
    },
  ]

  return (
    <Layout title="Installments">
      <div className="space-y-5">
        {/* Alert Banner */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-300">
                {overdueCount} overdue installment{overdueCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-400">Total overdue: {formatCurrency(overdueAmount)}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-brand-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                tab === t.key
                  ? 'border-brand-teal text-brand-teal'
                  : 'border-transparent text-slate-500 hover:text-slate-300',
              )}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={cn('text-xs font-bold', t.color ?? 'text-slate-400')}>
                  ({t.count})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} placeholder="All Agents" className="w-36">
            {agents.map((a) => <option key={a!.id} value={a!.name}>{a!.name}</option>)}
          </Select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg bg-brand-surface border border-brand-border text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg bg-brand-surface border border-brand-border text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
          <Button variant="secondary" size="sm" onClick={() => exportInstallmentsToExcel(filtered)}>
            <Download size={14} />
            Export
          </Button>
        </div>

        {/* Stats */}
        <div className="text-xs text-slate-500">
          <span className="text-slate-300 font-medium">{filtered.length}</span> installments ·
          Due: <span className="text-red-400 font-medium">
            {formatCurrency(filtered.filter((i) => i.status !== 'paid').reduce((s, i) => s + (i.amount_due - i.amount_paid), 0))}
          </span>
        </div>

        <Table<Installment>
          columns={columns}
          data={filtered}
          loading={isLoading}
          onRowClick={(i) => navigate(`/deals/${i.deal_id}`)}
          emptyMessage="No installments found for the selected filter."
        />
      </div>
    </Layout>
  )
}
