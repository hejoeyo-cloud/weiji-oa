import client from './client'
import type { Message } from '../types'

export function getInbox(q?: string, starred?: boolean) {
  return client.get<Message[]>('/messages/inbox', { params: { q: q || undefined, starred: starred || undefined } }).then(r => r.data)
}
export function getSent() { return client.get<Message[]>('/messages/sent').then(r => r.data) }
export function getDrafts() { return client.get<Message[]>('/messages/drafts').then(r => r.data) }
export function getTrash() { return client.get<Message[]>('/messages/trash').then(r => r.data) }
export function getCounts() { return client.get<Record<string,number>>('/messages/counts').then(r => r.data) }

export function sendMessage(data: { recipient_id: number; subject: string; content: string; thread_id?: number }) {
  return client.post<Message>('/messages', data).then(r => r.data)
}
export function saveDraft(data: { recipient_id: number; subject: string; content: string }) {
  return client.post<Message>('/messages/draft', data).then(r => r.data)
}
export function replyMessage(msgId: number, data: { recipient_id: number; subject: string; content: string }) {
  return client.post<Message>(`/messages/${msgId}/reply`, data).then(r => r.data)
}
export function forwardMessage(msgId: number, data: { recipient_id: number; subject: string; content: string }) {
  return client.post<Message>(`/messages/${msgId}/forward`, data).then(r => r.data)
}
export function toggleStar(msgId: number) {
  return client.put<{ is_starred: boolean }>(`/messages/${msgId}/star`).then(r => r.data)
}
export function softDelete(msgId: number) { return client.delete(`/messages/${msgId}`) }
export function restore(msgId: number) { return client.put(`/messages/${msgId}/restore`) }
export function permanentDelete(msgId: number) { return client.delete(`/messages/${msgId}/permanent`) }
export function markRead(id: number) { return client.put(`/messages/${id}/read`) }
export function getAttachments(msgId: number) {
  return client.get<{id:number;filename:string;size:number;mime_type:string}[]>(`/messages/attachments/${msgId}`).then(r=>r.data)
}

export function uploadAttachment(file: File, onProgress?: (pct: number) => void) {
  const fd = new FormData(); fd.append('file', file)
  return client.post('/messages/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress ? (e:any) => onProgress(Math.round((e.loaded/e.total)*100)) : undefined
  }).then(r => r.data)
}
