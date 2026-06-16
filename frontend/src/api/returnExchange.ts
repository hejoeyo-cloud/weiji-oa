import client from './client'
import { ReturnExchangeRecord, ReturnExchangeFeedback } from '../types'

export interface ReturnExchangeListParams {
  page?: number
  page_size?: number
  status?: string
  record_type?: string
  shop_name?: string
  search?: string
  start_date?: string
  end_date?: string
  all?: boolean
}

export interface ReturnExchangeCreateData {
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
  has_damage?: boolean
  damage_items?: { name: string; amount: number; desc: string }[]
  claim_status?: string
}

export const getReturnExchangeList = (params: ReturnExchangeListParams = {}) =>
  client.get<{ total: number; items: ReturnExchangeRecord[]; page: number; page_size: number }>(
    '/return-exchange', { params }
  ).then(r => r.data)

export const getReturnExchangeDetail = (id: number) =>
  client.get<ReturnExchangeRecord>(`/return-exchange/${id}`).then(r => r.data)

export const createReturnExchange = (data: ReturnExchangeCreateData) =>
  client.post<ReturnExchangeRecord>('/return-exchange', data).then(r => r.data)

export const updateReturnExchange = (id: number, data: Partial<ReturnExchangeCreateData>) =>
  client.put<ReturnExchangeRecord>(`/return-exchange/${id}`, data).then(r => r.data)

export const deleteReturnExchange = (id: number) =>
  client.delete(`/return-exchange/${id}`).then(r => r.data)

export const addReturnExchangeFeedback = (recordId: number, content: string) =>
  client.post<ReturnExchangeFeedback>(`/return-exchange/${recordId}/feedback`, { content }).then(r => r.data)

export const getReturnExchangeFeedbacks = (recordId: number) =>
  client.get<ReturnExchangeFeedback[]>(`/return-exchange/${recordId}/feedbacks`).then(r => r.data)
