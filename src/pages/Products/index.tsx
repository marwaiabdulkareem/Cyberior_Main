import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Archive, RotateCcw, Trash2, AlertCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'
import { PLAN_LABELS, type Product, type DefaultPlan } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  list_price_usd: z.coerce.number().min(0),
  min_price_usd: z.coerce.number().min(0),
  default_plan: z.enum(['one_shot', 'two_shots', 'three_shots', 'five_shots', 'seven_shots', 'monthly', 'custom']),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface ProductFormProps {
  product?: Product
  onClose: () => void
}

function ProductForm({ product, onClose }: ProductFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? '',
      list_price_usd: product?.list_price_usd ?? 0,
      min_price_usd: product?.min_price_usd ?? 0,
      default_plan: (product?.default_plan as DefaultPlan) ?? 'one_shot',
      notes: product?.notes ?? '',
    },
  })

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
        <div className="grid grid-cols-2 gap-4">
          <Input label="List Price (USD)" type="number" step="0.01" error={errors.list_price_usd?.message} {...register('list_price_usd')} />
          <Input label="Minimum Price (USD)" type="number" step="0.01" {...register('min_price_usd')} />
        </div>
        <Select label="Default Payment Plan *" error={errors.default_plan?.message} {...register('default_plan')}>
          {Object.entries(PLAN_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
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
                    <p className="text-xs text-slate-500">List Price</p>
                    <p className="text-lg font-bold text-brand-teal">
                      {product.list_price_usd > 0 ? formatCurrency(product.list_price_usd) : 'Custom'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Min Price</p>
                    <p className="text-base font-medium text-slate-300">
                      {product.min_price_usd > 0 ? formatCurrency(product.min_price_usd) : '—'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Default Plan</p>
                  <p className="text-sm text-slate-300">{PLAN_LABELS[product.default_plan as DefaultPlan] ?? product.default_plan}</p>
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
