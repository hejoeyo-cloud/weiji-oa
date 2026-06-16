import client from './client'
import { GiftRecord, GiftFeedback } from '../types'

export interface GiftListParams {
  page?: number
  page_size?: number
  status?: string
  shop_name?: string
  search?: string
  start_date?: string
  end_date?: string
  all?: boolean
}

export interface GiftCreateData {
  customer_name?: string
  customer_phone?: string
  platform?: string
  order_no?: string
  gift_name?: string
  gift_qty?: number
  activity_name?: string
  remark?: string
  status?: string
}

export const getGiftList = (params: GiftListParams = {}) =>
  client.get<{ total: number; items: GiftRecord[]; page: number; page_size: number }>(
    '/gifts', { params }
  ).then(r => r.data)

export const getGiftDetail = (id: number) =>
  client.get<GiftRecord>(`/gifts/${id}`).then(r => r.data)

export const createGift = (data: GiftCreateData) =>
  client.post<GiftRecord>('/gifts', data).then(r => r.data)

export const updateGift = (id: number, data: Partial<GiftCreateData>) =>
  client.put<GiftRecord>(`/gifts/${id}`, data).then(r => r.data)

export const deleteGift = (id: number) =>
  client.delete(`/gifts/${id}`).then(r => r.data)

export const addGiftFeedback = (recordId: number, content: string) =>
  client.post<GiftFeedback>(`/gifts/${recordId}/feedback`, { content }).then(r => r.data)

export const getGiftFeedbacks = (recordId: number) =>
  client.get<GiftFeedback[]>(`/gifts/${recordId}/feedbacks`).then(r => r.data)

// ── 礼品预设组合 ──────────────────────────────────────────────────

export interface GiftPreset {
  id: number
  name: string
  items: { name: string; amount: number }[]
  created_by?: number
  creator_name?: string
  created_at?: string
}

export const getGiftPresets = () =>
  client.get<GiftPreset[]>('/gift-presets').then(r => r.data)

export const createGiftPreset = (data: { name: string; items: { name: string; amount: number }[] }) =>
  client.post<GiftPreset>('/gift-presets', data).then(r => r.data)

export const deleteGiftPreset = (id: number) =>
  client.delete(`/gift-presets/${id}`).then(r => r.data)
