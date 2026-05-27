import client from './client'
import type { ModuleConfigItem, FieldLabel } from '../types'

export function getModuleConfigs() {
  return client.get<ModuleConfigItem[]>('/module-config').then(r => r.data)
}

export function getModuleRegistry() {
  return client.get<{ modules: Record<string, any> }>('/module-config/registry').then(r => r.data)
}

export function updateModuleConfigs(reqs: { module_key: string; enabled?: boolean; display_name?: string; sort_order?: number; icon?: string; route_path?: string; navigation_group?: string; permissions?: string; fields_schema?: string }[]) {
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
