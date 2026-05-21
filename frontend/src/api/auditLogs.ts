import client from './client'
import { AuditLog } from '../types'

export interface AuditLogParams {
  page?: number
  page_size?: number
  resource_type?: string
  action?: string
  username?: string
}

export const getAuditLogs = (params: AuditLogParams = {}) =>
  client.get<{ total: number; items: AuditLog[]; page: number; page_size: number }>(
    '/audit-logs', { params }
  ).then(r => r.data)
