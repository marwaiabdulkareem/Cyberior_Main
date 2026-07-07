import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { formatCurrency, generateInstallmentDates } from '@/lib/utils'
import { CURRENCY_LABELS, type Deal } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { format, addMonths } from 'date-fns'

const schema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  product_id: z.string().min(1, 'Program is required'),
  agent_id: z.string().min(1, 'Agent is required'),
  deal_price_usd: z.coerce.number().positive('Price must be positive'),
  payment_type: z.enum(['full', 'installment']),
  start_date: z.string().min(1, 'Start date is required'),
  notes: z.string().optional(),
  currency: z.enum(['USD', 'IQD', 'TRY', 'OTHER']).default('USD'),
  other_currency_label: z.string().optional(),
  installments: z.array(z.object({
    due_date: z.string().min(1, 'Due date required'),
    amount: z.coerce.number().positive('Amount must be positive'),
    amount_local: z.coerce.number().optional(),
  })).optional(),
}).superRefine((data, ctx) => {
  if (data.currency === 'OTHER' && !data.other_currency_label?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['other_currency_label'], message: 'Enter the currency name' })
  }
})

type FormData = z.infer<typeof schema>

interface DealFormProps {
  onClose: () => void
  deal?: Deal
  defaultCustomerId?: string
}

