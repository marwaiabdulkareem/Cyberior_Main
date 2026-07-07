import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from 'recharts'
import {
  DollarSign, Users, TrendingUp, AlertCircle, CheckCircle,
  Clock, ArrowUpRight, Calendar,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { KPICard } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDate, calcCollectionRate, cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { Deal, Installment } from '@/types'

const CHART_COLORS = ['#00C2B2', '#F5A623', '#8B5CF6', '#EF4444', '#10B981', '#3B82F6', '#F97316']

function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [dealsRes, installmentsRes] = await Promise.all([
        supabase
          .from('deals')
          .select('*, customer:customers(*), product:products(*), agent:sales_agents(*), installments(*)')
          .neq('status', 'cancelled'),
        supabase
          .from('installments')
          .select('*, deal:deals(*, customer:customers(*), product:products(*), agent:sales_agents(*))')
          .order('due_date', { ascending: true }),
      ])

      const deals = (dealsRes.data ?? []) as Deal[]
      const installments = (installmentsRes.data ?? []) as Installment[]

      const today = new Date()
      const thisMonth = today.toISOString().slice(0, 7)

      const totalRevenue = deals.reduce((s, d) => s + d.deal_price_usd, 0)
      const totalCollected = installments.reduce((s, i) => s + i.amount_paid, 0)
      const totalOverdue = installments
        .filter((i) => i.status === 'late')
        .reduce((s, i) => s + (i.amount_due - i.amount_paid), 0)
      const totalPending = totalRevenue - totalCollected

      const newDealsThisMonth = deals.filter((d) => d.created_at?.startsWith(thisMonth)).length
      const fullyPaid = deals.filter((d) => d.status === 'completed').length
      const installmentDeals = deals.filter((d) => d.payment_type === 'installment').length
      const overdueCount = installments.filter((i) => i.status === 'late').length
      const activeStudents = deals.filter((d) => d.status === 'active').length

      // Revenue by month (last 6 months)
      const monthMap: Record<string, { revenue: number; collected: number }> = {}
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        const key = d.toISOString().slice(0, 7)
        monthMap[key] = { revenue: 0, collected: 0 }
      }
      deals.forEach((d) => {
        const key = d.created_at?.slice(0, 7)
        if (key && monthMap[key]) {
          monthMap[key].revenue += d.deal_price_usd
          const collected = d.installments?.reduce((s, i) => s + i.amount_paid, 0) ?? 0
          monthMap[key].collected += collected
        }
      })
      const revenueByMonth = Object.entries(monthMap).map(([month, vals]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
        ...vals,
      }))

      // Revenue by agent
      const agentMap: Record<string, { name: string; revenue: number }> = {}
      deals.forEach((d) => {
        const key = d.agent_id
        if (!agentMap[key]) agentMap[key] = { name: d.agent?.name ?? 'Unknown', revenue: 0 }
        agentMap[key].revenue += d.deal_price_usd
      })
      const revenueByAgent = Object.values(agentMap)

      // Revenue by program
      const programMap: Record<string, { name: string; value: number }> = {}
      deals.forEach((d) => {
        const key = d.product_id
        if (!programMap[key]) programMap[key] = { name: d.product?.name ?? 'Unknown', value: 0 }
        programMap[key].value += d.deal_price_usd
      })
      const revenueByProgram = Object.values(programMap)

      // Upcoming installments (next 7 days)
      const in7days = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
      const todayStr = today.toISOString().slice(0, 10)
      const upcoming = installments.filter(
        (i) => i.status === 'pending' && i.due_date >= todayStr && i.due_date <= in7days
      )

      // Overdue list
      const overdueList = installments.filter((i) => i.status === 'late').slice(0, 10)

      // Payment type split
      const paymentSplit = [
        { name: 'Full Payment', value: deals.filter((d) => d.payment_type === 'full').length },
        { name: 'Installments', value: deals.filter((d) => d.payment_type === 'installment').length },
        { name: 'Monthly', value: deals.filter((d) => d.payment_type === 'monthly').length },
        { name: 'Custom', value: deals.filter((d) => d.payment_type === 'custom').length },
      ].filter((x) => x.value > 0)

      return {
        kpis: {
          totalRevenue, totalCollected, totalPending, totalOverdue,
          activeStudents, newDealsThisMonth, fullyPaid, installmentDeals,
          overdueCount, collectionRate: calcCollectionRate(totalCollected, totalRevenue),
        },
        revenueByMonth, revenueByAgent, revenueByProgram, paymentSplit,
        upcoming, overdueList,
        rawDeals: deals,
      }
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

