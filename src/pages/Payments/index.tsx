import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Download, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Table, type Column } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportInstallmentsToExcel } from '@/lib/export'
import { PAYMENT_METHOD_LABELS, type Installment } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

function usePayments() {
  const { profile, isAdmin, isFinance } = useAuth()
  return useQuery({
    queryKey: ['payments', profile?.id, profile?.role],
    queryFn: async () => {
      let q = supabase
        .from('installments')
        .select('*, deal:deals(*, customer:customers(*), product:products(*), agent:sales_agents!deals_agent_id_fkey(*))')
        .eq('status', 'paid')
        .order('paid_date', { ascending: false })

      if (!isAdmin && !isFinance && profile) {
        const { data: agentData } = await supabase
          .from('sales_agents').select('id').eq('profile_id', profile.id).single()
        if (agentData) {
          q = (q as typeof q).or(`deal.agent_id.eq.${agentData.id},deal.co_agent_id.eq.${agentData.id}`)
        }
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Installment[]
    },
  })
}

export default function Payments() {
  const navigate = useNavigate()
  const { data: payments = [], isLoading } = usePayments()
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const agents = Array.from(
    new Map(payments.map((p) => [p.deal?.agent?.name, p.deal?.agent])).values()
  ).filter(Boolean)

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      p.deal?.customer?.full_name.toLowerCase().includes(q) ||
      p.deal?.product?.name.toLowerCase().includes(q) ||
      p.deal?.agent?.name.toLowerCase().includes(q)
    const matchAgent = !agentFilter || p.deal?.agent?.name === agentFilter
    const matchMethod = !methodFilter || p.payment_method === methodFilter
    const matchFrom = !dateFrom || (p.paid_date ?? '') >= dateFrom
    const matchTo = !dateTo || (p.paid_date ?? '') <= dateTo
    return matchSearch && matchAgent && matchMethod && matchFrom && matchTo
  })

  const totalCollected = filtered.reduce((s, p) => s + p.amount_paid, 0)

  const columns: Column<Installment>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (p) => (
        <div>
          <p className="font-medium text-slate-200">{p.deal?.customer?.full_name}</p>
          <p className="text-xs text-slate-500">{p.deal?.customer?.phone}</p>
        </div>
      ),
    },
    {
      key: 'program',
      header: 'Program',
      render: (p) => p.deal?.product?.name ?? '—',
    },
    {
      key: 'agent',
      header: 'Agent',
      render: (p) => p.deal?.agent?.name ?? '—',
    },
    {
      key: 'installment_number',
      header: '#',
      render: (p) => `#${p.installment_number}`,
    },
    {
      key: 'amount_paid',
      header: 'Amount Paid',
      sortable: true,
      render: (p) => (
        <span className="font-medium text-green-400">{formatCurrency(p.amount_paid)}</span>
      ),
    },
    {
      key: 'payment_method',
      header: 'Method',
      render: (p) => p.payment_method
        ? PAYMENT_METHOD_LABELS[p.payment_method]
        : '—',
    },
    {
      key: 'paid_date',
      header: 'Date Paid',
      sortable: true,
      render: (p) => formatDate(p.paid_date),
    },
    {
      key: 'proof_url',
      header: 'Proof',
      render: (p) => p.proof_url ? (
        <a
          href={p.proof_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-brand-teal hover:underline"
        >
          View
        </a>
      ) : '—',
    },
  ]

  return (
    <Layout title="Payments">
      <div className="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, program…"
                className="rounded-lg bg-brand-surface border border-brand-border text-slate-100 placeholder-slate-500 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal w-52"
              />
            </div>
            <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} placeholder="All Agents" className="w-32">
              {agents.map((a) => <option key={a!.id} value={a!.name}>{a!.name}</option>)}
            </Select>
            <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} placeholder="Payment Method" className="w-40">
              {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg bg-brand-surface border border-brand-border text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
              placeholder="From"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg bg-brand-surface border border-brand-border text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
              placeholder="To"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportInstallmentsToExcel(filtered)}
          >
            <Download size={14} />
            Export
          </Button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-xs text-slate-500">
          <span><span className="text-slate-300 font-medium">{filtered.length}</span> payments</span>
          <span>·</span>
          <span>Total collected: <span className="text-green-400 font-medium">{formatCurrency(totalCollected)}</span></span>
        </div>

        <Table<Installment>
          columns={columns}
          data={filtered}
          loading={isLoading}
          onRowClick={(p) => navigate(`/deals/${p.deal_id}`)}
          emptyMessage="No completed payments found."
        />
      </div>
    </Layout>
  )
}