export function DealForm({ onClose, deal, defaultCustomerId }: DealFormProps) {
  const { user } = useAuth()
  const [selectedProduct, setSelectedProduct] = useState<{
    one_time_price_usd: number; installment_monthly_price_usd: number; installment_months: number
  } | null>(null)

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-dropdown'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('id, full_name').order('full_name')
      return data ?? []
    },
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products-dropdown'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name')
      return data ?? []
    },
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-dropdown'],
    queryFn: async () => {
      const { data } = await supabase.from('sales_agents').select('id, name').eq('is_active', true).order('name')
      return data ?? []
    },
  })

  const { control, register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_id: defaultCustomerId ?? deal?.customer_id ?? '',
      product_id: deal?.product_id ?? '',
      agent_id: deal?.agent_id ?? '',
      deal_price_usd: deal?.deal_price_usd ?? 0,
      payment_type: deal?.payment_type === 'installment' ? 'installment' : 'full',
      start_date: deal?.start_date ?? format(new Date(), 'yyyy-MM-dd'),
      notes: deal?.notes ?? '',
      currency: deal?.payment_plan?.currency ?? 'USD',
      other_currency_label: deal?.payment_plan?.other_currency_label ?? '',
      installments: [],
    },
  })

  const { fields, replace } = useFieldArray({ control, name: 'installments' })

  const watchProduct = watch('product_id')
  const watchPrice = watch('deal_price_usd')
  const watchPaymentType = watch('payment_type')
  const watchStartDate = watch('start_date')
  const watchCurrency = watch('currency')
  const watchInstallments = watch('installments')

  const installmentsTotal = (watchInstallments ?? []).reduce((s, i) => s + (Number(i?.amount) || 0), 0)
  const displayedPrice = watchPaymentType === 'installment' ? installmentsTotal : watchPrice
  const installmentsTotalLocal = (watchInstallments ?? []).reduce((s, i) => s + (Number(i?.amount_local) || 0), 0)
  const hasInstallmentPlan = !!selectedProduct
    && selectedProduct.installment_months > 0
    && selectedProduct.installment_monthly_price_usd > 0

  useEffect(() => {
    if (!watchProduct) return
    const product = products.find((p: { id: string }) => p.id === watchProduct)
    if (!product) return
    setSelectedProduct(product)
    const hasPlan = product.installment_months > 0 && product.installment_monthly_price_usd > 0
    if (!hasPlan) setValue('payment_type', 'full')
  }, [watchProduct, products])

  useEffect(() => {
    if (!selectedProduct || !watchStartDate) return

    if (watchPaymentType === 'full') {
      setValue('deal_price_usd', selectedProduct.one_time_price_usd)
      replace([{ due_date: watchStartDate, amount: selectedProduct.one_time_price_usd, amount_local: undefined }])
      return
    }

    const count = selectedProduct.installment_months
    const monthly = selectedProduct.installment_monthly_price_usd
    setValue('deal_price_usd', Math.round(monthly * count * 100) / 100)
    const dates = generateInstallmentDates(watchStartDate, count, 30)
    replace(dates.map((d) => ({ due_date: d, amount: monthly, amount_local: undefined })))
  }, [watchPaymentType, selectedProduct, watchStartDate])

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const installs = data.installments ?? []
      const totalAmount = installs.reduce((s, i) => s + i.amount, 0) || data.deal_price_usd

      const dealPayload = {
        customer_id: data.customer_id,
        product_id: data.product_id,
        agent_id: data.agent_id,
        deal_price_usd: totalAmount,
        discount_amount: 0,
        payment_type: data.payment_type,
        start_date: data.start_date,
        notes: data.notes,
        below_min_override: false,
        below_min_note: null,
        created_by: user?.id,
      }

      let dealId: string

      if (deal) {
        const { error } = await supabase.from('deals').update(dealPayload).eq('id', deal.id)
        if (error) throw error
        dealId = deal.id
        // Explicitly delete old installments first, then payment plan
        await supabase.from('installments').delete().eq('deal_id', dealId)
        await supabase.from('payment_plans').delete().eq('deal_id', dealId)
      } else {
        const { data: inserted, error } = await supabase
          .from('deals').insert(dealPayload).select().single()
        if (error) throw error
        dealId = inserted.id
      }

      const { data: plan, error: planError } = await supabase
        .from('payment_plans')
        .insert({
          deal_id: dealId,
          total_amount: totalAmount,
          num_installments: installs.length || 1,
          installment_amount: installs[0]?.amount,
          currency: data.currency,
          other_currency_label: data.currency === 'OTHER' ? data.other_currency_label : null,
        })
        .select()
        .single()
      if (planError) throw planError

      // currency here is just the expected/default for this deal — the
      // agent confirms (or changes) it for real when recording each payment
      const defaultCurrency = data.currency
      const defaultOtherLabel = data.currency === 'OTHER' ? data.other_currency_label ?? null : null

      const instRows = installs.length > 0
        ? installs.map((inst, i) => ({
            deal_id: dealId,
            payment_plan_id: plan.id,
            installment_number: i + 1,
            amount_due: inst.amount,
            amount_due_local: inst.amount_local || null,
            currency: defaultCurrency,
            other_currency_label: defaultOtherLabel,
            due_date: inst.due_date,
            status: 'pending',
          }))
        : [{
            deal_id: dealId,
            payment_plan_id: plan.id,
            installment_number: 1,
            amount_due: totalAmount,
            amount_due_local: null,
            currency: defaultCurrency,
            other_currency_label: defaultOtherLabel,
            due_date: data.start_date,
            status: 'pending',
          }]

      const { error: instError } = await supabase.from('installments').insert(instRows)
      if (instError) throw instError

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: deal ? 'updated' : 'created',
        entity_type: 'deal',
        entity_id: dealId,
      })
    },
    onSuccess: onClose,
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={deal ? 'Edit Deal' : 'New Deal'}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit((d) => mutation.mutate(d))}
            loading={mutation.isPending}
          >
            {deal ? 'Save Changes' : 'Create Deal'}
          </Button>
        </>
      }
    >
      <form className="space-y-5">
        {/* Customer + Product */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Customer *"
            error={errors.customer_id?.message}
            placeholder="Select customer"
            {...register('customer_id')}
          >
            {customers.map((c: { id: string; full_name: string }) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </Select>
          <Select
            label="Program *"
            error={errors.product_id?.message}
            placeholder="Select program"
            {...register('product_id')}
          >
            {products.map((p: { id: string; name: string; one_time_price_usd: number }) => (
              <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.one_time_price_usd)}</option>
            ))}
          </Select>
        </div>

        {/* Agent + Start Date */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Sales Agent *"
            error={errors.agent_id?.message}
            placeholder="Select agent"
            {...register('agent_id')}
          >
            {agents.map((a: { id: string; name: string }) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Input
            label="Start Date *"
            type="date"
            error={errors.start_date?.message}
            {...register('start_date')}
          />
        </div>

        {/* Payment Way + Currency */}
        <div className="grid grid-cols-2 gap-4">
          <Select label="Payment Way *" disabled={!selectedProduct} {...register('payment_type')}>
            <option value="full">
              One-Time{selectedProduct ? ` — ${formatCurrency(selectedProduct.one_time_price_usd)}` : ''}
            </option>
            {hasInstallmentPlan && (
              <option value="installment">
                Installment — {formatCurrency(selectedProduct!.installment_monthly_price_usd)} x {selectedProduct!.installment_months}mo
              </option>
            )}
          </Select>
          <Select label="Expected Currency *" {...register('currency')}>
            {Object.entries(CURRENCY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-slate-500 -mt-3">
          Just a default — you'll confirm (or change) the actual currency each time a payment is recorded.
        </p>

        {watchCurrency === 'OTHER' && (
          <Input
            label="Currency Name *"
            placeholder="e.g. EUR, AED…"
            error={errors.other_currency_label?.message}
            {...register('other_currency_label')}
          />
        )}

        {/* Deal price */}
        <div className="rounded-lg bg-brand-navy border border-brand-border px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Deal Price (USD)</span>
          <div className="text-right">
            <span className="text-lg font-bold text-brand-teal block">
              {selectedProduct ? formatCurrency(displayedPrice) : '—'}
            </span>
            {watchCurrency !== 'USD' && installmentsTotalLocal > 0 && (
              <span className="text-xs text-slate-500">
                ≈ {formatCurrency(installmentsTotalLocal, watchCurrency, watch('other_currency_label'))}
              </span>
            )}
          </div>
        </div>

        {/* Payment rows */}
        {fields.length > 0 && (
          <div className="space-y-3">
            {watchPaymentType === 'installment' ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Installment Schedule
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500"># rows:</span>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={fields.length}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(24, parseInt(e.target.value) || 1))
                      const price = watchPrice || 0
                      const amountEach = n > 0 ? Math.round((price / n) * 100) / 100 : price
                      const start = watchStartDate || format(new Date(), 'yyyy-MM-dd')
                      const dates = generateInstallmentDates(start, n, 30)
                      replace(dates.map((d, i) => ({
                        due_date: d,
                        amount: i === n - 1
                          ? Math.round((price - amountEach * (n - 1)) * 100) / 100
                          : amountEach,
                        amount_local: undefined,
                      })))
                    }}
                    className="w-14 rounded bg-brand-navy border border-brand-border text-slate-200 text-xs px-2 py-1 text-center focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const lastDate = fields[fields.length - 1]?.due_date ?? watchStartDate
                      const nextDate = format(addMonths(new Date(lastDate + 'T00:00:00'), 1), 'yyyy-MM-dd')
                      replace([...fields, { due_date: nextDate, amount: 0, amount_local: undefined }])
                    }}
                  >
                    <Plus size={12} />
                    Add Row
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Payment Details — auto-filled from the program, editable if needed
              </p>
            )}
            {watchCurrency !== 'USD' && (
              <p className="text-xs text-slate-500">
                Enter both what the customer actually paid in {watchCurrency === 'OTHER' ? (watch('other_currency_label') || 'their currency') : watchCurrency}, and its USD equivalent — the USD figure drives revenue reporting, the local figure drives commission.
              </p>
            )}
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="flex items-center gap-3">
                  {watchPaymentType === 'installment' && (
                    <span className="text-xs text-slate-500 w-6 text-center">#{i + 1}</span>
                  )}
                  <Input
                    type="date"
                    {...register(`installments.${i}.due_date`)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount (USD)"
                    error={errors.installments?.[i]?.amount?.message}
                    {...register(`installments.${i}.amount`)}
                  />
                  {watchCurrency !== 'USD' && (
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={`Amount (${watchCurrency === 'OTHER' ? 'local' : watchCurrency})`}
                      {...register(`installments.${i}.amount_local`)}
                    />
                  )}
                  {watchPaymentType === 'installment' && (
                    <button
                      type="button"
                      onClick={() => replace(fields.filter((_, j) => j !== i))}
                      className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Textarea label="Notes" placeholder="Notes about this deal…" {...register('notes')} />

        {mutation.error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
            <p className="text-xs text-red-400">{String(mutation.error)}</p>
          </div>
        )}
      </form>
    </Modal>
  )
}
