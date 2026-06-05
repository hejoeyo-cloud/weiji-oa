import client from './client'

export interface Shop {
  id: number
  name: string
  created_at?: string
}

export const getShops = () =>
  client.get<Shop[]>('/shops').then(r => r.data)

export const createShop = (data: { name: string }) =>
  client.post<Shop>('/shops', data).then(r => r.data)

export const updateShop = (id: number, data: { name: string }) =>
  client.put<Shop>(`/shops/${id}`, data).then(r => r.data)

export const deleteShop = (id: number) =>
  client.delete(`/shops/${id}`).then(r => r.data)
