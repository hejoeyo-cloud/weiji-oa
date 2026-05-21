import client from './client'
import type { User } from '../types'

export function createUser(data: { username: string; password: string; name: string; note: string; role: string; department_id?: number; is_manager?: boolean }) {
  return client.post<User>('/users', data)
}

export function getUsers() {
  return client.get<User[]>('/users')
}

export function updateUser(id: number, data: Partial<{ username: string; name: string; note: string; role: string; department_id: number; password: string; is_manager?: boolean }>) {
  return client.put<User>(`/users/${id}`, data)
}

export function deleteUser(id: number) {
  return client.delete(`/users/${id}`)
}
