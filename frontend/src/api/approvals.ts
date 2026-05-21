import client from './client'
import { ApprovalRequest } from '../types'

export interface ApprovalListParams {
  page?: number
  page_size?: number
  type?: string
  status?: string
  mine?: boolean
  pending_my_approval?: boolean
}

export interface ApprovalCreateData {
  type: string
  title: string
  description?: string
  amount?: number
  start_date?: string
  end_date?: string
  attachments?: string[]
  approver_ids: number[]
}

export const getApprovals = (params: ApprovalListParams = {}) =>
  client.get<{ total: number; items: ApprovalRequest[]; page: number; page_size: number }>(
    '/approvals', { params }
  ).then(r => r.data)

export const getApproval = (id: number) =>
  client.get<ApprovalRequest>(`/approvals/${id}`).then(r => r.data)

export const createApproval = (data: ApprovalCreateData) =>
  client.post<ApprovalRequest>('/approvals', data).then(r => r.data)

export const handleApproval = (id: number, data: { action: string; comment?: string }) =>
  client.post<ApprovalRequest>(`/approvals/${id}/action`, data).then(r => r.data)

export const cancelApproval = (id: number) =>
  client.delete(`/approvals/${id}`).then(r => r.data)

/** 审批专用：获取所有用户基本信息（不限制角色） */
export const getApprovalUsers = () =>
  client.get<{ id: number; name: string; role: string }[]>('/approvals/users').then(r => r.data)