export default function Dashboard() {
  const { data, isLoading } = useDashboardData()

  const [period, setPeriod] = useState<'this_month' | 'last_3m' | 'last_6m' | 'all_time' | 'custom'>('all_time')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const thisMonthKey = new Date().toISOString().slice(0, 7)
  const thisMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const filteredDeals = useMemo(() => {
    const all = data?.rawDeals ?? []
    if (period === 'this_month') return all.filter(d => d.created_at?.startsWith(thisMonthKey))
    if (period === 'last_3m') {
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3)
      const s = cutoff.toISOString().slice(0, 10)
      return all.filter(d => (d.created_at?.slice(0, 10) ?? '') >= s)
    }
    if (period === 'last_6m') {
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 6)
      const s = cutoff.toISOString().slice(0, 10)
      return all.filter(d => (d.created_at?.slice(0, 10) ?? '') >= s)
    }
    if (period === 'custom') {
      return all.filter(d => {
        const date = d.created_at?.slice(0, 10) ?? ''
        return (!customFrom || date >= customFrom) && (!customTo || date <= customTo)
      })
    }
    return all
  }, [data?.rawDeals, period, customFrom, customTo, thisMonthKey])

  const filteredKpis = useMemo(() => {
    const revenue = filteredDeals.reduce((s, d) => s + d.deal_price_usd, 0)
    const collected = filteredDeals.reduce((s, d) => s + (d.installments?.reduce((a, i) => a + i.amount_paid, 0) ?? 0), 0)
    const pending = revenue - collected
    const overdue = filteredDeals.flatMap(d => d.installments ?? []).filter(i => i.status === 'late').reduce((s, i) => s + Math.max(0, i.amount_due - i.amount_paid), 0)
    const overdueCount = filteredDeals.flatMap(d => d.installments ?? []).filter(i => i.status === 'late').length
    return { revenue, collected, pending, overdue, overdueCount, collectionRate: calcCollectionRate(collected, revenue) }
  }, [filteredDeals])

  const thisMonthKpis = useMemo(() => {
    const deals = (data?.rawDeals ?? []).filter(d => d.created_at?.startsWith(thisMonthKey))
    const revenue = deals.reduce((s, d) => s + d.deal_price_usd, 0)
    const collected = deals.reduce((s, d) => s + (d.installments?.reduce((a, i) => a + i.amount_paid, 0) ?? 0), 0)
    return { revenue, collected, pending: revenue - collected, deals: deals.length }
  }, [data?.rawDeals, thisMonthKey])

  const PERIOD_OPTIONS = [
    { key: 'this_month' as const, label: 'This Month' },
    { key: 'last_3m' as const, label: 'Last 3M' },
    { key: 'last_6m' as const, label: 'Last 6M' },
    { key: 'all_time' as const, label: 'All Time' },
    { key: 'custom' as const, label: 'Custom' },
  ]

  const inputDateClass = "rounded-lg bg-brand-surface border border-brand-border text-slate-400 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-teal"

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">

        {/* This Month Highlight */}
        <div className="rounded-xl bg-brand-teal/10 border border-brand-teal/30 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-brand-teal flex items-center gap-2">
              <Calendar size={14} />
              {thisMonthLabel}
            </h3>
            <span className="text-xs text-slate-500">This Month</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500">Revenue</p>
              <p className="text-xl font-bold text-slate-100">{formatCurrency(thisMonthKpis.revenue)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Collected</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(thisMonthKpis.collected)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Pending</p>
              <p className="text-xl font-bold text-yellow-400">{formatCurrency(thisMonthKpis.pending)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">New Deals</p>
              <p className="text-xl font-bold text-brand-teal">{thisMonthKpis.deals}</p>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 mr-1">Period:</span>
          {PERIOD_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                period === key
                  ? 'bg-brand-teal text-white'
                  : 'text-slate-400 hover:text-slate-200 bg-brand-surface border border-brand-border',
              )}
            >
              {label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={inputDateClass} />
              <span className="text-xs text-slate-500">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={inputDateClass} />
            </div>
          )}
        </div>

        {/* KPI Grid — responds to period selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title={period === 'all_time' ? 'Total Revenue' : 'Revenue'}
            value={formatCurrency(filteredKpis.revenue)}
            icon={<DollarSign size={16} />}
            color="teal"
          />
          <KPICard
            title="Collected"
            value={formatCurrency(filteredKpis.collected)}
            subtitle={`${filteredKpis.collectionRate}% collection rate`}
            icon={<CheckCircle size={16} />}
            color="green"
          />
          <KPICard
            title="Pending"
            value={formatCurrency(filteredKpis.pending)}
            icon={<Clock size={16} />}
            color="gold"
          />
          <KPICard
            title="Overdue"
            value={formatCurrency(filteredKpis.overdue)}
            subtitle={`${filteredKpis.overdueCount} overdue installments`}
            icon={<AlertCircle size={16} />}
            color="red"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="Active Students"
            value={data?.kpis.activeStudents ?? 0}
            icon={<Users size={16} />}
            color="purple"
          />
          <KPICard
            title="New Deals (Month)"
            value={data?.kpis.newDealsThisMonth ?? 0}
            icon={<TrendingUp size={16} />}
            color="teal"
          />
          <KPICard
            title="Fully Paid"
            value={data?.kpis.fullyPaid ?? 0}
            icon={<CheckCircle size={16} />}
            color="green"
          />
          <KPICard
            title="On Installments"
            value={data?.kpis.installmentDeals ?? 0}
            icon={<Calendar size={16} />}
            color="gold"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Month */}
          <div className="rounded-xl bg-brand-surface border border-brand-border p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Revenue (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.revenueByMonth ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#132240', border: '1px solid #1E3A5F', borderRadius: 8 }}
                  labelStyle={{ color: '#E2E8F0' }}
                  formatter={(v: number) => [formatCurrency(v), '']}
                />
                <Bar dataKey="revenue" fill="#00C2B2" radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="collected" fill="#10B981" radius={[4, 4, 0, 0]} name="Collected" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue by Agent */}
          <div className="rounded-xl bg-brand-surface border border-brand-border p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Revenue by Agent</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.revenueByAgent ?? []} layout="vertical">
                <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} width={70} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#132240', border: '1px solid #1E3A5F', borderRadius: 8 }}
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#F5A623" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Program */}
          <div className="rounded-xl bg-brand-surface border border-brand-border p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Revenue by Program</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data?.revenueByProgram ?? []}
                  cx="50%" cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {data?.revenueByProgram.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#132240', border: '1px solid #1E3A5F', borderRadius: 8 }}
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Type Split */}
          <div className="rounded-xl bg-brand-surface border border-brand-border p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Payment Type Split</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data?.paymentSplit ?? []}
                  cx="50%" cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                >
                  {data?.paymentSplit.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#132240', border: '1px solid #1E3A5F', borderRadius: 8 }}
                />
                <Legend
                  formatter={(v) => <span className="text-xs text-slate-300">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Payments */}
          <div className="rounded-xl bg-brand-surface border border-brand-border">
            <div className="px-5 py-4 border-b border-brand-border">
              <h3 className="text-sm font-semibold text-slate-200">Upcoming Payments (7 days)</h3>
            </div>
            <div className="p-4">
              {data?.upcoming.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No upcoming payments</p>
              ) : (
                <div className="space-y-2">
                  {data?.upcoming.map((i) => (
                    <div key={i.id} className="flex items-center justify-between p-3 rounded-lg bg-brand-navy">
                      <div>
                        <p className="text-xs font-medium text-slate-200">{i.deal?.customer?.full_name}</p>
                        <p className="text-xs text-slate-500">{i.deal?.product?.name} · #{i.installment_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-brand-teal">{formatCurrency(i.amount_due)}</p>
                        <p className="text-xs text-slate-500">{formatDate(i.due_date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Overdue Payments */}
          <div className="rounded-xl bg-brand-surface border border-brand-border">
            <div className="px-5 py-4 border-b border-brand-border">
              <h3 className="text-sm font-semibold text-slate-200">
                Overdue Payments
                {(data?.kpis.overdueCount ?? 0) > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                    {data?.kpis.overdueCount}
                  </span>
                )}
              </h3>
            </div>
            <div className="p-4">
              {data?.overdueList.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No overdue payments</p>
              ) : (
                <div className="space-y-2">
                  {data?.overdueList.map((i) => (
                    <div key={i.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div>
                        <p className="text-xs font-medium text-slate-200">{i.deal?.customer?.full_name}</p>
                        <p className="text-xs text-slate-500">
                          {i.deal?.product?.name} · {i.deal?.agent?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-red-400">{formatCurrency(i.amount_due - i.amount_paid)}</p>
                        <p className="text-xs text-slate-500">Due {formatDate(i.due_date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
