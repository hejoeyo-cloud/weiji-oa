import client from './client'
import type { Message } from '../types'

export function getInbox() {
  return client.get<Message[]>('/messages/inbox').then(r => r.data)
}

export function getSent() {
  return client.get<Message[]>('/messages/sent').then(r => r.data)
}

export function getDrafts() {
  return client.get<Message[]>('/messages/drafts').then(r => r.data)
}

export function sendMessage(data: { recipient_id: number; subject: string; content: string }) {
  return client.post<Message>('/messages', data).then(r => r.data)
}

export function saveDraft(data: { recipient_id: number; subject: string; content: string }) {
  return client.post<Message>('/messages/draft', data).then(r => r.data)
}

export function markRead(id: number) {
  return client.put(`/messages/read/${id}`)
}

export function getUnreadCount() {
  return client.get<{ count: number }>('/messages/unread-count').then(r => r.data)
}
