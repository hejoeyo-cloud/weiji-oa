import client from './client'
import type { TaskItem } from '../types'

export function getTasks(status = '') {
  return client.get<TaskItem[]>('/tasks', { params: { status } }).then(r => r.data)
}

export function createTask(data: { title: string; description?: string; priority?: string; assignee_id?: number; due_date?: string }) {
  return client.post<TaskItem>('/tasks', data).then(r => r.data)
}

export function updateTask(id: number, data: { title?: string; description?: string; status?: string; priority?: string; assignee_id?: number; due_date?: string; sort_order?: number }) {
  return client.put<TaskItem>(`/tasks/${id}`, data).then(r => r.data)
}

export function deleteTask(id: number) {
  return client.delete(`/tasks/${id}`).then(r => r.data)
}

export function getTaskStats() {
  return client.get<{ total_tasks: number; pending_tasks: number }>('/tasks/stats').then(r => r.data)
}
