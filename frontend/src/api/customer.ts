import client from './client'

export interface CustomerProfile {
  customer_id: string
  ticket_count: number
  repair_count: number
  return_count: number
  exchange_count: number
  recent_tickets: { id: number; status: string; description: string; created_at?: string }[]
  recent_repairs: { id: number; model: string; repair_status: string; apply_date: string }[]
  recent_returns: { id: number; model: string; record_type: string; progress: string; apply_date: string }[]
}

export function getCustomerProfile(customerId: string) {
  return client.get<CustomerProfile>(`/customers/${encodeURIComponent(customerId)}/profile`)
}
