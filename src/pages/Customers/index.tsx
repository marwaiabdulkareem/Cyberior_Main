import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Download, Search, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Table, type Column } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { exportCustomersToExcel } from '@/lib/export'
import { CUSTOMER_STATUS_LABELS, type Customer, type CustomerStatus } from '@/types'
import { CustomerForm } from './CustomerForm'
import { useAuth } from '@/contexts/AuthContext'

function useCustomers() {
  const { profile, isAdmin, isFinance } = useAuth()

  return useQuery({
    queryKey: ['customers', profile?.id, profile?.role],
    queryFn: async () => {
      let q = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isAdmin && !isFinance && profile) {
        // Agents see own customers
        const { data: agentDeals } = await supabase
          .from('deals')
          .select('customer_id, sales_agents!inner(profile_id)')
          .eq('sales_agents.profile_id', profile.id)
        const customerIds = agentDeals?.map((d) => d.customer_id) ?? []
        q = q.or(`created_by.eq.${profile.id}${customerIds.length ? `,id.in.(${customerIds.join(',')})` : ''}`)
      }

      const { data, error } = await q
      if (error) throw error
      return data as Customer[]
    },
  })
}

export default function Customers() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isAdmin } = useAuth()
  const { data: customers = [], isLoading } = useCustomers()
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | ''>('')

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      c.full_name.toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.country ?? '').toLowerCase().includes(q)
    const matchStatus = !statusFilter || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const columns: Column<Customer>[] = [
    {
      key: 'full_name',
      header: 'Name',
      sortable: true,
      render: (c) => (
        <div>
          <p className="font-medium text-slate-200">{c.full_name}</p>
          {c.email && <p className="text-xs text-slate-500">{c.email}</p>}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (c) => c.phone ?? '—',
    },
    {
      key: 'country',
      header: 'Country',
      render: (c) => c.country ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: 'lead_source',
      header: 'Source',
      render: (c) => c.lead_source ?? '—',
    },
    {
      key: 'created_at',
      header: 'Added',
      sortable: true,
      render: (c) => formatDate(c.created_at),
    },
  ]

  return (
    <Layout title="Customers">
      <div className="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, email…"
                className="w-full rounded-lg bg-brand-surface border border-brand-border text-slate-100 placeholder-slate-500 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CustomerStatus | '')}
              placeholder="All Statuses"
              className="w-44"
            >
              {Object.entries(CUSTOMER_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportCustomersToExcel(filtered)}
            >
              <Download size={14} />
              Export
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              Add Customer
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 text-xs text-slate-500">
          <span className="text-slate-300 font-medium">{filtered.length}</span> customers
          <span>·</span>
          <span className="text-green-400 font-medium">
            {filtered.filter((c) => c.status === 'active').length}
          </span> active
          <span>·</span>
          <span className="text-red-400 font-medium">
            {filtered.filter((c) => c.status === 'cancelled').length}
          </span> cancelled
        </div>

        {/* Table */}
        <Table<Customer>
          columns={columns}
          data={filtered}
          loading={isLoading}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          emptyMessage="No customers found. Add your first customer."
        />
      </div>

      {/* Add Form Modal */}
      {showForm && <CustomerForm onClose={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['customers'] }) }} />}
    </Layout>
  )
}
