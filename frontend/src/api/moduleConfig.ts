import client from './client'
import type { ModuleConfigItem, ModuleFieldConfig } from '../types'

export function getModuleConfigs() {
  return client.get<ModuleConfigItem[]>('/module-config').then(r => r.data)
}

export function updateModuleConfigs(reqs: { module_key: string; enabled?: boolean; display_name?: string }[]) {
  return client.put<{ ok: boolean }>('/module-config', reqs).then(r => r.data)
}

export function getModuleFieldConfigs(moduleKey: string) {
  return client.get<ModuleFieldConfig[]>('/module-config/fields', { params: { module_key: moduleKey } }).then(r => r.data)
}

export function createModuleField(data: { module_key: string; field_key?: string; field_label: string; field_type: string; field_options?: string; required?: boolean }) {
  return client.post<ModuleFieldConfig>('/module-config/fields', data).then(r => r.data)
}

export function updateModuleField(id: number, data: { module_key: string; field_label: string; field_type: string; field_options?: string; required?: boolean }) {
  return client.put<ModuleFieldConfig>(`/module-config/fields/${id}`, data).then(r => r.data)
}

export function deleteModuleField(id: number) {
  return client.delete(`/module-config/fields/${id}`).then(r => r.data)
}
