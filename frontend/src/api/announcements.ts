import client from './client'
import { Announcement } from '../types'

export const getAnnouncements = (params: { page?: number; page_size?: number; active_only?: boolean } = {}) =>
  client.get<{ total: number; items: Announcement[] }>('/announcements', { params }).then(r => r.data)

export const getAnnouncement = (id: number) =>
  client.get<Announcement>(`/announcements/${id}`).then(r => r.data)

export const createAnnouncement = (data: { title: string; content: string; is_pinned?: boolean }) =>
  client.post<Announcement>('/announcements', data).then(r => r.data)

export const updateAnnouncement = (id: number, data: Partial<{ title: string; content: string; is_pinned: boolean; is_active: boolean }>) =>
  client.put<Announcement>(`/announcements/${id}`, data).then(r => r.data)

export const deleteAnnouncement = (id: number) =>
  client.delete(`/announcements/${id}`).then(r => r.data)

export const markAnnouncementRead = (id: number) =>
  client.post(`/announcements/${id}/read`).then(r => r.data)

export const getUnreadAnnouncementCount = () =>
  client.get<{ unread_count: number }>('/announcements/unread/count').then(r => r.data)
