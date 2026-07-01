import client from './client'
import type { GiftResendRecord, GiftResendFeedback } from '../types'

export interface GiftResendListParams {
  page?: number
  page_size?: number
  shop_name?: string
  search?: string
  start_date?: string
  end_date?: string
  status?: string
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

// ── 礼品补发预设组合 ──────────────────────────────────────────────

export interface GiftResendPreset {
  id: number
  name: string
  items: { name: string; quantity: number; amount: number }[]
  created_by?: number
  creator_name?: string
  created_at?: string
}

export const getGiftResendPresets = () =>
  client.get<GiftResendPreset[]>('/gift-resend-presets').then(r => r.data)

export const createGiftResendPreset = (data: { name: string; items: { name: string; quantity: number; amount: number }[] }) =>
  client.post<GiftResendPreset>('/gift-resend-presets', data).then(r => r.data)

export const deleteGiftResendPreset = (id: number) =>
  client.delete(`/gift-resend-presets/${id}`).then(r => r.data)
