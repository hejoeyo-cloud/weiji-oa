import client from './client'
import type { Notification } from '../types'

export function getNotifications(params: any = {}) {
  return client.get('/notifications', { params })
}

export function getUnreadCount() {
  return client.get<{ count: number }>('/notifications/unread-count')
}

export function markNotificationRead(id: number) {
  return client.put(`/notifications/${id}/read`)
}

export function markAllNotificationsRead() {
  return client.put('/notifications/read-all')
}
