import client from './client'
import type { Ticket, TicketFeedback } from '../types'

export function createTicket(data: any) {
  return client.post<Ticket>('/tickets', data)
}

export function getTickets(params: any = {}) {
  return client.get('/tickets', { params })
}

export function getTicket(id: number) {
  return client.get<Ticket>(`/tickets/${id}`)
}

export function updateTicket(id: number, data: any) {
  return client.put<Ticket>(`/tickets/${id}`, data)
}

export function addFeedback(ticketId: number, content: string, feedbackType: string = 'progress') {
  return client.post<TicketFeedback>(`/tickets/${ticketId}/feedback`, {
    content,
    feedback_type: feedbackType,
  })
}

export function deleteTicket(id: number) {
  return client.delete(`/tickets/${id}`)
}
