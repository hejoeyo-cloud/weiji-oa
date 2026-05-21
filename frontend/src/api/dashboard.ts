import client from './client'
import type { DashboardResponse } from '../types'

export const getDashboard = (params: { year_month?: string } = {}) =>
  client.get<DashboardResponse>('/dashboard', { params }).then(r => r.data)
