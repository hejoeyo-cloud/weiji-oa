import client from './client'
import { Department } from '../types'

export const getDepartments = () =>
  client.get<Department[]>('/departments').then(r => r.data)

export const createDepartment = (data: { name: string; description?: string; sort_order?: number }) =>
  client.post<Department>('/departments', data).then(r => r.data)

export const updateDepartment = (id: number, data: { name: string; description?: string; sort_order?: number }) =>
  client.put<Department>(`/departments/${id}`, data).then(r => r.data)

export const deleteDepartment = (id: number) =>
  client.delete(`/departments/${id}`).then(r => r.data)
