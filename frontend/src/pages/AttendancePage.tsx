import { useEffect, useState, useCallback } from 'react'
import { Clock, LogIn, LogOut, CheckCircle, AlertTriangle, CalendarCheck2, Save, RefreshCw, ExternalLink, Settings } from 'lucide-react'
import { checkIn, checkOut, getTodayAttendance, getAttendanceRecords, getMonthlyStats } from '../api/attendance'
import { getDingtalkConfig, saveDingtalkConfig, syncDingtalk } from '../api/dingtalk'
import { useAuth } from '../hooks/useAuth'
import type { AttendanceRecord, MonthlyAttendanceStats, DingtalkConfig } from '../types'

const STATUS_LABELS: Record<string, string> = {
  normal: '正常', late: '迟到', early: '早退', absent: '缺勤',
}
const STATUS_COLORS: Record<string, string> = {
  normal: 'text-green-600 bg-green-50', late: 'text-orange-600 bg-orange-50',
  early: 'text-yellow-600 bg-yellow-50', absent: 'text-red-600 bg-red-50',
}

export default function AttendancePage() {
  const { isAdmin } = useAuth()
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
  const [activeTab, setActiveTab] = useState<'records' | 'dingtalk'>('records')

  // ── 钉钉配置 ──
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
      if (data) {
        setDtAppKey(data.app_key || '')
        setDtEnabled(data.enabled)
      }
    } catch { /* ignore */ }
  }, [])

  const loadToday = useCallback(async () => {
    try { const data = await getTodayAttendance(); setToday(data) } catch { /* ignore */ }
  }, [])

  const loadRecords = useCallback(async () => {
    try { const data = await getAttendanceRecords(currentMonth); setRecords(data) } catch { /* ignore */ }
  }, [currentMonth])

  const loadStats = useCallback(async () => {
    try { const data = await getMonthlyStats(currentMonth); setStats(data) } catch { /* ignore */ }
  }, [currentMonth])

  useEffect(() => { loadToday(); loadRecords(); loadStats(); loadDtConfig() }, [loadToday, loadRecords, loadStats, loadDtConfig])

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
      setDtSyncResult(`同步完成：新增 ${res.synced} 条，覆盖 ${res.overwrote || 0} 条，跳过 ${res.skipped} 条`); loadDtConfig()
    } catch (err: any) {
      setDtSyncResult(err.response?.data?.detail || '同步失败')
    } finally { setDtSyncing(false) }
  }

  const handleMonthQuery = () => { setCurrentMonth(monthSelect) }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  const tabs = [
    { key: 'records' as const, label: '考勤记录' },
  ]
  if (isAdmin) tabs.push({ key: 'dingtalk' as const, label: '钉钉同步' })

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
            ><LogIn size={16} /> 签到</button>
            <button
              onClick={handleCheckOut}
              disabled={loading || !today?.check_in || !!today?.check_out}
              className="px-6 py-3 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-white"
              style={{ background: '#dc2626' }}
            ><LogOut size={16} /> 签退</button>
          </div>
        </div>

        {msg && (
          <div className={`text-sm px-4 py-2.5 rounded-lg mb-4 ${msg.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg}
          </div>
        )}

        {today && (
          <div className="flex gap-6 text-sm">
            <div><span className="text-gray-400">签到：</span><span className="font-medium">{today.check_in ? new Date(today.check_in).toLocaleTimeString('zh-CN') : '-'}</span></div>
            <div><span className="text-gray-400">签退：</span><span className="font-medium">{today.check_out ? new Date(today.check_out).toLocaleTimeString('zh-CN') : '-'}</span></div>
            <div><span className="text-gray-400">状态：</span><span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[today.status] || ''}`}>{STATUS_LABELS[today.status] || today.status}</span></div>
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

      {/* Tab 切换 */}
      <div className="flex gap-4 border-b" style={{ borderColor: '#f0f0f0' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === tab.key ? 'text-gray-900' : 'text-gray-400 border-transparent'
            }`}
            style={activeTab === tab.key ? { borderColor: '#404040' } : {}}
          >
            {tab.key === 'dingtalk' && <Settings size={14} />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: 考勤记录 */}
      {activeTab === 'records' && (
        <>
          <div className="flex items-center gap-3">
            <input type="month" value={monthSelect} onChange={e => setMonthSelect(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#e5e5e5' }} />
            <button onClick={handleMonthQuery} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">查询</button>
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
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">暂无考勤记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab: 钉钉同步（仅管理员可见） */}
      {activeTab === 'dingtalk' && (
        <div className="max-w-2xl space-y-5">
          {/* 接入说明 */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm space-y-3" style={{ color: '#1e40af' }}>
            <button onClick={() => setShowDtGuide(!showDtGuide)} className="w-full flex items-center justify-between font-semibold text-base">
              如何获取钉钉 AppKey 和 AppSecret
              <span className="text-xs">{showDtGuide ? '收起 ▲' : '展开 ▼'}</span>
            </button>
            {showDtGuide && (
              <ol className="list-decimal pl-5 space-y-2">
                <li>打开 <a href="https://open-dev.dingtalk.com" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">钉钉开放平台 <ExternalLink size={12} /></a>，用管理员账号登录</li>
                <li>点击「应用开发」→「企业内部应用」→「创建应用」</li>
                <li>填写应用名称（如「微迹OA考勤同步」），选择「小程序+H5微应用」</li>
                <li>创建后，在「凭证与基础信息」找到 <b>AppKey</b> 和 <b>AppSecret</b></li>
                <li>在「权限管理」中申请：企业员工手机号信息、考勤组管理、考勤打卡记录</li>
                <li>将凭证填入下方，员工在个人中心绑定钉钉 UserID 即可同步</li>
              </ol>
            )}
          </div>

          {/* 配置表单 */}
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
