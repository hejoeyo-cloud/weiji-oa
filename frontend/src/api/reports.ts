import client from './client'
import type { DashboardStats, OverviewData, ShippingData, AftersalesData, FinanceData, ShopData } from '../types'

export function getDashboardStats() {
  return client.get<DashboardStats>('/reports/dashboard-stats').then(r => r.data)
}

export function getReportOverview(year: number, month?: number) {
  return client.get<OverviewData>('/reports/overview', { params: { year, month } }).then(r => r.data)
}

export function getReportShipping(year: number, month?: number) {
  return client.get<ShippingData>('/reports/shipping', { params: { year, month } }).then(r => r.data)
}

export function getReportAftersales(year: number, month?: number) {
  return client.get<AftersalesData>('/reports/aftersales', { params: { year, month } }).then(r => r.data)
}

export function getReportFinance(year: number, month?: number) {
  return client.get<FinanceData>('/reports/finance', { params: { year, month } }).then(r => r.data)
}

export function getReportShop(year: number, month?: number) {
  return client.get<ShopData>('/reports/shop', { params: { year, month } }).then(r => r.data)
}
