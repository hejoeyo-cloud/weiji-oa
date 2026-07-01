import client from './client'
import { GiftCashback, GiftCashbackFeedback } from '../types'

export interface GiftCashbackListParams {
  page?: number
  page_size?: number
  shop_name?: string
  status?: string
  search?: string
  start_date?: string
  end_date?: string
  all?: boolean
}

export interface GiftCashbackCreateData {
  shop_name?: string
  order_no: string
  cashback_amount: number
  reason: string
  remark: string
  applicant: string
  payment_method: string
  payment_account: string
  payment_qr_code: string
  payee: string
  status: string
}

export const getGiftCashbackList = (params: GiftCashbackListParams = {}) =>
  client.get<{ total: number; items: GiftCashback[]; page: number; page_size: number }>(
    '/gift-cashback', { params }
  ).then(r => r.data)

export const getGiftCashbackDetail = (id: number) =>
  client.get<GiftCashback>(`/gift-cashback/${id}`).then(r => r.data)

export const createGiftCashback = (data: GiftCashbackCreateData) =>
  client.post<GiftCashback>('/gift-cashback', data).then(r => r.data)

export const updateGiftCashback = (id: number, data: Partial<GiftCashbackCreateData>) =>
  client.put<GiftCashback>(`/gift-cashback/${id}`, data).then(r => r.data)

export const deleteGiftCashback = (id: number) =>
  client.delete(`/gift-cashback/${id}`).then(r => r.data)

export const getCashbacksByOrder = (orderNo: string) =>
  client.get<GiftCashback[]>(`/gift-cashback/by-order/${orderNo}`).then(r => r.data)

export const getGiftCashbackFeedbacks = (id: number) =>
  client.get<GiftCashbackFeedback[]>(`/gift-cashback/${id}/feedbacks`).then(r => r.data)

export const addGiftCashbackFeedback = (id: number, content: string) =>
  client.post<GiftCashbackFeedback>(`/gift-cashback/${id}/feedback`, { content }).then(r => r.data)
