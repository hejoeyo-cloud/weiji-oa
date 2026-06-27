import client from './client'
import type { DashboardStats, OverviewData, ShippingData, AftersalesData, FinanceData, ShopData, RepairEfficiencyData, ProductIssueData } from '../types'

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

export function getReportRepairEfficiency(year: number, month?: number) {
  return client.get<RepairEfficiencyData>('/reports/repair-efficiency', { params: { year, month } }).then(r => r.data)
}

export function getReportProductIssues(year: number, month?: number) {
  return client.get<ProductIssueData>('/reports/product-issues', { params: { year, month } }).then(r => r.data)
}
