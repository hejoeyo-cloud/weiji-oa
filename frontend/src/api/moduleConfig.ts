import client from './client'
import type { ModuleConfigItem, FieldLabel } from '../types'

export function getModuleConfigs() {
  return client.get<ModuleConfigItem[]>('/module-config').then(r => r.data)
}

export function updateModuleConfigs(reqs: { module_key: string; enabled?: boolean; display_name?: string }[]) {
  return client.put<{ ok: boolean }>('/module-config', reqs).then(r => r.data)
}

export function getFieldLabels(moduleKey: string) {
  return client.get<FieldLabel[]>('/module-config/fields', { params: { module_key: moduleKey } }).then(r => r.data)
}

export function setFieldLabel(data: { module_key: string; field_name: string; label: string }) {
  return client.post<FieldLabel>('/module-config/fields', data).then(r => r.data)
}

export function deleteFieldLabel(id: number) {
  return client.delete(`/module-config/fields/${id}`).then(r => r.data)
}
