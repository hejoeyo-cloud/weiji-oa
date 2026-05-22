import { useEffect, useState, useCallback } from 'react'
import { Clock, LogIn, LogOut, CheckCircle, AlertTriangle, CalendarCheck2 } from 'lucide-react'
import { checkIn, checkOut, getTodayAttendance, getAttendanceRecords, getMonthlyStats } from '../api/attendance'
import type { AttendanceRecord, MonthlyAttendanceStats } from '../types'

const STATUS_LABELS: Record<string, string> = {
  normal: '正常',
  late: '迟到',
  early: '早退',
  absent: '缺勤',
}

const STATUS_COLORS: Record<string, string> = {
  normal: 'text-green-600 bg-green-50',
  late: 'text-orange-600 bg-orange-50',
  early: 'text-yellow-600 bg-yellow-50',
  absent: 'text-red-600 bg-red-50',
}

export default function AttendancePage() {
  const [today, setToday] = useState<AttendanceRecord | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [stats, setStats] = useState<MonthlyAttendanceStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [monthSelect, setMonthSelect] = useState(currentMonth)
  const [activeTab, setActiveTab] = useState<'today' | 'records'>('today')

  const loadToday = useCallback(async () => {
    try {
      const data = await getTodayAttendance()
      setToday(data)
    } catch { /* ignore */ }
  }, [])

  const loadRecords = useCallback(async () => {
    try {
      const data = await getAttendanceRecords(currentMonth)
      setRecords(data)
    } catch { /* ignore */ }
  }, [currentMonth])

  const loadStats = useCallback(async () => {
    try {
      const data = await getMonthlyStats(currentMonth)
      setStats(data)
    } catch { /* ignore */ }
  }, [currentMonth])

  useEffect(() => { loadToday(); loadRecords(); loadStats() }, [loadToday, loadRecords, loadStats])

  const handleCheckIn = async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await checkIn()
      setToday(res.data)
      setMsg('签到成功！')
      loadRecords()
      loadStats()
    } catch (err: any) {
      setMsg(err.response?.data?.detail || '签到失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOut = async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await checkOut()
      setToday(res.data)
      setMsg('签退成功！')
      loadRecords()
      loadStats()
    } catch (err: any) {
      setMsg(err.response?.data?.detail || '签退失败')
    } finally {
      setLoading(false)
    }
  }

  const handleMonthQuery = () => {
    setCurrentMonth(monthSelect)
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div className="p-6 space-y-5">
      <h2 className="text-xl font-semibold text-gray-800">考勤打卡</h2>

      {/* 今日状态卡片 */}
      <div className="bg-white border rounded-2xl p-6" style={{ borderColor: '#f0f0f0' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500">{dateStr}</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{timeStr}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCheckIn}
              disabled={loading || !!today?.check_in}
              className="px-6 py-3 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-white"
              style={{ background: '#16a34a' }}
            >
              <LogIn size={16} /> 签到
            </button>
            <button
              onClick={handleCheckOut}
              disabled={loading || !today?.check_in || !!today?.check_out}
              className="px-6 py-3 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-white"
              style={{ background: '#dc2626' }}
            >
              <LogOut size={16} /> 签退
            </button>
          </div>
        </div>

        {msg && (
          <div className={`text-sm px-4 py-2.5 rounded-lg mb-4 ${msg.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg}
          </div>
        )}

        {today && (
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-400">签到：</span>
              <span className="font-medium">{today.check_in ? new Date(today.check_in).toLocaleTimeString('zh-CN') : '-'}</span>
            </div>
            <div>
              <span className="text-gray-400">签退：</span>
              <span className="font-medium">{today.check_out ? new Date(today.check_out).toLocaleTimeString('zh-CN') : '-'}</span>
            </div>
            <div>
              <span className="text-gray-400">状态：</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[today.status] || ''}`}>
                {STATUS_LABELS[today.status] || today.status}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 月度统计 */}
      {stats && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: '出勤天数', value: stats.total_days, icon: CalendarCheck2, color: 'text-blue-600' },
            { label: '正常', value: stats.normal_days, icon: CheckCircle, color: 'text-green-600' },
            { label: '迟到', value: stats.late_days, icon: AlertTriangle, color: 'text-orange-600' },
            { label: '早退', value: stats.early_days, icon: AlertTriangle, color: 'text-yellow-600' },
            { label: '缺勤', value: stats.absent_days, icon: Clock, color: 'text-red-600' },
          ].map(item => (
            <div key={item.label} className="bg-white border rounded-xl p-4 text-center" style={{ borderColor: '#f0f0f0' }}>
              <item.icon className={`w-5 h-5 mx-auto mb-2 ${item.color}`} />
              <div className="text-2xl font-bold text-gray-800">{item.value}</div>
              <div className="text-xs text-gray-400 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 切换标签 */}
      <div className="flex gap-4 border-b" style={{ borderColor: '#f0f0f0' }}>
        {(['today', 'records'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab ? 'text-gray-900' : 'text-gray-400 border-transparent'
            }`}
            style={activeTab === tab ? { borderColor: '#404040' } : {}}
          >
            {tab === 'today' ? '今日记录' : '历史记录'}
          </button>
        ))}
      </div>

      {/* 历史记录表格 */}
      {activeTab === 'records' && (
        <>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={monthSelect}
              onChange={e => setMonthSelect(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#e5e5e5' }}
            />
            <button onClick={handleMonthQuery} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">
              查询
            </button>
          </div>
          <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  {['日期', '签到', '签退', '状态', '来源', '地点'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">{r.check_in ? new Date(r.check_in).toLocaleTimeString('zh-CN') : '-'}</td>
                    <td className="px-4 py-3">{r.check_out ? new Date(r.check_out).toLocaleTimeString('zh-CN') : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[r.status] || ''}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${r.source === 'dingtalk' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        {r.source === 'dingtalk' ? '钉钉' : '手动'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.location || '-'}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">暂无考勤记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
