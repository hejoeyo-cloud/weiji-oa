import client from './client'

export interface SidebarBadges {
  pending_my_approval: number
  pending_tasks: number
  unread_messages: number
  pending_tickets: number
  pending_delivery: number
  pending_return_exchange: number
  pending_repair: number
  pending_finance: number
  pending_schedule: number
}

export const getSidebarBadges = () =>
  client.get<SidebarBadges>('/api/sidebar-badges').then(r => r.data)
