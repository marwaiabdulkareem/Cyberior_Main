import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Download, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Table, type Column } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportDealsToExcel } from '@/lib/export'
import { DEAL_STATUS_LABELS, type Deal, type DealStatus, type PaymentType } from '@/types'
import { DealForm } from './DealForm'
import { useAuth } from '@/contexts/AuthContext'

function useDeals() {
  const { profile, isAdmin, isFinance } = useAuth()

  return useQuery({
    queryKey: ['deals', profile?.id, profile?.role],
    queryFn: async () => {
      let q = supabase
        .from('deals')
        .select('*, customer:customers(*), product:products(*), agent:sales_agents!deals_agent_id_fkey(*), co_agent:sales_agents!deals_co_agent_id_fkey(*), installments(*)')
        .order('created_at', { ascending: false })

      if (!isAdmin && !isFinance && profile) {
        const { data: agentData } = await supabase
          .from('sales_agents')
          .select('id')
          .eq('profile_id', profile.id)
          .single()
        if (agentData) {
          q = q.or(`agent_id.eq.${agentData.id},co_agent_id.eq.${agentData.id}`)
        }
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Deal[]
    },
  })
}

export default function Deals() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const defaultCustomer = searchParams.get('customer') ?? undefined

  const { data: deals = [], isLoading } = useDeals()
  const [showForm, setShowForm] = useState(!!defaultCustomer)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DealStatus | ''>('')
  const [paymentFilter, setPaymentFilter] = useState<PaymentType | ''>('')
  const [agentFilter, setAgentFilter] = useState('')

  const agents = Array.from(new Map(
    deals.flatMap((d) => [[d.agent?.name, d.agent], [d.co_agent?.name, d.co_agent]] as const)
  ).values()).filter(Boolean)

  const filtered = deals.filter((d) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      d.customer?.full_name.toLowerCase().includes(q) ||
      d.product?.name.toLowerCase().includes(q) ||
      d.agent?.name.toLowerCase().includes(q) ||
      d.co_agent?.name.toLowerCase().includes(q)
    return (
      matchSearch &&
      (!statusFilter || d.status === statusFilter) &&
      (!paymentFilter || d.payment_type === paymentFilter) &&
      (!agentFilter || d.agent?.name === agentFilter || d.co_agent?.name === agentFilter)
    )
  })

  const totalRevenue = filtered.reduce((s, d) => s + d.deal_price_usd, 0)
  const totalCollected = filtered.reduce((s, d) => s + (d.installments?.reduce((a, i) => a + i.amount_paid, 0) ?? 0), 0)

  const columns: Column<Deal>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (d) => (
        <div>
          <p className="font-medium text-slate-200">{d.customer?.full_name}</p>
          <p className="text-xs text-slate-500">{d.customer?.phone}</p>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Program',
      render: (d) => d.product?.name ?? '—',
    },
    {
      key: 'agent',
      header: 'Agent',
      render: (d) => (
        <div className="flex items-center gap-1.5">
          <span>{d.agent?.name ?? '—'}</span>
          {d.co_agent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-teal/10 text-brand-teal border border-brand-teal/20">
              + {d.co_agent.name}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'deal_price_usd',
      header: 'Price',
      sortable: true,
      render: (d) => (
        <div>
          <p className="font-medium text-brand-teal">{formatCurrency(d.deal_price_usd)}</p>
          {d.discount_amount > 0 && (
            <p className="text-xs text-slate-500">-{formatCurrency(d.discount_amount)} disc.</p>
          )}
        </div>
      ),
    },
    {
      key: 'paid',
      header: 'Paid / Remaining',
      render: (d) => {
        const paid = d.installments?.reduce((s, i) => s + i.amount_paid, 0) ?? 0
        const remaining = d.deal_price_usd - paid
        return (
          <div>
            <p className="text-xs text-green-400">{formatCurrency(paid)}</p>
            {remaining > 0 && <p className="text-xs text-yellow-400">{formatCurrency(remaining)} left</p>}
          </div>
        )
      },
    },
    {
      key: 'payment_type',
      header: 'Type',
      render: (d) => (
        <span className="text-xs capitalize text-slate-400">{d.payment_type}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: 'start_date',
      header: 'Start Date',
      sortable: true,
      render: (d) => formatDate(d.start_date),
    },
  ]

  return (
    <Layout title="Deals">
      <div className="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, program, agent…"
                className="rounded-lg bg-brand-surface border border-brand-border text-slate-100 placeholder-slate-500 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal w-56"
              />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DealStatus | '')} placeholder="All Statuses" className="w-36">
              {Object.entries(DEAL_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentType | '')} placeholder="Payment Type" className="w-36">
              <option value="full">Full Payment</option>
              <option value="installment">Installments</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </Select>
            <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} placeholder="All Agents" className="w-32">
              {agents.map((a) => <option key={a!.id} value={a!.name}>{a!.name}</option>)}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportDealsToExcel(filtered)}>
              <Download size={14} />
              Export
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              New Deal
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
          <span><span className="text-slate-300 font-medium">{filtered.length}</span> deals</span>
          <span>·</span>
          <span>Revenue: <span className="text-brand-teal font-medium">{formatCurrency(totalRevenue)}</span></span>
          <span>·</span>
          <span>Collected: <span className="text-green-400 font-medium">{formatCurrency(totalCollected)}</span></span>
          <span>·</span>
          <span>Pending: <span className="text-yellow-400 font-medium">{formatCurrency(totalRevenue - totalCollected)}</span></span>
        </div>

        <Table<Deal>
          columns={columns}
          data={filtered}
          loading={isLoading}
          onRowClick={(d) => navigate(`/deals/${d.id}`)}
          emptyMessage="No deals found. Create your first deal."
        />
      </div>

      {showForm && (
        <DealForm
          defaultCustomerId={defaultCustomer}
          onClose={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['deals'] }) }}
        />
      )}
    </Layout>
  )
}
