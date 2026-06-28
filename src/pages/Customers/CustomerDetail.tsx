import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit, Trash2, Plus, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Input'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils'
import { CustomerForm } from './CustomerForm'
import { useAuth } from '@/contexts/AuthContext'
import type { Customer, Deal, Note } from '@/types'

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, isAdmin } = useAuth()
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [noteText, setNoteText] = useState('')

  const { data: customer } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').eq('id', id!).single()
      return data as Customer
    },
    enabled: !!id,
  })

  const { data: deals = [] } = useQuery({
    queryKey: ['customer-deals', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('*, product:products(*), agent:sales_agents(*), installments(*)')
        .eq('customer_id', id!)
        .order('created_at', { ascending: false })
      return (data ?? []) as Deal[]
    },
    enabled: !!id,
  })

  const { data: notes = [] } = useQuery({
    queryKey: ['customer-notes', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notes')
        .select('*, profile:profiles(full_name)')
        .eq('entity_type', 'customer')
        .eq('entity_id', id!)
        .order('created_at', { ascending: false })
      return (data ?? []) as (Note & { profile: { full_name: string } | null })[]
    },
    enabled: !!id,
  })

  const addNote = useMutation({
    mutationFn: async () => {
      await supabase.from('notes').insert({
        entity_type: 'customer', entity_id: id!, content: noteText, created_by: user?.id,
      })
    },
    onSuccess: () => {
      setNoteText('')
      qc.invalidateQueries({ queryKey: ['customer-notes', id] })
    },
  })

  const deleteCustomer = useMutation({
    mutationFn: async () => {
      await supabase.from('customers').delete().eq('id', id!)
    },
    onSuccess: () => navigate('/customers'),
  })

  if (!customer) return null

  const totalRevenue = deals.reduce((s, d) => s + d.deal_price_usd, 0)
  const totalCollected = deals.reduce((s, d) => {
    return s + (d.installments?.reduce((a, i) => a + i.amount_paid, 0) ?? 0)
  }, 0)

  return (
    <Layout title="Customer Detail">
      <div className="space-y-5 max-w-4xl">
        {/* Back + Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
              <Edit size={14} />
              Edit
            </Button>
            {isAdmin && (
              <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
                <Trash2 size={14} />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Customer Card */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-teal/20 border border-brand-teal/30 flex items-center justify-center text-lg font-bold text-brand-teal uppercase flex-shrink-0">
              {customer.full_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-slate-100">{customer.full_name}</h2>
                <StatusBadge status={customer.status} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="text-sm text-slate-200">{customer.phone ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm text-slate-200">{customer.email ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Country</p>
                  <p className="text-sm text-slate-200">{customer.country ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Lead Source</p>
                  <p className="text-sm text-slate-200">{customer.lead_source ?? '—'}</p>
                </div>
              </div>
              {customer.notes && (
                <div className="mt-3 p-3 rounded-lg bg-brand-navy">
                  <p className="text-xs text-slate-400">{customer.notes}</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Financial Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-brand-surface border border-brand-border p-4 text-center">
            <p className="text-xs text-slate-500">Total Revenue</p>
            <p className="text-xl font-bold text-brand-teal">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="rounded-xl bg-brand-surface border border-brand-border p-4 text-center">
            <p className="text-xs text-slate-500">Collected</p>
            <p className="text-xl font-bold text-green-400">{formatCurrency(totalCollected)}</p>
          </div>
          <div className="rounded-xl bg-brand-surface border border-brand-border p-4 text-center">
            <p className="text-xs text-slate-500">Remaining</p>
            <p className="text-xl font-bold text-yellow-400">{formatCurrency(totalRevenue - totalCollected)}</p>
          </div>
        </div>

        {/* Deals */}
        <Card title={`Deals (${deals.length})`} action={
          <Button size="sm" onClick={() => navigate(`/deals/new?customer=${id}`)}>
            <Plus size={12} />
            New Deal
          </Button>
        }>
          {deals.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No deals yet</p>
          ) : (
            <div className="space-y-3">
              {deals.map((deal) => {
                const dealPaid = deal.installments?.reduce((s, i) => s + i.amount_paid, 0) ?? 0
                return (
                  <div
                    key={deal.id}
                    onClick={() => navigate(`/deals/${deal.id}`)}
                    className="flex items-center justify-between p-4 rounded-lg bg-brand-navy border border-brand-border/50 cursor-pointer hover:border-brand-teal/30 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-200">{deal.product?.name}</p>
                      <p className="text-xs text-slate-500">
                        {deal.agent?.name} · {deal.payment_type} · {formatDate(deal.start_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-brand-teal">{formatCurrency(deal.deal_price_usd)}</p>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(dealPaid)} paid
                      </p>
                      <StatusBadge status={deal.status} className="mt-1" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Notes */}
        <Card title="Notes & Activity">
          <div className="space-y-4">
            <div className="flex gap-3">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note about this customer…"
                rows={2}
                className="flex-1 rounded-lg bg-brand-navy border border-brand-border text-slate-200 placeholder-slate-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal resize-none"
              />
              <Button
                size="sm"
                onClick={() => addNote.mutate()}
                disabled={!noteText.trim()}
                loading={addNote.isPending}
              >
                <Send size={14} />
              </Button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="p-3 rounded-lg bg-brand-navy">
                  <p className="text-xs text-slate-300">{note.content}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {note.profile?.full_name ?? 'Unknown'} · {formatDateTime(note.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {showEdit && (
        <CustomerForm
          customer={customer}
          onClose={() => {
            setShowEdit(false)
            qc.invalidateQueries({ queryKey: ['customer', id] })
          }}
        />
      )}

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteCustomer.mutate()}
        title="Delete Customer"
        message={`Are you sure you want to delete "${customer.full_name}"? All deals and payment history will be lost permanently.`}
        loading={deleteCustomer.isPending}
      />
    </Layout>
  )
}
