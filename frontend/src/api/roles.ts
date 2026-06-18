import client from './client'

export interface RoleCreateParams {
  name: string
  label: string
  color?: string
  permissions?: string[]
  bound_shops?: number[]
}

export interface RoleUpdateParams {
  label?: string
  color?: string
  permissions?: string[]
  bound_shops?: number[]
}

export async function getRoles() {
  const res = await client.get('/roles')
  return res.data as { id: number; name: string; label: string; color: string; permissions: string[]; bound_shops: number[]; is_builtin: boolean; sort_order: number; user_count: number }[]
}

export async function getAllPermissions() {
  const res = await client.get('/roles/permissions')
  return res.data as { permissions: string[]; groups: { key: string; label: string; perms: string[] }[] }
}

export async function createRole(data: RoleCreateParams) {
  const res = await client.post('/roles', data)
  return res.data
}

export async function updateRole(id: number, data: RoleUpdateParams) {
  const res = await client.put(`/roles/${id}`, data)
  return res.data
}

export async function deleteRole(id: number) {
  const res = await client.delete(`/roles/${id}`)
  return res.data
}
