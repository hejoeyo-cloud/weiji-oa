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

export function getTodayShift() {
  return client.get('/attendance/today-shift').then(r => r.data)
}

export function getAttendanceRecords(month = '', departmentId = 0, userId = 0, all = false) {
  const params: any = { month }
  if (departmentId) params.department_id = departmentId
  if (userId) params.user_id = userId
  if (all) params.all = true
  return client.get<AttendanceRecord[]>('/attendance/records', { params }).then(r => r.data)
}

export function getMonthlyStats(month = '', departmentId = 0, userId = 0) {
  const params: any = { month }
  if (departmentId) params.department_id = departmentId
  if (userId) params.user_id = userId
  return client.get<MonthlyAttendanceStats>('/attendance/stats', { params }).then(r => r.data)
}

export function getAttendanceDepartments() {
  return client.get<{ id: number; name: string }[]>('/attendance/departments').then(r => r.data)
}
