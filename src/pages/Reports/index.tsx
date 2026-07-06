import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Users, AlertCircle, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { formatCurrency, calcCommission, calcCollectionRate } from '@/lib/utils'
import {
  exportDealsToExcel, exportInstallmentsToExcel,
  exportAgentReportToExcel, exportOverdueToExcel,
} from '@/lib/export'
import type { Deal, Installment, SalesAgent, Currency } from '@/types'

function useReportData(agentFilter: string, productFilter: string, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['reports', agentFilter, productFilter, dateFrom, dateTo],
    queryFn: async () => {
      const [dealsRes, installmentsRes, agentsRes] = await Promise.all([
        supabase
          .from('deals')
          .select('*, customer:customers(*), product:products(*), agent:sales_agents(*), installments(*)')
          .neq('status', 'cancelled'),
        supabase
          .from('installments')
          .select('*, deal:deals(*, customer:customers(*), product:products(*), agent:sales_agents(*), payment_plan:payment_plans(*))'),
        supabase.from('sales_agents').select('*').eq('is_active', true),
      ])

      let deals = (dealsRes.data ?? []) as Deal[]
      let installments = (installmentsRes.data ?? []) as Installment[]
      const agents = (agentsRes.data ?? []) as SalesAgent[]

      if (agentFilter) deals = deals.filter((d) => d.agent?.name === agentFilter)
      if (productFilter) deals = deals.filter((d) => d.product?.name === productFilter)
      if (dateFrom) deals = deals.filter((d) => (d.start_date ?? '') >= dateFrom)
      if (dateTo) deals = deals.filter((d) => (d.start_date ?? '') <= dateTo)

      const dealIds = new Set(deals.map((d) => d.id))
      installments = installments.filter((i) => dealIds.has(i.deal_id))

      return { deals, installments, agents }
    },
  })
}

interface CommissionRow {
  agentName: string
  rate: number
  currency: Currency
  otherLabel: string | null
  collected: number
  commission: number
}

