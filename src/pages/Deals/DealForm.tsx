import { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { formatCurrency, planToInstallmentCount, generateInstallmentDates } from '@/lib/utils'
import { PLAN_LABELS, type Deal } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { format, addMonths } from 'date-fns'

const schema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  product_id: z.string().min(1, 'Program is required'),
  agent_id: z.string().min(1, 'Agent is required'),
  deal_price_usd: z.coerce.number().positive('Price must be positive'),
  deal_price_iqd: z.coerce.number().optional(),
  discount_amount: z.coerce.number().min(0).default(0),
  payment_type: z.enum(['full', 'installment', 'monthly', 'custom']),
  start_date: z.string().min(1, 'Start date is required'),
  notes: z.string().optional(),
  below_min_note: z.string().optional(),
  currency: z.enum(['USD', 'IQD']).default('USD'),
  installments: z.array(z.object({
    due_date: z.string().min(1, 'Due date required'),
    amount: z.coerce.number().positive('Amount must be positive'),
  })).optional(),
})

type FormData = z.infer<typeof schema>

interface DealFormProps {
  onClose: () => void
  deal?: Deal
  defaultCustomerId?: string
}

export function DealForm({ onClose, deal, defaultCustomerId }: DealFormProps) {
  const { user } = useAuth()
  const [belowMin, setBelowMin] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<{
    min_price_usd: number; list_price_usd: number; default_plan: string
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
      deal_price_iqd: deal?.deal_price_iqd ?? undefined,
      discount_amount: deal?.discount_amount ?? 0,
      payment_type: deal?.payment_type ?? 'full',
      start_date: deal?.start_date ?? format(new Date(), 'yyyy-MM-dd'),
      notes: deal?.notes ?? '',
      currency: 'USD',
      installments: [],
    },
  })

  const { fields, replace } = useFieldArray({ control, name: 'installments' })

  const watchProduct = watch('product_id')
  const watchPrice = watch('deal_price_usd')
  const watchPaymentType = watch('payment_type')
  const watchStartDate = watch('start_date')

  useEffect(() => {
    if (!watchProduct) return
    const product = products.find((p: { id: string }) => p.id === watchProduct)
    if (!product) return
    setSelectedProduct(product)
    setValue('deal_price_usd', product.list_price_usd)

    // Auto-set installments based on default plan
    const count = planToInstallmentCount(product.default_plan as import('@/types').DefaultPlan)
    const payType = count === 1 ? 'full' : 'installment'
    setValue('payment_type', product.default_plan === 'monthly' ? 'monthly' : payType)
  }, [watchProduct, products])

  useEffect(() => {
    if (!selectedProduct) return
    setBelowMin(watchPrice < selectedProduct.min_price_usd && selectedProduct.min_price_usd > 0)
  }, [watchPrice, selectedProduct])

  useEffect(() => {
    if (!selectedProduct || !watchStartDate) return
    if (watchPaymentType === 'full') {
      replace([])
      return
    }
    let count: number
    if (watchPaymentType === 'monthly') count = 1
    else count = planToInstallmentCount(selectedProduct.default_plan as import('@/types').DefaultPlan)

    const price = watchPrice || 0
    const amountEach = count > 0 ? Math.round((price / count) * 100) / 100 : price
    const dates = generateInstallmentDates(watchStartDate, count, 30)
    replace(dates.map((d, i) => ({
      due_date: d,
      // Last installment absorbs any rounding remainder
      amount: i === count - 1
        ? Math.round((price - amountEach * (count - 1)) * 100) / 100
        : amountEach,
    })))
  }, [watchPaymentType, selectedProduct, watchStartDate])

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const dealPayload = {
        customer_id: data.customer_id,
        product_id: data.product_id,
        agent_id: data.agent_id,
        deal_price_usd: data.deal_price_usd,
        deal_price_iqd: data.deal_price_iqd,
        discount_amount: data.discount_amount,
        payment_type: data.payment_type,
        start_date: data.start_date,
        notes: data.notes,
        below_min_override: belowMin,
        below_min_note: belowMin ? data.below_min_note : null,
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

      const installs = data.installments ?? []
      const totalAmount = installs.reduce((s, i) => s + i.amount, 0) || data.deal_price_usd

      const { data: plan, error: planError } = await supabase
        .from('payment_plans')
        .insert({
          deal_id: dealId,
          total_amount: totalAmount,
          num_installments: installs.length || 1,
          installment_amount: installs[0]?.amount,
          currency: data.currency,
        })
        .select()
        .single()
      if (planError) throw planError

      if (installs.length > 0 && plan) {
        const { error: instError } = await supabase.from('installments').insert(
          installs.map((inst, i) => ({
            deal_id: dealId,
            payment_plan_id: plan.id,
            installment_number: i + 1,
            amount_due: inst.amount,
            due_date: inst.due_date,
            status: 'pending',
          }))
        )
        if (instError) throw instError
      } else {
        // Full payment — one installment (works for both new and edited deals)
        const { error: instError } = await supabase.from('installments').insert({
          deal_id: dealId,
          payment_plan_id: plan?.id,
          installment_number: 1,
          amount_due: data.deal_price_usd,
          due_date: data.start_date,
          status: 'pending',
        })
        if (instError) throw instError
      }

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: deal ? 'updated' : 'created',
        entity_type: 'deal',
        entity_id: dealId,
      })
    },
    onSuccess: onClose,
  })

  const totalInstallments = fields.reduce((s, f) => s + (Number(f.amount) || 0), 0)
  const priceMismatch = fields.length > 0 && Math.abs(totalInstallments - watchPrice) > 0.01

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
            disabled={priceMismatch}
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
            {products.map((p: { id: string; name: string; list_price_usd: number }) => (
              <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.list_price_usd)}</option>
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

        {/* Price + Discount */}
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Deal Price (USD) *"
            type="number"
            step="0.01"
            error={errors.deal_price_usd?.message}
            {...register('deal_price_usd')}
          />
          <Input
            label="Price (IQD, optional)"
            type="number"
            placeholder="e.g. 850000"
            {...register('deal_price_iqd')}
          />
          <Input
            label="Discount (USD)"
            type="number"
            step="0.01"
            {...register('discount_amount')}
          />
        </div>

        {/* Below-min warning */}
        {belowMin && (
          <div className="flex items-start gap-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-4 py-3">
            <AlertCircle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-yellow-300">
                Price is below minimum ({formatCurrency(selectedProduct?.min_price_usd ?? 0)})
              </p>
              <Input
                placeholder="Reason for below-minimum price…"
                className="mt-2"
                {...register('below_min_note')}
              />
            </div>
          </div>
        )}

        {/* Payment Type */}
        <Select label="Payment Type *" {...register('payment_type')}>
          <option value="full">Full Payment (One Shot)</option>
          <option value="installment">Installments</option>
          <option value="monthly">Monthly Subscription</option>
          <option value="custom">Custom</option>
        </Select>

        {/* Installment Schedule */}
        {(watchPaymentType === 'installment' || watchPaymentType === 'monthly' || watchPaymentType === 'custom') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Installment Schedule
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const lastDate = fields[fields.length - 1]?.due_date ?? watchStartDate
                  const nextDate = format(addMonths(new Date(lastDate), 1), 'yyyy-MM-dd')
                  replace([...fields, { due_date: nextDate, amount: 0 }])
                }}
              >
                <Plus size={12} />
                Add Row
              </Button>
            </div>

            {priceMismatch && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
                <p className="text-xs text-red-400">
                  Installment total ({formatCurrency(totalInstallments)}) must equal deal price ({formatCurrency(watchPrice)})
                </p>
              </div>
            )}

            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-6 text-center">#{i + 1}</span>
                  <Input
                    type="date"
                    {...register(`installments.${i}.due_date`)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    {...register(`installments.${i}.amount`)}
                  />
                  <button
                    type="button"
                    onClick={() => replace(fields.filter((_, j) => j !== i))}
                    className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {fields.length > 0 && (
              <div className={`text-xs px-3 py-2 rounded-lg ${priceMismatch ? 'text-red-400 bg-red-500/10' : 'text-brand-teal bg-teal-500/10'}`}>
                Total: {formatCurrency(totalInstallments)} / {formatCurrency(watchPrice)}
              </div>
            )}
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
