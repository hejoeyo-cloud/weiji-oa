import client from './client'
import type { ApprovalRule } from '../types'

export function getRules() {
  return client.get<ApprovalRule[]>('/approval-rules').then(r => r.data)
}

export function createRule(data: {
  name: string; target_module: string; condition_field: string
  condition_op: string; condition_value: string; sign_mode: string
  approver_ids: string; enabled: boolean; sort_order: number
}) {
  return client.post<ApprovalRule>('/approval-rules', data).then(r => r.data)
}

export function updateRule(id: number, data: any) {
  return client.put<ApprovalRule>(`/approval-rules/${id}`, data).then(r => r.data)
}

export function deleteRule(id: number) {
  return client.delete(`/approval-rules/${id}`)
}
