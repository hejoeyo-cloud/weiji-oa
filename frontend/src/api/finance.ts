import client from './client'

// ── 客户开票申请 ──────────────────────────────────────────────

export interface InvoiceRequestListParams {
  page?: number
  page_size?: number
  keyword?: string
  status?: string
  invoice_type?: string
  start_date?: string
  end_date?: string
  all?: boolean
}

export interface InvoiceRequestCreateData {
  apply_date?: string
  order_no?: string
  shop_name?: string
  customer_name?: string
  tax_id?: string
  register_address?: string
  bank_account?: string
  invoice_type?: string
  invoice_content?: string
  amount?: number
  tax_rate?: number
  tax_amount?: number
  email?: string
  mail_address?: string
  status?: string
  remark?: string
  handler?: string
  sales_invoice_id?: number | null
}

export const getInvoiceRequests = (params: InvoiceRequestListParams) =>
  client.get('/finance/invoice-requests', { params })

export const createInvoiceRequest = (data: InvoiceRequestCreateData) =>
  client.post('/finance/invoice-requests', data)

export const updateInvoiceRequest = (id: number, data: Partial<InvoiceRequestCreateData>) =>
  client.put(`/finance/invoice-requests/${id}`, data)

export const deleteInvoiceRequest = (id: number) =>
  client.delete(`/finance/invoice-requests/${id}`)

export const uploadInvoiceFile = (id: number, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post(`/finance/invoice-requests/${id}/upload-invoice`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}


// ── 销项发票台账 ──────────────────────────────────────────────

export interface SalesInvoiceListParams {
  page?: number
  page_size?: number
  keyword?: string
  invoice_type?: string
  start_date?: string
  end_date?: string
  all?: boolean
}

export interface SalesInvoiceCreateData {
  invoice_date?: string
  invoice_code?: string
  invoice_no?: string
  invoice_type?: string
  buyer_name?: string
  buyer_tax_id?: string
  invoice_content?: string
  amount?: number
  tax_rate?: number
  tax_amount?: number
  total_amount?: number
  order_no?: string
  shop_name?: string
  handler?: string
  remark?: string
}

export const getSalesInvoices = (params: SalesInvoiceListParams) =>
  client.get('/finance/sales-invoices', { params })

export const createSalesInvoice = (data: SalesInvoiceCreateData) =>
  client.post('/finance/sales-invoices', data)

export const updateSalesInvoice = (id: number, data: Partial<SalesInvoiceCreateData>) =>
  client.put(`/finance/sales-invoices/${id}`, data)

export const deleteSalesInvoice = (id: number) =>
  client.delete(`/finance/sales-invoices/${id}`)


// ── 进项发票台账 ──────────────────────────────────────────────

export interface PurchaseInvoiceListParams {
  page?: number
  page_size?: number
  keyword?: string
  invoice_type?: string
  is_certified?: boolean
  start_date?: string
  end_date?: string
  all?: boolean
}

export interface PurchaseInvoiceCreateData {
  receive_date?: string
  invoice_date?: string
  invoice_code?: string
  invoice_no?: string
  invoice_type?: string
  seller_name?: string
  seller_tax_id?: string
  invoice_content?: string
  amount?: number
  tax_rate?: number
  tax_amount?: number
  total_amount?: number
  is_certified?: boolean
  certified_date?: string
  certification_result?: string
  due_date?: string
  related_contract?: string
  receiver?: string
  remark?: string
}

export const getPurchaseInvoices = (params: PurchaseInvoiceListParams) =>
  client.get('/finance/purchase-invoices', { params })

export const createPurchaseInvoice = (data: PurchaseInvoiceCreateData) =>
  client.post('/finance/purchase-invoices', data)

export const updatePurchaseInvoice = (id: number, data: Partial<PurchaseInvoiceCreateData>) =>
  client.put(`/finance/purchase-invoices/${id}`, data)

export const deletePurchaseInvoice = (id: number) =>
  client.delete(`/finance/purchase-invoices/${id}`)


// ── 报销发票台账 ──────────────────────────────────────────────

export interface ExpenseInvoiceListParams {
  page?: number
  page_size?: number
  keyword?: string
  is_paid?: boolean
  is_duplicate?: boolean
  start_date?: string
  end_date?: string
  all?: boolean
}

export interface ExpenseInvoiceCreateData {
  invoice_no?: string
  invoice_date?: string
  invoice_type?: string
  seller_name?: string
  summary?: string
  amount?: number
  tax_rate?: number
  tax_amount?: number
  reimbursement_amount?: number
  reimbursement_date?: string
  reimburser?: string
  department?: string
  is_paid?: boolean
  approval_id?: number | null
  remark?: string
}

export const getExpenseInvoices = (params: ExpenseInvoiceListParams) =>
  client.get('/finance/expense-invoices', { params })

export const createExpenseInvoice = (data: ExpenseInvoiceCreateData) =>
  client.post('/finance/expense-invoices', data)

export const updateExpenseInvoice = (id: number, data: Partial<ExpenseInvoiceCreateData>) =>
  client.put(`/finance/expense-invoices/${id}`, data)

export const deleteExpenseInvoice = (id: number) =>
  client.delete(`/finance/expense-invoices/${id}`)


// ── 统计 ────────────────────────────────────────────────────

export const getFinanceStats = () =>
  client.get('/finance/stats')
