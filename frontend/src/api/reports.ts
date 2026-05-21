import client from './client'
import type { DashboardStats } from '../types'

export function getDashboardStats() {
  return client.get<DashboardStats>('/reports/dashboard-stats').then(r => r.data)
}
