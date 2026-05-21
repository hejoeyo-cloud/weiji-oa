import client from './client'
import type { ScheduleShift, ScheduleSlot, ShiftSwapRequest } from '../types'

// ── 排班相关用户 ──────────────────────────────────────────────────
export const getScheduleUsers = () =>
  client.get<{ id: number; name: string; role: string }[]>('/schedule/users').then(r => r.data)

// ── 班次类型 ──────────────────────────────────────────────────────
export const getShifts = () =>
  client.get<ScheduleShift[]>('/schedule/shifts').then(r => r.data)

export const createShift = (data: Partial<ScheduleShift>) =>
  client.post<ScheduleShift>('/schedule/shifts', data).then(r => r.data)

export const updateShift = (id: number, data: Partial<ScheduleShift>) =>
  client.put<ScheduleShift>(`/schedule/shifts/${id}`, data).then(r => r.data)

export const deleteShift = (id: number) =>
  client.delete(`/schedule/shifts/${id}`).then(r => r.data)

// ── 排班记录 ──────────────────────────────────────────────────────
export const getSlots = (yearMonth: string) =>
  client.get<{ year_month: string; items: ScheduleSlot[] }>('/schedule/slots', { params: { year_month: yearMonth } })
    .then(r => r.data)

export const createSlot = (data: { user_id: number; date: string; shift_id: number }) =>
  client.post<ScheduleSlot>('/schedule/slots', data).then(r => r.data)

export const batchCreateSlots = (data: { user_ids: number[]; date: string; shift_id: number }) =>
  client.post('/schedule/slots/batch', data).then(r => r.data)

export const batchRangeCreateSlots = (data: { user_id: number; start_date: string; end_date: string; shift_id: number }) =>
  client.post('/schedule/slots/batch-range', data).then(r => r.data)

export const deleteSlot = (id: number) =>
  client.delete(`/schedule/slots/${id}`).then(r => r.data)

// ── 换班申请 ──────────────────────────────────────────────────────
export const getSwapRequests = (status?: string) =>
  client.get<{ items: ShiftSwapRequest[] }>('/schedule/swaps', { params: status ? { status } : {} })
    .then(r => r.data)

export const createSwapRequest = (data: { target_user_id: number; applicant_date: string; target_date: string; reason?: string }) =>
  client.post<ShiftSwapRequest>('/schedule/swaps', data).then(r => r.data)

export const actionSwapRequest = (id: number, action: 'approve' | 'reject', comment?: string) =>
  client.put<ShiftSwapRequest>(`/schedule/swaps/${id}/action`, { action, comment: comment || '' }).then(r => r.data)

export const cancelSwapRequest = (id: number) =>
  client.put<ShiftSwapRequest>(`/schedule/swaps/${id}/cancel`).then(r => r.data)
