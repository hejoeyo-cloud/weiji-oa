import client from './client'
import type { AttendanceRecord, MonthlyAttendanceStats } from '../types'

export function checkIn(location = '', remark = '') {
  return client.post<AttendanceRecord>('/attendance/check-in', { location, remark })
}

export function checkOut() {
  return client.post<AttendanceRecord>('/attendance/check-out')
}

export function getTodayAttendance() {
  return client.get<AttendanceRecord | null>('/attendance/today').then(r => r.data)
}

export function getAttendanceRecords(month = '') {
  return client.get<AttendanceRecord[]>('/attendance/records', { params: { month } }).then(r => r.data)
}

export function getMonthlyStats(month = '') {
  return client.get<MonthlyAttendanceStats>('/attendance/stats', { params: { month } }).then(r => r.data)
}