export default function Reports() {
  const [agentFilter, setAgentFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [commissionMonth, setCommissionMonth] = useState(() => format(new Date(), 'yyyy-MM'))

  const { data, isLoading } = useReportData(agentFilter, productFilter, dateFrom, dateTo)
  const deals = data?.deals ?? []
  const installments = data?.installments ?? []
  const agents = data?.agents ?? []

  // Commission is paid on money actually collected, split out per currency —
  // an agent's IQD collections and USD collections are never mixed together.
  const commissionRows = useMemo(() => {
    const paidThisMonth = installments.filter(
      (i) => i.status === 'paid' && i.paid_date && i.paid_date.startsWith(commissionMonth)
    )

    const rows: CommissionRow[] = []
    agents.forEach((agent) => {
      const agentPaid = paidThisMonth.filter((i) => i.deal?.agent_id === agent.id)
      if (agentPaid.length === 0) {
        rows.push({ agentName: agent.name, rate: agent.commission_rate, currency: 'USD', otherLabel: null, collected: 0, commission: 0 })
        return
      }
      const byCurrency = new Map<Currency, { collected: number; otherLabel: string | null }>()
      agentPaid.forEach((i) => {
        const currency = (i.deal?.payment_plan?.currency ?? 'USD') as Currency
        const otherLabel = i.deal?.payment_plan?.other_currency_label ?? null
        // Non-USD deals record the real amount collected in that currency
        // separately (amount_paid_local); amount_paid stays USD-only.
        const collectedAmount = currency === 'USD' ? i.amount_paid : (i.amount_paid_local ?? i.amount_paid)
        const bucket = byCurrency.get(currency) ?? { collected: 0, otherLabel }
        bucket.collected += collectedAmount
        byCurrency.set(currency, bucket)
      })
      byCurrency.forEach((bucket, currency) => {
        rows.push({
          agentName: agent.name,
          rate: agent.commission_rate,
          currency,
          otherLabel: bucket.otherLabel,
          collected: bucket.collected,
          commission: calcCommission(bucket.collected, agent.commission_rate),
        })
      })
    })
    return rows
  }, [installments, agents, commissionMonth])

  const totalRevenue = deals.reduce((s, d) => s + d.deal_price_usd, 0)
  const totalCollected = installments.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount_paid, 0)
  const totalOverdue = installments.filter((i) => i.status === 'late').reduce((s, i) => s + (i.amount_due - i.amount_paid), 0)
  const collectionRate = calcCollectionRate(totalCollected, totalRevenue)

  const agentNames = Array.from(new Set(deals.map((d) => d.agent?.name).filter(Boolean)))
  const productNames = Array.from(new Set(deals.map((d) => d.product?.name).filter(Boolean)))

  // Revenue by agent for chart
  const agentChart = agents.map((agent) => {
    const agentDeals = deals.filter((d) => d.agent_id === agent.id)
    const revenue = agentDeals.reduce((s, d) => s + d.deal_price_usd, 0)
    const collected = agentDeals.reduce((s, d) => {
      return s + (d.installments?.reduce((a: number, i: { amount_paid: number }) => a + i.amount_paid, 0) ?? 0)
    }, 0)
    return { name: agent.name, revenue, collected, commission: calcCommission(revenue, agent.commission_rate) }
  })

  // Revenue by program
  const programMap: Record<string, number> = {}
  deals.forEach((d) => {
    const key = d.product?.name ?? 'Unknown'
    programMap[key] = (programMap[key] ?? 0) + d.deal_price_usd
  })
  const programChart = Object.entries(programMap)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  return (
    <Layout title="Reports">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center p-4 rounded-xl bg-brand-surface border border-brand-border">
          <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} placeholder="All Agents" className="w-36">
            {agentNames.map((n) => <option key={n} value={n!}>{n}</option>)}
          </Select>
          <Select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} placeholder="All Programs" className="w-44">
            {productNames.map((n) => <option key={n} value={n!}>{n}</option>)}
          </Select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg bg-brand-navy border border-brand-border text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg bg-brand-navy border border-brand-border text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
          {(agentFilter || productFilter || dateFrom || dateTo) && (
            <button
              onClick={() => { setAgentFilter(''); setProductFilter(''); setDateFrom(''); setDateTo('') }}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Revenue', value: formatCurrency(totalRevenue), color: 'text-brand-teal' },
            { label: 'Collected', value: `${formatCurrency(totalCollected)} (${collectionRate}%)`, color: 'text-green-400' },
            { label: 'Overdue', value: formatCurrency(totalOverdue), color: 'text-red-400' },
            { label: 'Deals', value: String(deals.length), color: 'text-slate-200' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl bg-brand-surface border border-brand-border p-4">
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl bg-brand-surface border border-brand-border p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Agent Performance</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#132240', border: '1px solid #1E3A5F', borderRadius: 8 }}
                  formatter={(v: number) => [formatCurrency(v), '']}
                />
                <Bar dataKey="revenue" fill="#00C2B2" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" fill="#10B981" name="Collected" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl bg-brand-surface border border-brand-border p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Revenue by Program</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={programChart} layout="vertical">
                <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} width={110} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#132240', border: '1px solid #1E3A5F', borderRadius: 8 }}
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#F5A623" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent Commission Table */}
        <div className="rounded-xl bg-brand-surface border border-brand-border">
          <div className="px-5 py-4 border-b border-brand-border">
            <h3 className="text-sm font-semibold text-slate-200">Agent Commission Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border bg-brand-navy">
                  {['Agent', 'Deals', 'Total Sales', 'Collected', 'Pending', 'Overdue', 'Commission (10%)'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentChart.map((row) => (
                  <tr key={row.name} className="border-b border-brand-border/50 hover:bg-brand-border/20">
                    <td className="px-4 py-3 text-slate-200 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {deals.filter((d) => d.agent?.name === row.name).length}
                    </td>
                    <td className="px-4 py-3 text-brand-teal font-medium">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-3 text-green-400">{formatCurrency(row.collected)}</td>
                    <td className="px-4 py-3 text-yellow-400">{formatCurrency(row.revenue - row.collected)}</td>
                    <td className="px-4 py-3 text-red-400">
                      {formatCurrency(
                        installments
                          .filter((i) => i.status === 'late' && i.deal?.agent?.name === row.name)
                          .reduce((s, i) => s + (i.amount_due - i.amount_paid), 0)
                      )}
                    </td>
                    <td className="px-4 py-3 text-brand-gold font-medium">{formatCurrency(row.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Commission by Currency */}
        <div className="rounded-xl bg-brand-surface border border-brand-border">
          <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Monthly Commission by Currency</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Commission on money actually collected this month — kept separate per currency, never converted.
              </p>
            </div>
            <input
              type="month"
              value={commissionMonth}
              onChange={(e) => setCommissionMonth(e.target.value)}
              className="rounded-lg bg-brand-navy border border-brand-border text-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border bg-brand-navy">
                  {['Agent', 'Rate', 'Currency', 'Collected', 'Commission'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commissionRows.map((row, i) => (
                  <tr key={`${row.agentName}-${row.currency}-${i}`} className="border-b border-brand-border/50 hover:bg-brand-border/20">
                    <td className="px-4 py-3 text-slate-200 font-medium">{row.agentName}</td>
                    <td className="px-4 py-3 text-slate-400">{row.rate}%</td>
                    <td className="px-4 py-3 text-slate-400">
                      {row.currency === 'OTHER' ? (row.otherLabel || 'Other') : row.currency}
                    </td>
                    <td className="px-4 py-3 text-green-400">
                      {row.collected > 0 ? formatCurrency(row.collected, row.currency, row.otherLabel) : '—'}
                    </td>
                    <td className="px-4 py-3 text-brand-gold font-medium">
                      {row.collected > 0 ? formatCurrency(row.commission, row.currency, row.otherLabel) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'All Deals', icon: <FileText size={15} />,
              action: () => exportDealsToExcel(deals),
            },
            {
              label: 'All Installments', icon: <TrendingUp size={15} />,
              action: () => exportInstallmentsToExcel(installments),
            },
            {
              label: 'Agent Report', icon: <Users size={15} />,
              action: () => exportAgentReportToExcel(agents, deals),
            },
            {
              label: 'Overdue Only', icon: <AlertCircle size={15} />,
              action: () => exportOverdueToExcel(installments),
            },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="flex items-center justify-center gap-2 p-4 rounded-xl bg-brand-surface border border-brand-border text-sm text-slate-300 hover:border-brand-teal hover:text-brand-teal transition-colors"
            >
              {btn.icon}
              <Download size={13} />
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </Layout>
  )
}
