import * as XLSX from 'xlsx'
import { formatDate, formatCurrency, calcCommission, calcAgentShare } from './utils'
import type { Deal, Installment, Customer, SalesAgent } from '@/types'

function downloadWorkbook(wb: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(wb, fileName)
}

export function exportCustomersToExcel(customers: Customer[]) {
  const rows = customers.map((c) => ({
    'Full Name': c.full_name,
    Phone: c.phone ?? '',
    Email: c.email ?? '',
    Country: c.country ?? '',
    Status: c.status,
    'Lead Source': c.lead_source ?? '',
    'Created At': formatDate(c.created_at),
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Customers')
  downloadWorkbook(wb, `cyberior_customers_${Date.now()}.xlsx`)
}

export function exportDealsToExcel(deals: Deal[]) {
  const rows = deals.map((d) => ({
    'Customer': d.customer?.full_name ?? '',
    'Phone': d.customer?.phone ?? '',
    'Program': d.product?.name ?? '',
    'Agent': d.agent?.name ?? '',
    'Deal Price (USD)': d.deal_price_usd,
    'Discount': d.discount_amount,
    'Payment Type': d.payment_type,
    'Status': d.status,
    'Start Date': formatDate(d.start_date),
    'Notes': d.notes ?? '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Deals')
  downloadWorkbook(wb, `cyberior_deals_${Date.now()}.xlsx`)
}

export function exportInstallmentsToExcel(installments: Installment[]) {
  const rows = installments.map((i) => ({
    'Customer': i.deal?.customer?.full_name ?? '',
    'Program': i.deal?.product?.name ?? '',
    'Agent': i.deal?.agent?.name ?? '',
    'Installment #': i.installment_number,
    'Amount Due (USD)': i.amount_due,
    'Amount Paid (USD)': i.amount_paid,
    'Remaining (USD)': i.amount_due - i.amount_paid,
    'Currency': i.currency === 'OTHER' ? (i.other_currency_label ?? 'Other') : i.currency,
    'Amount Paid (Local)': i.currency === 'USD' ? '' : (i.amount_paid_local ?? ''),
    'Due Date': formatDate(i.due_date),
    'Paid Date': formatDate(i.paid_date),
    'Status': i.status,
    'Payment Method': i.payment_method ?? '',
    'Notes': i.notes ?? '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Installments')
  downloadWorkbook(wb, `cyberior_installments_${Date.now()}.xlsx`)
}

export function exportAgentReportToExcel(agents: SalesAgent[], deals: Deal[]) {
  const rows = agents.map((agent) => {
    const agentDeals = deals.filter((d) => d.agent_id === agent.id || d.co_agent_id === agent.id)
    const totalSales = agentDeals.reduce((s, d) => s + d.deal_price_usd * calcAgentShare(d, agent.id), 0)
    const collected = agentDeals.reduce((s, d) => {
      const paid = d.installments?.reduce((a, i) => a + i.amount_paid, 0) ?? 0
      return s + paid * calcAgentShare(d, agent.id)
    }, 0)
    const commission = calcCommission(totalSales, agent.commission_rate)
    return {
      'Agent': agent.name,
      'Email': agent.email ?? '',
      'Total Deals': agentDeals.length,
      'Total Sales (USD)': totalSales,
      'Collected (USD)': collected,
      'Pending (USD)': totalSales - collected,
      'Commission (10%)': commission,
    }
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Agent Report')
  downloadWorkbook(wb, `cyberior_agent_report_${Date.now()}.xlsx`)
}

export function exportOverdueToExcel(installments: Installment[]) {
  const overdue = installments.filter((i) => i.status === 'late')
  const rows = overdue.map((i) => ({
    'Customer': i.deal?.customer?.full_name ?? '',
    'Phone': i.deal?.customer?.phone ?? '',
    'Program': i.deal?.product?.name ?? '',
    'Agent': i.deal?.agent?.name ?? '',
    'Amount Due': i.amount_due,
    'Amount Paid': i.amount_paid,
    'Remaining': i.amount_due - i.amount_paid,
    'Due Date': formatDate(i.due_date),
    'Days Overdue': Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000),
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Overdue Payments')
  downloadWorkbook(wb, `cyberior_overdue_${Date.now()}.xlsx`)
}

export function exportToGoogleSheetsCSV(data: Record<string, unknown>[], sheetName: string) {
  const ws = XLSX.utils.json_to_sheet(data)
  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${sheetName}_${Date.now()}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
