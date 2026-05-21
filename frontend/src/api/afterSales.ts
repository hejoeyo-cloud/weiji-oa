import client from './client'
import { AfterSalesRecord, AfterSalesFeedback, AfterSalesChargeRequest } from '../types'

export interface AfterSalesListParams {
  page?: number
  page_size?: number
  status?: string
  charge_status?: string
  record_type?: string
  search?: string
  start_date?: string
  end_date?: string
  all?: boolean
}

export interface AfterSalesCreateData {
  apply_date?: string
  order_no?: string
  return_reason?: string
  size?: string
  model?: string
  config?: string
  computer_price?: number
  quantity?: number
  accessories?: string
  accessories_price?: number
  customer_info?: string
  return_tracking?: string
  send_tracking?: string
  handle_result?: string
  progress?: string
  disassembly_feedback?: string
  shipping_fee?: number
  remark?: string
  record_type?: string
}

export interface AfterSalesChargeRequestCreateData {
  expected_amount: number
  charge_note?: string
}

export interface AfterSalesChargeRequestPaidData {
  paid_amount: number
  amount_change_note?: string
}

export const getAfterSalesList = (params: AfterSalesListParams = {}) =>
  client.get<{ total: number; items: AfterSalesRecord[]; page: number; page_size: number }>(
    '/after-sales', { params }
  ).then(r => r.data)

export const getAfterSalesDetail = (id: number) =>
  client.get<AfterSalesRecord>(`/after-sales/${id}`).then(r => r.data)

export const createAfterSales = (data: AfterSalesCreateData) =>
  client.post<AfterSalesRecord>('/after-sales', data).then(r => r.data)

export const updateAfterSales = (id: number, data: Partial<AfterSalesCreateData>) =>
  client.put<AfterSalesRecord>(`/after-sales/${id}`, data).then(r => r.data)

export const deleteAfterSales = (id: number) =>
  client.delete(`/after-sales/${id}`).then(r => r.data)

export const addAfterSalesFeedback = (recordId: number, content: string) =>
  client.post<AfterSalesFeedback>(`/after-sales/${recordId}/feedback`, { content }).then(r => r.data)

export const getAfterSalesFeedbacks = (recordId: number) =>
  client.get<AfterSalesFeedback[]>(`/after-sales/${recordId}/feedbacks`).then(r => r.data)

export const getAfterSalesChargeRequests = (recordId: number) =>
  client.get<AfterSalesChargeRequest[]>(`/after-sales/${recordId}/charge-requests`).then(r => r.data)

export const createAfterSalesChargeRequest = (recordId: number, data: AfterSalesChargeRequestCreateData) =>
  client.post<AfterSalesChargeRequest>(`/after-sales/${recordId}/charge-requests`, data).then(r => r.data)

export const markAfterSalesChargePaid = (chargeId: number, data: AfterSalesChargeRequestPaidData) =>
  client.post<AfterSalesChargeRequest>(`/after-sales/charge-requests/${chargeId}/mark-paid`, data).then(r => r.data)

export const cancelAfterSalesChargeRequest = (chargeId: number, reason: string) =>
  client.post<AfterSalesChargeRequest>(`/after-sales/charge-requests/${chargeId}/cancel`, { reason }).then(r => r.data)
