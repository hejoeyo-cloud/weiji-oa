import client from './client'
import type { GiftResendRecord, GiftResendFeedback } from '../types'

export interface GiftResendListParams {
  page?: number
  page_size?: number
  search?: string
  start_date?: string
  end_date?: string
  all?: boolean
}

export const getGiftResendList = (params: GiftResendListParams = {}) =>
  client.get<{ total: number; items: GiftResendRecord[]; page: number; page_size: number }>('/gift-resend', { params }).then(r => r.data)

export const createGiftResend = (data: Partial<GiftResendRecord>) =>
  client.post<GiftResendRecord>('/gift-resend', data).then(r => r.data)

export const updateGiftResend = (id: number, data: Partial<GiftResendRecord>) =>
  client.put<GiftResendRecord>(`/gift-resend/${id}`, data).then(r => r.data)

export const deleteGiftResend = (id: number) =>
  client.delete(`/gift-resend/${id}`).then(r => r.data)

export const addGiftResendFeedback = (recordId: number, content: string) =>
  client.post<GiftResendFeedback>(`/gift-resend/${recordId}/feedback`, { content }).then(r => r.data)

export const getGiftResendFeedbacks = (recordId: number) =>
  client.get<GiftResendFeedback[]>(`/gift-resend/${recordId}/feedbacks`).then(r => r.data)
