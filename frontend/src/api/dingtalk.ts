import client from './client'
import type { DingtalkConfig } from '../types'

export function getDingtalkConfig() {
  return client.get<DingtalkConfig | null>('/dingtalk/config').then(r => r.data)
}

export function saveDingtalkConfig(data: { app_key?: string; app_secret?: string; enabled?: boolean }) {
  return client.put<DingtalkConfig>('/dingtalk/config', data).then(r => r.data)
}

export function syncDingtalk() {
  return client.post<{ synced: number; skipped: number; errors: string[] }>('/dingtalk/sync').then(r => r.data)
}

export function bindDingtalkUser(dingtalk_user_id: string) {
  return client.put<{ ok: boolean }>('/dingtalk/bind', { dingtalk_user_id }).then(r => r.data)
}
