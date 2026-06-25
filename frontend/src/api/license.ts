import client from './client'

export interface LicenseStatus {
  valid: boolean
  status: 'valid' | 'expiring' | 'expired' | 'locked' | 'dev' | 'no_license'
  company: string
  expires_at: string
  days_remaining: number
  max_users: number
  modules: string[]
  message: string
}

export function getLicenseStatus() {
  return client.get<LicenseStatus>('/license/status').then(r => r.data)
}

export function getFingerprint() {
  return client.get<{ fingerprint: string }>('/license/fingerprint').then(r => r.data)
}
