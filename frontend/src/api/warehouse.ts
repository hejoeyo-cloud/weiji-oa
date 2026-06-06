import client from './client'
import type { WarehouseProduct, WarehouseInbound, WarehouseOutbound, WarehouseStats, WarehouseInboundFeedback, WarehouseOutboundFeedback, WarehouseReturnToFactory, WarehouseReturnToFactoryFeedback } from '../types'

// ── 货品管理 ──────────────────────────────────────────────────────────

export interface ProductListParams {
  page?: number
  page_size?: number
  search?: string
  category?: string
  all?: boolean
}

export interface ProductCreateData {
  code: string
  category?: string
  name: string
  spec?: string
  location?: string
  initial_qty?: number
  unit?: string
  remark?: string
}

export const getProductList = (params: ProductListParams = {}) =>
  client.get<{ total: number; items: WarehouseProduct[]; page: number; page_size: number }>(
    '/warehouse/products', { params }
  ).then(r => r.data)

export const getProduct = (id: number) =>
  client.get<WarehouseProduct>(`/warehouse/products/${id}`).then(r => r.data)

export const createProduct = (data: ProductCreateData) =>
  client.post<WarehouseProduct>('/warehouse/products', data).then(r => r.data)

export const updateProduct = (id: number, data: Partial<ProductCreateData>) =>
  client.put<WarehouseProduct>(`/warehouse/products/${id}`, data).then(r => r.data)

export const deleteProduct = (id: number) =>
  client.delete(`/warehouse/products/${id}`).then(r => r.data)


// ── 入库管理 ──────────────────────────────────────────────────────────

export interface InboundListParams {
  page?: number
  page_size?: number
  search?: string
  product_id?: number
  start_date?: string
  end_date?: string
  all?: boolean
}

export interface InboundCreateData {
  date?: string
  product_id: number
  quantity: number
  operator?: string
  remark?: string
}

export const getInboundList = (params: InboundListParams = {}) =>
  client.get<{ total: number; items: WarehouseInbound[]; page: number; page_size: number }>(
    '/warehouse/inbound', { params }
  ).then(r => r.data)

export const createInbound = (data: InboundCreateData) =>
  client.post<WarehouseInbound>('/warehouse/inbound', data).then(r => r.data)

export const updateInbound = (id: number, data: Partial<Omit<InboundCreateData, 'product_id'>>) =>
  client.put<WarehouseInbound>(`/warehouse/inbound/${id}`, data).then(r => r.data)

export const deleteInbound = (id: number) =>
  client.delete(`/warehouse/inbound/${id}`).then(r => r.data)


// ── 出库管理 ──────────────────────────────────────────────────────────

export interface OutboundListParams {
  page?: number
  page_size?: number
  search?: string
  product_id?: number
  start_date?: string
  end_date?: string
  all?: boolean
}

export interface OutboundCreateData {
  date?: string
  product_id: number
  quantity: number
  operator?: string
  remark?: string
}

export const getOutboundList = (params: OutboundListParams = {}) =>
  client.get<{ total: number; items: WarehouseOutbound[]; page: number; page_size: number }>(
    '/warehouse/outbound', { params }
  ).then(r => r.data)

export const createOutbound = (data: OutboundCreateData) =>
  client.post<WarehouseOutbound>('/warehouse/outbound', data).then(r => r.data)

export const updateOutbound = (id: number, data: Partial<Omit<OutboundCreateData, 'product_id'>>) =>
  client.put<WarehouseOutbound>(`/warehouse/outbound/${id}`, data).then(r => r.data)

export const deleteOutbound = (id: number) =>
  client.delete(`/warehouse/outbound/${id}`).then(r => r.data)


// ── 库存统计 ──────────────────────────────────────────────────────────

export const getWarehouseStats = () =>
  client.get<WarehouseStats>('/warehouse/stats').then(r => r.data)


// ── 入库处理记录 ──────────────────────────────────────────────────────

export const getInboundFeedbacks = (recordId: number) =>
  client.get<WarehouseInboundFeedback[]>(`/warehouse/inbound/${recordId}/feedbacks`).then(r => r.data)

export const addInboundFeedback = (recordId: number, content: string) =>
  client.post<WarehouseInboundFeedback>(`/warehouse/inbound/${recordId}/feedback`, { content }).then(r => r.data)


// ── 出库处理记录 ──────────────────────────────────────────────────────

export const getOutboundFeedbacks = (recordId: number) =>
  client.get<WarehouseOutboundFeedback[]>(`/warehouse/outbound/${recordId}/feedbacks`).then(r => r.data)

export const addOutboundFeedback = (recordId: number, content: string) =>
  client.post<WarehouseOutboundFeedback>(`/warehouse/outbound/${recordId}/feedback`, { content }).then(r => r.data)


// ── 返厂出库 ────────────────────────────────────────────────────────

export interface ReturnToFactoryListParams {
  page?: number
  page_size?: number
  search?: string
  status?: string
  start_date?: string
  end_date?: string
}

export interface ReturnToFactoryCreateData {
  date: string
  product_id: number
  quantity: number
  reason: string
  operator?: string
  remark?: string
}

export const getReturnToFactoryList = (params: ReturnToFactoryListParams = {}) =>
  client.get<{ total: number; items: WarehouseReturnToFactory[]; page: number; page_size: number }>(
    '/warehouse/return-to-factory', { params }
  ).then(r => r.data)

export const createReturnToFactory = (data: ReturnToFactoryCreateData) =>
  client.post<WarehouseReturnToFactory>('/warehouse/return-to-factory', data).then(r => r.data)

export const updateReturnToFactory = (id: number, data: Partial<ReturnToFactoryCreateData & { status: string }>) =>
  client.put<WarehouseReturnToFactory>(`/warehouse/return-to-factory/${id}`, data).then(r => r.data)

export const deleteReturnToFactory = (id: number) =>
  client.delete(`/warehouse/return-to-factory/${id}`).then(r => r.data)

export const getReturnToFactoryFeedbacks = (recordId: number) =>
  client.get<WarehouseReturnToFactoryFeedback[]>(`/warehouse/return-to-factory/${recordId}/feedbacks`).then(r => r.data)

export const addReturnToFactoryFeedback = (recordId: number, content: string) =>
  client.post<WarehouseReturnToFactoryFeedback>(`/warehouse/return-to-factory/${recordId}/feedback`, { content }).then(r => r.data)
