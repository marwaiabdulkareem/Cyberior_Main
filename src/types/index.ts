export type Role = 'admin' | 'agent' | 'finance'

export type CustomerStatus = 'lead' | 'contacted' | 'enrolled' | 'active' | 'completed' | 'cancelled' | 'refunded'

export type DealStatus = 'active' | 'completed' | 'cancelled' | 'refunded' | 'paused'

export type PaymentType = 'full' | 'installment' | 'monthly' | 'custom'

export type InstallmentStatus = 'pending' | 'paid' | 'partial' | 'late' | 'cancelled' | 'paused'

export type PaymentMethod = 'card' | 'bank_transfer' | 'superq' | 'zaincash' | 'western_union' | 'cash' | 'other'

export type Currency = 'USD' | 'IQD' | 'TRY' | 'OTHER'

export type NotificationType = 'payment_due' | 'payment_overdue' | 'payment_received' | 'deal_created' | 'below_min_price' | 'installment_paused' | 'refund'

export interface Profile {
  id: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SalesAgent {
  id: string
  profile_id: string | null
  name: string
  email: string | null
  phone: string | null
  commission_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  one_time_price_usd: number
  installment_monthly_price_usd: number
  installment_months: number
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  country: string | null
  lead_source: string | null
  status: CustomerStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  customer_id: string
  product_id: string
  agent_id: string
  deal_price_usd: number
  deal_price_iqd: number | null
  discount_amount: number
  payment_type: PaymentType
  status: DealStatus
  start_date: string | null
  below_min_override: boolean
  below_min_note: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  customer?: Customer
  product?: Product
  agent?: SalesAgent
  payment_plan?: PaymentPlan
  installments?: Installment[]
}

export interface PaymentPlan {
  id: string
  deal_id: string
  total_amount: number
  num_installments: number
  installment_amount: number | null
  currency: Currency
  other_currency_label: string | null
  created_at: string
  updated_at: string
}

export interface Installment {
  id: string
  deal_id: string
  payment_plan_id: string | null
  installment_number: number
  amount_due: number
  amount_paid: number
  amount_due_local: number | null
  amount_paid_local: number | null
  due_date: string
  paid_date: string | null
  status: InstallmentStatus
  payment_method: PaymentMethod | null
  proof_url: string | null
  notes: string | null
  recorded_by: string | null
  created_at: string
  updated_at: string
  deal?: Deal
}

export interface Note {
  id: string
  entity_type: 'customer' | 'deal' | 'installment'
  entity_id: string
  content: string
  created_by: string | null
  created_at: string
  profile?: Profile
}

export interface Attachment {
  id: string
  entity_type: 'customer' | 'deal' | 'installment'
  entity_id: string
  file_url: string
  file_name: string
  file_size: number | null
  uploaded_by: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string | null
  user_name: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  is_read: boolean
  entity_type: string | null
  entity_id: string | null
  created_at: string
}

// Dashboard types
export interface DashboardKPIs {
  total_revenue: number
  total_collected: number
  total_pending: number
  total_overdue: number
  active_students: number
  new_deals_this_month: number
  fully_paid_count: number
  installment_count: number
  overdue_count: number
  collection_rate: number
}

export interface AgentPerformance {
  agent_id: string
  agent_name: string
  total_sales: number
  collected: number
  pending: number
  overdue: number
  deal_count: number
  commission_earned: number
}

export interface RevenueByMonth {
  month: string
  revenue: number
  collected: number
}

export interface RevenueByProgram {
  product_name: string
  revenue: number
  deal_count: number
}

// Form types
export interface CustomerFormData {
  full_name: string
  phone: string
  email: string
  country: string
  lead_source: string
  status: CustomerStatus
  notes: string
}

export interface DealFormData {
  customer_id: string
  product_id: string
  agent_id: string
  deal_price_usd: number
  payment_type: PaymentType
  start_date: string
  notes: string
  currency: Currency
  other_currency_label?: string
}

export interface InstallmentUpdateData {
  amount_paid: number
  amount_paid_local?: number | null
  paid_date: string
  payment_method: PaymentMethod
  proof_url?: string
  notes?: string
  status: InstallmentStatus
}

// Filter types
export interface CustomerFilters {
  search: string
  status: CustomerStatus | ''
  agent_id: string
  country: string
}

export interface DealFilters {
  search: string
  status: DealStatus | ''
  agent_id: string
  product_id: string
  payment_type: PaymentType | ''
  date_from: string
  date_to: string
}

export interface InstallmentFilters {
  status: InstallmentStatus | ''
  agent_id: string
  product_id: string
  date_from: string
  date_to: string
  overdue_only: boolean
}

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: 'US Dollar (USD)',
  IQD: 'Iraqi Dinar (IQD)',
  TRY: 'Turkish Lira (TRY)',
  OTHER: 'Other',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Card / Stripe',
  bank_transfer: 'Bank Transfer / IBAN',
  superq: 'SuperQ',
  zaincash: 'ZainCash',
  western_union: 'Western Union',
  cash: 'Cash',
  other: 'Other',
}

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  enrolled: 'Enrolled',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  paused: 'Paused',
}

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  partial: 'Partially Paid',
  late: 'Overdue',
  cancelled: 'Cancelled',
  paused: 'Paused',
}
