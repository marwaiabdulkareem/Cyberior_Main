import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CUSTOMER_STATUS_LABELS, type Customer } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

const schema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  country: z.string().optional(),
  lead_source: z.string().optional(),
  status: z.enum(['lead', 'contacted', 'enrolled', 'active', 'completed', 'cancelled', 'refunded']),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface CustomerFormProps {
  onClose: () => void
  customer?: Customer
}

const COUNTRIES = [
  'Iraq', 'Saudi Arabia', 'UAE', 'Kuwait', 'Oman', 'Jordan', 'Egypt',
  'Lebanon', 'Syria', 'Qatar', 'Bahrain', 'Yemen', 'Libya', 'Tunisia',
  'Morocco', 'Algeria', 'Sudan', 'Other',
]

const LEAD_SOURCES = [
  'Instagram', 'TikTok', 'WhatsApp', 'Referral', 'Website', 'YouTube',
  'Telegram', 'Webinar', 'Other',
]

export function CustomerForm({ onClose, customer }: CustomerFormProps) {
  const { user } = useAuth()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: customer?.full_name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      country: customer?.country ?? '',
      lead_source: customer?.lead_source ?? '',
      status: customer?.status ?? 'lead',
      notes: customer?.notes ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (customer) {
        const { error } = await supabase
          .from('customers')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', customer.id)
        if (error) throw error
        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: user?.id, action: 'updated', entity_type: 'customer',
          entity_id: customer.id, entity_label: data.full_name,
        })
      } else {
        const { data: inserted, error } = await supabase
          .from('customers')
          .insert({ ...data, created_by: user?.id })
          .select()
          .single()
        if (error) throw error
        await supabase.from('activity_logs').insert({
          user_id: user?.id, action: 'created', entity_type: 'customer',
          entity_id: inserted.id, entity_label: data.full_name,
        })
      }
    },
    onSuccess: onClose,
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={customer ? 'Edit Customer' : 'Add New Customer'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit((d) => mutation.mutate(d))}
            loading={mutation.isPending}
          >
            {customer ? 'Save Changes' : 'Add Customer'}
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Full Name *"
            placeholder="Student full name"
            error={errors.full_name?.message}
            {...register('full_name')}
          />
          <Input
            label="Phone"
            placeholder="+964 7XX XXX XXXX"
            {...register('phone')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="student@email.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Select label="Country" {...register('country')} placeholder="Select country">
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Lead Source" {...register('lead_source')} placeholder="Select source">
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select label="Status *" error={errors.status?.message} {...register('status')}>
            {Object.entries(CUSTOMER_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </div>

        <Textarea
          label="Notes"
          placeholder="Any additional notes about this customer…"
          {...register('notes')}
        />

        {mutation.error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
            <p className="text-xs text-red-400">
              {mutation.error instanceof Error
                ? mutation.error.message
                : JSON.stringify(mutation.error)}
            </p>
          </div>
        )}
      </form>
    </Modal>
  )
}
