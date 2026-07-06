import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Archive, RotateCcw, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  one_time_price_usd: z.coerce.number().min(0),
  installment_monthly_price_usd: z.coerce.number().min(0),
  installment_months: z.coerce.number().int().min(0, 'Cannot be negative'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface ProductFormProps {
  product?: Product
  onClose: () => void
}

function ProductForm({ product, onClose }: ProductFormProps) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? '',
      one_time_price_usd: product?.one_time_price_usd ?? 0,
      installment_monthly_price_usd: product?.installment_monthly_price_usd ?? 0,
      installment_months: product?.installment_months ?? 1,
      notes: product?.notes ?? '',
    },
  })

  const months = watch('installment_months')
  const monthly = watch('installment_monthly_price_usd')

  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (product) {
        const { error } = await supabase.from('products').update(data).eq('id', product.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').insert(data)
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); onClose() },
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? 'Edit Program' : 'Add New Program'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit((d) => mutation.mutate(d))} loading={mutation.isPending}>
            {product ? 'Save' : 'Add Program'}
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <Input label="Program Name *" error={errors.name?.message} {...register('name')} />

        <Input
          label="One-Time Price (USD) *"
          type="number"
          step="0.01"
          error={errors.one_time_price_usd?.message}
          {...register('one_time_price_usd')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Installment Price / Month (USD) *"
            type="number"
            step="0.01"
            error={errors.installment_monthly_price_usd?.message}
            {...register('installment_monthly_price_usd')}
          />
          <Input
            label="Number of Months"
            type="number"
            step="1"
            error={errors.installment_months?.message}
            {...register('installment_months')}
          />
        </div>

        {monthly > 0 && months > 0 ? (
          <p className="text-xs text-slate-500">
            Installment total: {formatCurrency(monthly * months)} over {months} month{months !== 1 ? 's' : ''}
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Set price/months to 0 for a one-time-only program (no installment option in New Deal).
          </p>
        )}

        <Textarea label="Notes" {...register('notes')} />
        {mutation.error && <p className="text-xs text-red-400">{String(mutation.error)}</p>}
      </form>
    </Modal>
  )
}

export default function Products() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').order('name')
      return (data ?? []) as Product[]
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from('products').update({ is_active }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('products').delete().eq('id', id)
    },
    onSuccess: () => { setDeleteId(null); qc.invalidateQueries({ queryKey: ['products'] }) },
  })

  const displayed = showInactive ? products : products.filter((p) => p.is_active)

  return (
    <Layout title="Programs">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded"
              />
              Show archived
            </label>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              Add Program
            </Button>
          )}
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((product) => (
              <div
                key={product.id}
                className={cn(
                  'rounded-xl border p-5 space-y-3 transition-opacity',
                  product.is_active
                    ? 'bg-brand-surface border-brand-border'
                    : 'bg-brand-navy border-brand-border/30 opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-slate-200">{product.name}</h3>
                    {!product.is_active && (
                      <span className="text-xs text-slate-500">Archived</span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditProduct(product)}
                        className="p-1.5 rounded text-slate-500 hover:text-brand-teal hover:bg-brand-navy transition-colors"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={() => toggleActive.mutate({ id: product.id, is_active: !product.is_active })}
                        className="p-1.5 rounded text-slate-500 hover:text-yellow-400 hover:bg-brand-navy transition-colors"
                      >
                        {product.is_active ? <Archive size={13} /> : <RotateCcw size={13} />}
                      </button>
                      <button
                        onClick={() => setDeleteId(product.id)}
                        className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-brand-navy transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">One-Time</p>
                    <p className="text-lg font-bold text-brand-teal">
                      {formatCurrency(product.one_time_price_usd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Installment</p>
                    <p className="text-base font-medium text-slate-300">
                      {product.installment_monthly_price_usd > 0
                        ? `${formatCurrency(product.installment_monthly_price_usd)} x ${product.installment_months}mo`
                        : '—'}
                    </p>
                  </div>
                </div>

                {product.notes && (
                  <p className="text-xs text-slate-500 italic">{product.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {(showForm || editProduct) && (
        <ProductForm
          product={editProduct ?? undefined}
          onClose={() => { setShowForm(false); setEditProduct(null) }}
        />
      )}

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteProduct.mutate(deleteId!)}
        title="Delete Program"
        message="Delete this program? Existing deals using it will not be affected."
        loading={deleteProduct.isPending}
      />
    </Layout>
  )
}
