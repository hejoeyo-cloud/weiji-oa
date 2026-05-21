import client from './client'
import type { Company, PaymentOrder } from '../types'

export function getCompanies() {
  return client.get<Company[]>('/platform/companies').then(r => r.data)
}

export function updateCompanySubscription(companyId: number, data: { status?: string; extend_days?: number }) {
  return client.put<Company>(`/platform/companies/${companyId}/subscription`, data).then(r => r.data)
}

export function getPlatformOrders() {
  return client.get<PaymentOrder[]>('/platform/orders').then(r => r.data)
}
