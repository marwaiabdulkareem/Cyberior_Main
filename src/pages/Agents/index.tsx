import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, UserX, UserCheck, TrendingUp } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { formatCurrency, calcCommission, calcAgentShare, isOverdue } from '@/lib/utils'
import type { SalesAgent, Deal } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  commission_rate: z.coerce.number().min(0).max(100).default(10),
})

type FormData = z.infer<typeof schema>

interface AgentFormProps {
  agent?: SalesAgent
  onClose: () => void
}

function AgentForm({ agent, onClose }: AgentFormProps) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: agent?.name ?? '',
      email: agent?.email ?? '',
      phone: agent?.phone ?? '',
      commission_rate: agent?.commission_rate ?? 10,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (agent) {
        const { error } = await supabase.from('sales_agents').update(data).eq('id', agent.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('sales_agents').insert(data)
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }); onClose() },
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={agent ? 'Edit Agent' : 'Add Sales Agent'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit((d) => mutation.mutate(d))} loading={mutation.isPending}>
            {agent ? 'Save' : 'Add Agent'}
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <Input label="Full Name *" error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" {...register('email')} />
        <Input label="Phone" {...register('phone')} />
        <Input
          label="Commission Rate (%)"
          type="number"
          min="0"
          max="100"
          step="0.5"
          error={errors.commission_rate?.message}
          {...register('commission_rate')}
        />
        {mutation.error && <p className="text-xs text-red-400">{String(mutation.error)}</p>}
      </form>
    </Modal>
  )
}

export default function Agents() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editAgent, setEditAgent] = useState<SalesAgent | null>(null)

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data } = await supabase.from('sales_agents').select('*').order('name')
      return (data ?? []) as SalesAgent[]
    },
  })

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-for-agents'],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('*, installments(*)')
        .neq('status', 'cancelled')
      return (data ?? []) as Deal[]
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from('sales_agents').update({ is_active }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })

  function getAgentStats(agentId: string) {
    const agentDeals = deals.filter((d) => d.agent_id === agentId || d.co_agent_id === agentId)
    const totalSales = agentDeals.reduce((s, d) => s + d.deal_price_usd * calcAgentShare(d, agentId), 0)
    const collected = agentDeals.reduce((s, d) => {
      const dealCollected = d.installments?.reduce((a: number, i: { amount_paid: number }) => a + i.amount_paid, 0) ?? 0
      return s + dealCollected * calcAgentShare(d, agentId)
    }, 0)
    const overdue = agentDeals.reduce((s, d) => {
      const dealOverdue = d.installments?.filter((i) => isOverdue(i.due_date, i.status)).reduce((a, i) => a + (i.amount_due - i.amount_paid), 0) ?? 0
      return s + dealOverdue * calcAgentShare(d, agentId)
    }, 0)
    const agent = agents.find((a) => a.id === agentId)
    const commission = calcCommission(totalSales, agent?.commission_rate ?? 10)
    return {
      totalSales, collected, pending: totalSales - collected,
      overdue, dealCount: agentDeals.length, commission,
    }
  }

  return (
    <Layout title="Sales Agents">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{agents.length} agents</p>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              Add Agent
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map((agent) => {
            const stats = getAgentStats(agent.id)
            return (
              <div
                key={agent.id}
                className={cn(
                  'rounded-xl border p-5 space-y-4',
                  agent.is_active
                    ? 'bg-brand-surface border-brand-border'
                    : 'bg-brand-navy border-brand-border/30 opacity-60',
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-teal/20 border border-brand-teal/30 flex items-center justify-center text-base font-bold text-brand-teal uppercase">
                      {agent.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-200">{agent.name}</p>
                      <p className="text-xs text-slate-500">{agent.email ?? agent.phone ?? '—'}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditAgent(agent)}
                        className="p-1.5 rounded text-slate-500 hover:text-brand-teal hover:bg-brand-navy transition-colors"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={() => toggleActive.mutate({ id: agent.id, is_active: !agent.is_active })}
                        className="p-1.5 rounded text-slate-500 hover:text-yellow-400 hover:bg-brand-navy transition-colors"
                      >
                        {agent.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-brand-navy p-3">
                    <p className="text-xs text-slate-500">Total Sales</p>
                    <p className="text-base font-bold text-brand-teal">{formatCurrency(stats.totalSales)}</p>
                  </div>
                  <div className="rounded-lg bg-brand-navy p-3">
                    <p className="text-xs text-slate-500">Collected</p>
                    <p className="text-base font-bold text-green-400">{formatCurrency(stats.collected)}</p>
                  </div>
                  <div className="rounded-lg bg-brand-navy p-3">
                    <p className="text-xs text-slate-500">Pending</p>
                    <p className="text-base font-bold text-yellow-400">{formatCurrency(stats.pending)}</p>
                  </div>
                  <div className="rounded-lg bg-brand-navy p-3">
                    <p className="text-xs text-slate-500">Overdue</p>
                    <p className={cn('text-base font-bold', stats.overdue > 0 ? 'text-red-400' : 'text-slate-500')}>
                      {formatCurrency(stats.overdue)}
                    </p>
                  </div>
                </div>

                {/* Bottom Row */}
                <div className="flex items-center justify-between pt-2 border-t border-brand-border/50">
                  <div className="text-xs text-slate-500">
                    <span className="font-medium text-slate-300">{stats.dealCount}</span> deals
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <TrendingUp size={12} className="text-brand-gold" />
                    <span className="text-slate-500">Commission ({agent.commission_rate}%):</span>
                    <span className="font-medium text-brand-gold">{formatCurrency(stats.commission)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {(showForm || editAgent) && (
        <AgentForm
          agent={editAgent ?? undefined}
          onClose={() => { setShowForm(false); setEditAgent(null) }}
        />
      )}
    </Layout>
  )
}
