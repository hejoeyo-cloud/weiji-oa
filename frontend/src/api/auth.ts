import client from './client'
import type { User } from '../types'

export function login(username: string, password: string) {
  return client.post<{ token: string; user: User }>('/auth/login', { username, password })
}

export function register(data: { company_name: string; username: string; password: string; name: string }) {
  return client.post<{ token: string; user: User }>('/auth/register', data)
}

export function getMe() {
  return client.get<User>('/auth/me')
}
