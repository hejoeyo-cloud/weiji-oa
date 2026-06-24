import client from './client'
import { RepairRecord, RepairFeedback, RepairChargeRequest } from '../types'

export interface RepairListParams {
  page?: number
  page_size?: number
  repair_status?: string
  charge_status?: string
  shop_name?: string
  search?: string
  start_date?: string
  end_date?: string
  all?: boolean
}

export interface RepairCreateData {
  apply_date?: string
  order_no?: string
  shop_name?: string
  return_reason?: string  // 故障描述
  model?: string
  config?: string
  quantity?: number
  accessories?: string
  customer_info?: string
  return_tracking?: string
  send_tracking?: string
  handle_result?: string
  repair_status?: string  // pending_repair | processing_repair | completed_repair
  charge_required?: boolean
  charge_status?: string
  current_expected_amount?: number
  current_paid_amount?: number
  last_charge_request_id?: number
  disassembly_feedback?: string
  shipping_fee?: number
  remark?: string
}

export interface RepairChargeRequestCreateData {
  expected_amount: number
  charge_note?: string
}

export interface RepairChargeRequestPaidData {
  paid_amount: number
  amount_change_note?: string
}

export const getRepairList = (params: RepairListParams = {}) =>
  client.get<{ total: number; items: RepairRecord[]; page: number; page_size: number }>(
    '/repair', { params }
  ).then(r => r.data)

export const getRepairDetail = (id: number) =>
  client.get<RepairRecord>(`/repair/${id}`).then(r => r.data)

export const createRepair = (data: RepairCreateData) =>
  client.post<RepairRecord>('/repair', data).then(r => r.data)

export const updateRepair = (id: number, data: Partial<RepairCreateData>) =>
  client.put<RepairRecord>(`/repair/${id}`, data).then(r => r.data)

export const deleteRepair = (id: number) =>
  client.delete(`/repair/${id}`).then(r => r.data)

export const addRepairFeedback = (recordId: number, content: string) =>
  client.post<RepairFeedback>(`/repair/${recordId}/feedback`, { content }).then(r => r.data)

export const getRepairFeedbacks = (recordId: number) =>
  client.get<RepairFeedback[]>(`/repair/${recordId}/feedbacks`).then(r => r.data)

export const getRepairChargeRequests = (recordId: number) =>
  client.get<RepairChargeRequest[]>(`/repair/${recordId}/charge-requests`).then(r => r.data)

export const createRepairChargeRequest = (recordId: number, data: RepairChargeRequestCreateData) =>
  client.post<RepairChargeRequest>(`/repair/${recordId}/charge-requests`, data).then(r => r.data)

export const markRepairChargePaid = (chargeId: number, data: RepairChargeRequestPaidData) =>
  client.post<RepairChargeRequest>(`/repair/charge-requests/${chargeId}/mark-paid`, data).then(r => r.data)

export const cancelRepairChargeRequest = (chargeId: number, reason: string) =>
  client.post<RepairChargeRequest>(`/repair/charge-requests/${chargeId}/cancel`, { reason }).then(r => r.data)
