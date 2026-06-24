import { useEffect, useState, useCallback } from 'react'
import { Clock, LogIn, LogOut, CheckCircle, AlertTriangle, CalendarCheck2, Save, RefreshCw, ExternalLink, Settings, Download, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react'
import { checkIn, checkOut, getTodayAttendance, getTodayShift, getAttendanceRecords, getMonthlyStats, getAttendanceDepartments } from '../api/attendance'
import { getDingtalkConfig, saveDingtalkConfig, syncDingtalk } from '../api/dingtalk'
import { useAuth } from '../hooks/useAuth'
import type { AttendanceRecord, MonthlyAttendanceStats, DingtalkConfig } from '../types'
import * as XLSX from 'xlsx'

const STATUS_LABELS: Record<string, string> = {
  normal: '正常', late: '迟到', early: '早退', absent: '缺勤', no_shift: '无排班',
}
const STATUS_DOT: Record<string, string> = {
  normal: 'bg-green-500', late: 'bg-orange-500', early: 'bg-yellow-500', absent: 'bg-red-500', no_shift: 'bg-gray-300',
}
const STATUS_BADGE: Record<string, string> = {
  normal: 'text-green-700 bg-green-50', late: 'text-orange-700 bg-orange-50',
  early: 'text-yellow-700 bg-yellow-50', absent: 'text-red-700 bg-red-50',
  no_shift: 'text-gray-500 bg-gray-100',
}

function exportToExcel(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) { alert('暂无数据可导出'); return }
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, filename)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** 获取某月天数和第一天星期 */
function getMonthInfo(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  return { firstDay, daysInMonth }
}

