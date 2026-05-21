import client from './client'
import type { PaymentOrder, SubscriptionInfo } from '../types'

export function getSubscription() {
  return client.get<SubscriptionInfo>('/billing/subscription').then(r => r.data)
}

export function getBillingOrders() {
  return client.get<PaymentOrder[]>('/billing/orders').then(r => r.data)
}

export function createBillingOrder(years = 1) {
  return client.post<{ order: PaymentOrder; pay_url: string; configured: boolean }>('/billing/orders', { years }).then(r => r.data)
}

export function devMarkOrderPaid(orderId: number) {
  return client.post<PaymentOrder>(`/billing/orders/${orderId}/dev-mark-paid`).then(r => r.data)
}
