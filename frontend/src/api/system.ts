import client from './client'

export interface SystemStatus {
  version: string
  release_date: string
  server_time: string
  auto_update_enabled: boolean
  auto_update_interval_hours: number
}

export interface UpdateCheckResult {
  has_update: boolean
  current_version: string
  latest_version: string
  changelog: string
  release_date: string
  download_url: string
  sha256: string
  source: string
}

export const getSystemStatus = () =>
  client.get<SystemStatus>('/system/status').then(r => r.data)

export const checkUpdate = () =>
  client.get<UpdateCheckResult>('/system/check-update').then(r => r.data)

export const applyUpdate = (downloadUrl: string, sha256: string) =>
  client.post<{ status: string; message: string }>('/system/apply-update', {
    download_url: downloadUrl,
    sha256,
  }).then(r => r.data)
