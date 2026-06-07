import client from './client'
import type { User } from '../types'

export function login(email: string, password: string, remember_me = false) {
  return client.post<{ token: string; user: User }>('/auth/login', { email, password, remember_me })
}

export function getMe() {
  return client.get<User>('/auth/me')
}