export default function AttendancePage() {
  const { user, isAdmin, hasPermission } = useAuth()
  const isManager = user?.is_manager
  const canManage = hasPermission('attendance:manage')
  const isManagerView = isManager || canManage

  const [today, setToday] = useState<AttendanceRecord | null>(null)
  const [todayShift, setTodayShift] = useState<any>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [stats, setStats] = useState<MonthlyAttendanceStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [monthSelect, setMonthSelect] = useState(currentMonth)
  const [activeTab, setActiveTab] = useState<string>('daily')
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set())

  // 管理视图筛选
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([])
  const [filterDept, setFilterDept] = useState(0)
  const [filterUser, setFilterUser] = useState(0)

  // 钉钉配置
  const [dtConfig, setDtConfig] = useState<DingtalkConfig | null>(null)
  const [dtAppKey, setDtAppKey] = useState('')
  const [dtAppSecret, setDtAppSecret] = useState('')
  const [dtEnabled, setDtEnabled] = useState(false)
  const [dtSaving, setDtSaving] = useState(false)
  const [dtSyncing, setDtSyncing] = useState(false)
  const [dtSyncResult, setDtSyncResult] = useState('')
  const [dtMsg, setDtMsg] = useState('')
  const [showDtGuide, setShowDtGuide] = useState(false)

  const loadDtConfig = useCallback(async () => {
    try {
      const data = await getDingtalkConfig()
      setDtConfig(data)
      if (data) { setDtAppKey(data.app_key || ''); setDtEnabled(data.enabled) }
    } catch { /* ignore */ }
  }, [])

  const loadToday = useCallback(async () => {
    try {
      const [data, shift] = await Promise.all([getTodayAttendance(), getTodayShift()])
      setToday(data); setTodayShift(shift)
    } catch { /* ignore */ }
  }, [])

  const loadRecords = useCallback(async () => {
    try { const data = await getAttendanceRecords(currentMonth, filterDept, filterUser); setRecords(data) } catch { /* ignore */ }
  }, [currentMonth, filterDept, filterUser, isManagerView])

  const loadStats = useCallback(async () => {
    try { const data = await getMonthlyStats(currentMonth, filterDept, filterUser); setStats(data) } catch { /* ignore */ }
  }, [currentMonth, filterDept, filterUser, isManagerView])

  const loadDepartments = useCallback(async () => {
    if (!isManagerView) return
    try { const data = await getAttendanceDepartments(); setDepartments(data) } catch { /* ignore */ }
  }, [isManagerView])

  useEffect(() => { loadToday(); loadDtConfig(); loadDepartments() }, [loadToday, loadDtConfig, loadDepartments])
  useEffect(() => { loadRecords(); loadStats() }, [loadRecords, loadStats])

  const handleCheckIn = async () => {
    setLoading(true); setMsg('')
    try {
      const res = await checkIn()
      setToday(res.data); setMsg('签到成功！')
      loadRecords(); loadStats()
    } catch (err: any) {
      setMsg(err.response?.data?.detail || '签到失败')
    } finally { setLoading(false) }
  }

  const handleCheckOut = async () => {
    setLoading(true); setMsg('')
    try {
      const res = await checkOut()
      setToday(res.data); setMsg('签退成功！')
      loadRecords(); loadStats()
    } catch (err: any) {
      setMsg(err.response?.data?.detail || '签退失败')
    } finally { setLoading(false) }
  }

  const handleDtSave = async () => {
    setDtSaving(true); setDtMsg('')
    try {
      await saveDingtalkConfig({ app_key: dtAppKey, app_secret: dtAppSecret || undefined, enabled: dtEnabled })
      setDtMsg('保存成功'); setDtAppSecret(''); loadDtConfig()
    } catch (err: any) { setDtMsg(err.response?.data?.detail || '保存失败') } finally { setDtSaving(false) }
  }

  const handleDtSync = async () => {
    setDtSyncing(true); setDtSyncResult('')
    try {
      const res = await syncDingtalk()
      setDtSyncResult(`同步完成：新增 ${(res as any).synced || 0} 条，覆盖 ${(res as any).overwrote || 0} 条，跳过 ${(res as any).skipped || 0} 条`); loadDtConfig()
    } catch (err: any) {
      setDtSyncResult(err.response?.data?.detail || '同步失败')
    } finally { setDtSyncing(false) }
  }

  const handleExport = async () => {
    try {
      const data = await getAttendanceRecords(currentMonth, filterDept, filterUser, true)
      const rows = data.map(r => ({
        '姓名': r.user_name, '部门': r.department_name, '日期': r.date,
        '签到': r.check_in ? new Date(r.check_in).toLocaleTimeString('zh-CN') : '-',
        '签退': r.check_out ? new Date(r.check_out).toLocaleTimeString('zh-CN') : '-',
        '排班': r.scheduled_start && r.scheduled_end ? `${r.scheduled_start}-${r.scheduled_end}` : '-',
        '状态': STATUS_LABELS[r.status] || r.status,
        '来源': r.source === 'dingtalk' ? '钉钉' : '手动',
      }))
      exportToExcel('考勤记录', rows)
    } catch { alert('导出失败') }
  }

  const changeMonth = (delta: number) => {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setCurrentMonth(val); setMonthSelect(val)
  }

  // 每日视图：构建日期->记录映射
  const [year, month] = currentMonth.split('-').map(Number)
  const { firstDay, daysInMonth } = getMonthInfo(year, month)
  const recordMap = new Map<string, AttendanceRecord>()
  for (const r of records) recordMap.set(r.date, r)

  const todayStr = new Date().toISOString().slice(0, 10)

  // 月度统计：按人聚合 + 每日明细
  const userStats = new Map<number, { name: string; dept: string; total: number; normal: number; late: number; early: number; absent: number }>()
  const userDailyRecords = new Map<number, AttendanceRecord[]>()
  for (const r of records) {
    const existing = userStats.get(r.user_id)
    if (existing) {
      existing.total++
      if (r.status === 'normal') existing.normal++
      else if (r.status === 'late') existing.late++
      else if (r.status === 'early') existing.early++
      else if (r.status === 'absent') existing.absent++
    } else {
      userStats.set(r.user_id, {
        name: r.user_name, dept: r.department_name,
        total: 1, normal: r.status === 'normal' ? 1 : 0,
        late: r.status === 'late' ? 1 : 0, early: r.status === 'early' ? 1 : 0,
        absent: r.status === 'absent' ? 1 : 0,
      })
    }
    const daily = userDailyRecords.get(r.user_id)
    if (daily) daily.push(r)
    else userDailyRecords.set(r.user_id, [r])
  }
  // 按日期排序
  for (const arr of userDailyRecords.values()) arr.sort((a, b) => a.date.localeCompare(b.date))

  const toggleExpand = (userId: number) => {
    setExpandedUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  const tableColSpan = isManagerView ? 6 : 4

  const tabs = [
    { key: 'daily', label: '每日考勤' },
    { key: 'monthly', label: '月度统计' },
    { key: 'records', label: '考勤记录' },
  ] as { key: string; label: string }[]
  if (isAdmin) tabs.push({ key: 'dingtalk', label: '钉钉同步' })

  return (
    <div className="p-6 space-y-5">
      <h2 className="text-xl font-semibold text-gray-800">考勤打卡</h2>

      {/* 今日状态卡片 */}
      <div className="bg-white border rounded-2xl p-5 flex items-center gap-6" style={{ borderColor: '#f0f0f0' }}>
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-400">{dateStr}</p>
              <p className="text-2xl font-bold text-gray-800">{timeStr}</p>
            </div>
            {todayShift?.has_shift ? (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: '#f0f9ff', color: todayShift.color || '#1677FF' }}>
                <CalendarCheck2 size={12} />
                {todayShift.shift_name}（{todayShift.start_time}-{todayShift.end_time}）
                {todayShift.is_rest && <span className="text-orange-500 ml-1">休</span>}
              </div>
            ) : (
              <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">无排班</span>
            )}
          </div>
          {today && (
            <div className="flex gap-5 text-xs text-gray-500">
              <span>签到 <b className="text-gray-800">{today.check_in ? new Date(today.check_in).toLocaleTimeString('zh-CN') : '-'}</b></span>
              <span>签退 <b className="text-gray-800">{today.check_out ? new Date(today.check_out).toLocaleTimeString('zh-CN') : '-'}</b></span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[today.status] || ''}`}>{STATUS_LABELS[today.status] || today.status}</span>
            </div>
          )}
          {msg && (
            <div className={`text-xs mt-2 ${msg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{msg}</div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleCheckIn} disabled={loading || !!today?.check_in}
            className="px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed text-white"
            style={{ background: '#16a34a' }}><LogIn size={14} /> 签到</button>
          <button onClick={handleCheckOut} disabled={loading || !today?.check_in || !!today?.check_out}
            className="px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed text-white"
            style={{ background: '#dc2626' }}><LogOut size={14} /> 签退</button>
        </div>
      </div>

      {/* Tab + 月份切换 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 border-b" style={{ borderColor: '#f0f0f0' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`pb-2.5 text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === tab.key ? 'text-gray-900' : 'text-gray-400 border-transparent'
              }`} style={activeTab === tab.key ? { borderColor: '#404040' } : {}}>
              {tab.key === 'dingtalk' && <Settings size={13} />}
              {tab.key === 'monthly' && <BarChart3 size={13} />}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {isManagerView && departments.length > 1 && (
            <select value={filterDept} onChange={e => { setFilterDept(Number(e.target.value)); setFilterUser(0) }}
              className="px-2.5 py-1.5 border rounded-lg text-xs" style={{ borderColor: '#e5e5e5' }}>
              <option value={0}>全部部门</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1 bg-white border rounded-lg" style={{ borderColor: '#e5e5e5' }}>
            <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-gray-50 rounded-l-lg"><ChevronLeft size={14} /></button>
            <span className="text-xs font-medium px-2 min-w-[70px] text-center">{currentMonth}</span>
            <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-gray-50 rounded-r-lg"><ChevronRight size={14} /></button>
          </div>
          {canManage && (
            <button onClick={handleExport} className="p-1.5 border rounded-lg text-gray-500 hover:bg-gray-50" style={{ borderColor: '#e5e5e5' }} title="导出Excel">
              <Download size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tab: 每日考勤 - 日历视图 */}
      {activeTab === 'daily' && (
        <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
          {/* 星期头 */}
          <div className="grid grid-cols-7 bg-gray-50 text-xs text-gray-400 text-center">
            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
              <div key={d} className="py-2.5 font-medium">{d}</div>
            ))}
          </div>
          {/* 日期格子 */}
          <div className="grid grid-cols-7">
            {/* 前置空白 */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20 border-b border-r bg-gray-50/50" style={{ borderColor: '#f5f5f5' }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const rec = recordMap.get(dateStr)
              const isToday = dateStr === todayStr
              return (
                <div key={day} className={`h-20 border-b border-r p-1.5 ${isToday ? 'bg-blue-50/50' : ''}`} style={{ borderColor: '#f5f5f5' }}>
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>{day}</div>
                  {rec ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[rec.status] || 'bg-gray-300'}`} />
                        <span className="text-xs text-gray-700">{rec.check_in ? new Date(rec.check_in).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                      </div>
                      {rec.check_out && (
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                          <span className="text-xs text-gray-400">{new Date(rec.check_out).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                      {rec.scheduled_start && rec.scheduled_end && (
                        <div className="text-xs text-gray-300">{rec.scheduled_start}-{rec.scheduled_end}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-200 mt-2">-</div>
                  )}
                </div>
              )
            })}
          </div>
          {/* 图例 */}
          <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 text-xs text-gray-400">
            {[
              { label: '正常', color: 'bg-green-500' },
              { label: '迟到', color: 'bg-orange-500' },
              { label: '早退', color: 'bg-yellow-500' },
              { label: '缺勤', color: 'bg-red-500' },
              { label: '无排班', color: 'bg-gray-300' },
            ].map(item => (
              <span key={item.label} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${item.color}`} />{item.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Tab: 月度统计 */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          {/* 本月概览卡片 */}
          {stats && (
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: '出勤', value: stats.total_days, color: '#3b82f6' },
                { label: '正常', value: stats.normal_days, color: '#22c55e' },
                { label: '迟到', value: stats.late_days, color: '#f97316' },
                { label: '早退', value: stats.early_days, color: '#eab308' },
                { label: '缺勤', value: stats.absent_days, color: '#ef4444' },
              ].map(item => (
                <div key={item.label} className="bg-white border rounded-xl p-4 text-center" style={{ borderColor: '#f0f0f0' }}>
                  <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* 按人统计表格 */}
          <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="w-8 px-2 py-3"></th>
                  {isManagerView && <th className="px-4 py-3 text-left font-medium">姓名</th>}
                  {isManagerView && <th className="px-4 py-3 text-left font-medium">部门</th>}
                  <th className="px-4 py-3 text-center font-medium">出勤</th>
                  <th className="px-4 py-3 text-center font-medium">正常</th>
                  <th className="px-4 py-3 text-center font-medium">迟到</th>
                  <th className="px-4 py-3 text-center font-medium">早退</th>
                  <th className="px-4 py-3 text-center font-medium">缺勤</th>
                  <th className="px-4 py-3 text-center font-medium">出勤率</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(userStats.entries()).map(([userId, s]) => {
                  const isExpanded = expandedUsers.has(userId)
                  const dailyRecs = userDailyRecords.get(userId) || []
                  return (
                    <>
                      <tr key={userId} className="hover:bg-gray-50 cursor-pointer border-b" onClick={() => toggleExpand(userId)}>
                        <td className="px-2 py-3 text-center text-gray-400">
                          <ChevronRight size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </td>
                        {isManagerView && <td className="px-4 py-3 font-medium">{s.name}</td>}
                        {isManagerView && <td className="px-4 py-3 text-gray-500">{s.dept || '-'}</td>}
                        <td className="px-4 py-3 text-center font-medium">{s.total}</td>
                        <td className="px-4 py-3 text-center text-green-600">{s.normal}</td>
                        <td className="px-4 py-3 text-center text-orange-600">{s.late}</td>
                        <td className="px-4 py-3 text-center text-yellow-600">{s.early}</td>
                        <td className="px-4 py-3 text-center text-red-600">{s.absent}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${s.total > 0 ? Math.round((s.normal + s.early) / s.total * 100) : 0}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{s.total > 0 ? Math.round((s.normal + s.early) / s.total * 100) : 0}%</span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${userId}-detail`}>
                          <td colSpan={isManagerView ? 9 : 7} className="bg-gray-50/50 p-0">
                            <div className="px-6 py-3">
                              <div className="grid grid-cols-7 gap-1.5">
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                  const day = i + 1
                                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                  const rec = dailyRecs.find(r => r.date === dateStr)
                                  const isToday = dateStr === todayStr
                                  const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date(year, month - 1, day).getDay()]
                                  return (
                                    <div key={day} className={`rounded-lg p-1.5 text-center ${isToday ? 'ring-1 ring-blue-300 bg-blue-50' : rec ? 'bg-white border border-gray-100' : 'bg-gray-50'}`}>
                                      <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>{day} <span className="font-normal opacity-60">{weekday}</span></div>
                                      {rec ? (
                                        <>
                                          <div className={`w-2 h-2 rounded-full mx-auto my-0.5 ${STATUS_DOT[rec.status] || 'bg-gray-300'}`} />
                                          <div className="text-xs text-gray-600">{rec.check_in ? new Date(rec.check_in).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                                          {rec.check_out && <div className="text-xs text-gray-400">{new Date(rec.check_out).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>}
                                        </>
                                      ) : (
                                        <div className="text-xs text-gray-200 my-1">-</div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
                {userStats.size === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">暂无数据</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: 考勤记录 */}
      {activeTab === 'records' && (
        <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                {isManagerView && <th className="px-4 py-3 text-left font-medium">姓名</th>}
                {isManagerView && <th className="px-4 py-3 text-left font-medium">部门</th>}
                <th className="px-4 py-3 text-left font-medium">日期</th>
                <th className="px-4 py-3 text-left font-medium">签到</th>
                <th className="px-4 py-3 text-left font-medium">签退</th>
                <th className="px-4 py-3 text-left font-medium">排班</th>
                <th className="px-4 py-3 text-left font-medium">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  {isManagerView && <td className="px-4 py-3 font-medium">{r.user_name}</td>}
                  {isManagerView && <td className="px-4 py-3 text-gray-500">{r.department_name || '-'}</td>}
                  <td className="px-4 py-3">{r.date}</td>
                  <td className="px-4 py-3">{r.check_in ? new Date(r.check_in).toLocaleTimeString('zh-CN') : '-'}</td>
                  <td className="px-4 py-3">{r.check_out ? new Date(r.check_out).toLocaleTimeString('zh-CN') : '-'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {r.scheduled_start && r.scheduled_end ? `${r.scheduled_start}-${r.scheduled_end}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[r.status] || ''}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={tableColSpan + 3} className="text-center py-8 text-gray-400">暂无考勤记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: 钉钉同步 */}
      {activeTab === 'dingtalk' && (
        <div className="max-w-2xl space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm space-y-3" style={{ color: '#1e40af' }}>
            <button onClick={() => setShowDtGuide(!showDtGuide)} className="w-full flex items-center justify-between font-semibold text-base">
              如何获取钉钉 AppKey 和 AppSecret
              <span className="text-xs">{showDtGuide ? '收起' : '展开'}</span>
            </button>
            {showDtGuide && (
              <ol className="list-decimal pl-5 space-y-2">
                <li>打开 <a href="https://open-dev.dingtalk.com" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">钉钉开放平台 <ExternalLink size={12} /></a>，用管理员账号登录</li>
                <li>点击「应用开发」-「企业内部应用」-「创建应用」</li>
                <li>填写应用名称（如「微迹OA考勤同步」），选择「小程序+H5微应用」</li>
                <li>创建后，在「凭证与基础信息」找到 <b>AppKey</b> 和 <b>AppSecret</b></li>
                <li>在「权限管理」中申请：企业员工手机号信息、考勤组管理、考勤打卡记录</li>
                <li>将凭证填入下方，员工在个人中心绑定钉钉 UserID 即可同步</li>
              </ol>
            )}
          </div>

          <div className="bg-white border rounded-xl p-5 space-y-4" style={{ borderColor: '#f0f0f0' }}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">启用钉钉考勤同步</span>
                {dtConfig?.last_sync_at && <p className="text-xs text-gray-400 mt-0.5">上次同步: {new Date(dtConfig.last_sync_at).toLocaleString('zh-CN')}</p>}
              </div>
              <button onClick={() => setDtEnabled(!dtEnabled)}
                className={`w-11 h-6 rounded-full transition-colors ${dtEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${dtEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">AppKey</label>
                <input value={dtAppKey} onChange={e => setDtAppKey(e.target.value)} placeholder="粘贴 AppKey"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" style={{ borderColor: '#e5e5e5' }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  AppSecret {dtConfig?.app_secret_masked && <span className="text-gray-400 ml-1">({dtConfig.app_secret_masked})</span>}
                </label>
                <input type="password" value={dtAppSecret} onChange={e => setDtAppSecret(e.target.value)} placeholder="留空则不修改"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" style={{ borderColor: '#e5e5e5' }} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleDtSave} disabled={dtSaving}
                className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg flex items-center gap-2 disabled:opacity-50">
                <Save size={14} /> {dtSaving ? '保存中...' : '保存配置'}
              </button>
              <button onClick={handleDtSync} disabled={dtSyncing || !dtEnabled}
                className="px-5 py-2 border text-sm rounded-lg flex items-center gap-2 disabled:opacity-50" style={{ borderColor: '#e5e5e5', color: '#404040' }}>
                <RefreshCw size={14} /> {dtSyncing ? '同步中...' : '手动同步'}
              </button>
            </div>

            {dtMsg && <p className="text-sm text-green-600">{dtMsg}</p>}
            {dtSyncResult && <p className="text-sm text-gray-600">{dtSyncResult}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
