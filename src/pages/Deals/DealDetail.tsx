import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit, Trash2, Send, CheckCircle, PauseCircle, RefreshCw, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { FileUpload } from '@/components/ui/FileUpload'
import { formatDate, formatDateTime, formatCurrency, isOverdue } from '@/lib/utils'
import { DealForm } from './DealForm'
import { useAuth } from '@/contexts/AuthContext'
import {
  DEAL_STATUS_LABELS, PAYMENT_METHOD_LABELS,
  INSTALLMENT_STATUS_LABELS,
  type Deal, type Installment, type Note, type InstallmentStatus,
} from '@/types'
import { cn } from '@/lib/utils'

interface PayInstallmentModal {
  installment: Installment | null
}

export default function DealDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, isAdmin, isAgent, isFinance } = useAuth()
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [payModal, setPayModal] = useState<PayInstallmentModal>({ installment: null })
  const [noteText, setNoteText] = useState('')
  const [payData, setPayData] = useState({
    amount_paid: 0, paid_date: '', payment_method: 'bank_transfer' as string,
    proof_url: '', notes: '', status: 'paid' as InstallmentStatus,
  })
  const [refundModal, setRefundModal] = useState(false)
  const [refundAmount, setRefundAmount] = useState(0)

  const { data: deal } = useQuery({
    queryKey: ['deal', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('*, customer:customers(*), product:products(*), agent:sales_agents(*), installments(*), payment_plan:payment_plans(*)')
        .eq('id', id!)
        .single()
      return data as Deal & { payment_plan: { total_amount: number; num_installments: number } | null }
    },
    enabled: !!id,
  })

  const { data: notes = [] } = useQuery({
    queryKey: ['deal-notes', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notes')
        .select('*, profile:profiles(full_name)')
        .eq('entity_type', 'deal')
        .eq('entity_id', id!)
        .order('created_at', { ascending: false })
      return (data ?? []) as (Note & { profile: { full_name: string } | null })[]
    },
    enabled: !!id,
  })

  const { data: activityLogs = [] } = useQuery({
    queryKey: ['deal-logs', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('entity_type', 'installment')
        .order('created_at', { ascending: false })
        .limit(20)
      return data ?? []
    },
    enabled: !!id,
  })

  const addNote = useMutation({
    mutationFn: async () => {
      await supabase.from('notes').insert({
        entity_type: 'deal', entity_id: id!, content: noteText, created_by: user?.id,
      })
    },
    onSuccess: () => { setNoteText(''); qc.invalidateQueries({ queryKey: ['deal-notes', id] }) },
  })

  const markInstallmentPaid = useMutation({
    mutationFn: async () => {
      const inst = payModal.installment!
      const { error } = await supabase.from('installments').update({
        amount_paid: payData.amount_paid,
        paid_date: payData.paid_date,
        payment_method: payData.payment_method,
        proof_url: payData.proof_url || null,
        notes: payData.notes || null,
        status: payData.amount_paid >= inst.amount_due ? 'paid' : 'partial',
        recorded_by: user?.id,
        updated_at: new Date().toISOString(),
      }).eq('id', inst.id)
      if (error) throw error

      // Check if all installments paid → mark deal completed
      const allInstallments = deal?.installments ?? []
      const allPaid = allInstallments.every(
        (i) => i.id === inst.id
          ? payData.amount_paid >= inst.amount_due
          : i.status === 'paid'
      )
      if (allPaid) {
        await supabase.from('deals').update({ status: 'completed' }).eq('id', id!)
        await supabase.from('customers').update({ status: 'completed' }).eq('id', deal?.customer_id)
      }

      await supabase.from('activity_logs').insert({
        user_id: user?.id, action: 'payment_recorded', entity_type: 'installment',
        entity_id: inst.id, entity_label: `${formatCurrency(payData.amount_paid)}`,
      })
    },
    onSuccess: () => {
      setPayModal({ installment: null })
      qc.invalidateQueries({ queryKey: ['deal', id] })
    },
  })

  const pauseInstallment = useMutation({
    mutationFn: async (installmentId: string) => {
      await supabase.from('installments').update({ status: 'paused' }).eq('id', installmentId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal', id] }),
  })

  const deleteDeal = useMutation({
    mutationFn: async () => {
      await supabase.from('deals').delete().eq('id', id!)
    },
    onSuccess: () => navigate('/deals'),
  })

  const updateDealStatus = useMutation({
    mutationFn: async (status: string) => {
      await supabase.from('deals').update({ status }).eq('id', id!)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal', id] }),
  })

  if (!deal) return null

  const installments = (deal.installments ?? []).sort((a, b) => a.installment_number - b.installment_number)
  const totalPaid = installments.reduce((s, i) => s + i.amount_paid, 0)
  const totalRemaining = deal.deal_price_usd - totalPaid
  const completionPct = deal.deal_price_usd > 0 ? Math.min(100, Math.round((totalPaid / deal.deal_price_usd) * 100)) : 0
  const canEdit = isAdmin || (isAgent && deal.agent?.profile_id === user?.id)
  const canPay = isAdmin || isFinance || (isAgent && deal.agent?.profile_id === user?.id)

  return (
    <Layout title="Deal Detail">
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
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <>
                <Select
                  value={deal.status}
                  onChange={(e) => updateDealStatus.mutate(e.target.value)}
                  className="text-xs w-32"
                >
                  {Object.entries(DEAL_STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </Select>
              </>
            )}
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
                <Edit size={14} />
                Edit
              </Button>
            )}
            {isAdmin && (
              <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
                <Trash2 size={14} />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Deal Summary */}
        <Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500">Customer</p>
              <button
                onClick={() => navigate(`/customers/${deal.customer_id}`)}
                className="text-sm font-medium text-brand-teal hover:underline flex items-center gap-1"
              >
                {deal.customer?.full_name}
                <ExternalLink size={10} />
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-500">Program</p>
              <p className="text-sm font-medium text-slate-200">{deal.product?.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Sales Agent</p>
              <p className="text-sm font-medium text-slate-200">{deal.agent?.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <StatusBadge status={deal.status} className="mt-1" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Deal Price</p>
              <p className="text-lg font-bold text-brand-teal">{formatCurrency(deal.deal_price_usd)}</p>
              {deal.deal_price_iqd && (
                <p className="text-xs text-slate-500">{formatCurrency(deal.deal_price_iqd, 'IQD')}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Discount</p>
              <p className="text-sm text-slate-200">{deal.discount_amount > 0 ? formatCurrency(deal.discount_amount) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Payment Type</p>
              <p className="text-sm capitalize text-slate-200">{deal.payment_type}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Start Date</p>
              <p className="text-sm text-slate-200">{formatDate(deal.start_date)}</p>
            </div>
          </div>

          {deal.below_min_override && (
            <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-xs text-yellow-300">Below minimum price · {deal.below_min_note}</p>
            </div>
          )}
        </Card>

        {/* Payment Progress */}
        <Card title="Payment Progress">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-xl font-bold text-slate-200">{formatCurrency(deal.deal_price_usd)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Paid</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Remaining</p>
              <p className="text-xl font-bold text-yellow-400">{formatCurrency(totalRemaining)}</p>
            </div>
          </div>
          <div className="relative h-3 rounded-full bg-brand-navy overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-brand-teal to-green-400 rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2 text-right">{completionPct}% collected</p>
        </Card>

        {/* Installments */}
        <Card title={`Installments (${installments.length})`}>
          <div className="space-y-2">
            {installments.map((inst) => {
              const late = isOverdue(inst.due_date, inst.status)
              return (
                <div
                  key={inst.id}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-lg border transition-colors',
                    late
                      ? 'bg-red-500/5 border-red-500/20'
                      : inst.status === 'paid'
                      ? 'bg-green-500/5 border-green-500/20'
                      : 'bg-brand-navy border-brand-border/50',
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">#{inst.installment_number}</span>
                      <StatusBadge status={late ? 'late' : inst.status} />
                    </div>
                    <p className="text-sm font-medium text-slate-200 mt-1">{formatCurrency(inst.amount_due)}</p>
                    {inst.amount_paid > 0 && inst.amount_paid < inst.amount_due && (
                      <p className="text-xs text-slate-500">Paid: {formatCurrency(inst.amount_paid)}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">Due: {formatDate(inst.due_date)}</p>
                    {inst.paid_date && (
                      <p className="text-xs text-green-400">Paid: {formatDate(inst.paid_date)} via {inst.payment_method}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {inst.status !== 'paid' && inst.status !== 'cancelled' && canPay && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPayModal({ installment: inst })
                            setPayData({
                              amount_paid: inst.amount_due - inst.amount_paid,
                              paid_date: new Date().toISOString().slice(0, 10),
                              payment_method: 'bank_transfer',
                              proof_url: '', notes: '', status: 'paid',
                            })
                          }}
                        >
                          <CheckCircle size={13} />
                          Pay
                        </Button>
                        {isAdmin && inst.status !== 'paused' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => pauseInstallment.mutate(inst.id)}
                          >
                            <PauseCircle size={13} />
                          </Button>
                        )}
                      </>
                    )}
                    {inst.proof_url && (
                      <a
                        href={inst.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded text-slate-400 hover:text-brand-teal transition-colors"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Notes */}
        <Card title="Notes">
          <div className="space-y-4">
            <div className="flex gap-3">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note…"
                rows={2}
                className="flex-1 rounded-lg bg-brand-navy border border-brand-border text-slate-200 placeholder-slate-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal resize-none"
              />
              <Button size="sm" onClick={() => addNote.mutate()} disabled={!noteText.trim()} loading={addNote.isPending}>
                <Send size={14} />
              </Button>
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="p-3 rounded-lg bg-brand-navy">
                  <p className="text-xs text-slate-300">{note.content}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {(note as { profile?: { full_name: string } | null }).profile?.full_name ?? 'Unknown'} · {formatDateTime(note.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Pay Installment Modal */}
      <Modal
        open={!!payModal.installment}
        onClose={() => setPayModal({ installment: null })}
        title={`Record Payment — Installment #${payModal.installment?.installment_number}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayModal({ installment: null })}>Cancel</Button>
            <Button onClick={() => markInstallmentPaid.mutate()} loading={markInstallmentPaid.isPending}>
              Save Payment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-brand-navy text-xs text-slate-400">
            Amount due: <span className="text-brand-teal font-bold">{formatCurrency(payModal.installment?.amount_due ?? 0)}</span>
          </div>
          <Input
            label="Amount Paid (USD) *"
            type="number"
            step="0.01"
            value={payData.amount_paid}
            onChange={(e) => setPayData((p) => ({ ...p, amount_paid: Number(e.target.value) }))}
          />
          <Input
            label="Payment Date *"
            type="date"
            value={payData.paid_date}
            onChange={(e) => setPayData((p) => ({ ...p, paid_date: e.target.value }))}
          />
          <Select
            label="Payment Method *"
            value={payData.payment_method}
            onChange={(e) => setPayData((p) => ({ ...p, payment_method: e.target.value }))}
          >
            {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
          <FileUpload
            label="Payment Proof (optional)"
            onUpload={(url) => setPayData((p) => ({ ...p, proof_url: url }))}
            existingUrl={payData.proof_url}
          />
          <Textarea
            label="Notes"
            value={payData.notes}
            onChange={(e) => setPayData((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Reference number, notes…"
          />
        </div>
      </Modal>

      {showEdit && (
        <DealForm
          deal={deal}
          onClose={() => { setShowEdit(false); qc.invalidateQueries({ queryKey: ['deal', id] }) }}
        />
      )}

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteDeal.mutate()}
        title="Delete Deal"
        message="This will permanently delete the deal, all installments, and payment history."
        loading={deleteDeal.isPending}
      />
    </Layout>
  )
}
