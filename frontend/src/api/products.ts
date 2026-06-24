import client from './client'
import type { Product } from '../types'

export interface ProductListParams {
  page?: number
  page_size?: number
  search?: string
  status?: string
  all?: boolean
}

export interface ProductCreateData {
  name: string
  model_number?: string
  images?: string[]
  cpu?: string
  ram?: string
  ram_freq?: string
  storage?: string
  display?: string
  gpu?: string
  ports?: string[]
  battery?: string
  weight?: string
  description?: string
  status?: string
}

export const getProductList = (params: ProductListParams) =>
  client.get<{ total: number; items: Product[]; page: number; page_size: number }>('/products', { params }).then(r => r.data)

export const getProductDetail = (id: number) =>
  client.get<Product>(`/products/${id}`).then(r => r.data)

export const createProduct = (data: ProductCreateData) =>
  client.post<Product>('/products', data).then(r => r.data)

export const updateProduct = (id: number, data: Partial<ProductCreateData>) =>
  client.put<Product>(`/products/${id}`, data).then(r => r.data)

export const deleteProduct = (id: number) =>
  client.delete(`/products/${id}`).then(r => r.data)
