import { useState, useEffect, useCallback } from 'react'
import {
  Calendar, Plus, Trash2, X, ArrowLeftRight, Settings, ChevronLeft, ChevronRight,
  Check, XCircle, Clock, User, AlertCircle
} from 'lucide-react'
import {
  getShifts, createShift, updateShift, deleteShift,
  getSlots, createSlot, batchRangeCreateSlots, deleteSlot,
  getSwapRequests, createSwapRequest, actionSwapRequest, cancelSwapRequest,
  getScheduleUsers,
} from '../api/schedule'
import { useAuth } from '../hooks/useAuth'
import type { ScheduleShift, ScheduleSlot, ShiftSwapRequest } from '../types'

type TabKey = 'schedule' | 'shifts' | 'swaps'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  // 周一=0, 周日=6
  let startWeekday = firstDay.getDay() - 1
  if (startWeekday < 0) startWeekday = 6
  const days: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
  return days
}

function fmtDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function SchedulePage() {
  const { user, hasPermission } = useAuth()
  const isAdmin = hasPermission('schedule:create', 'schedule:edit')

  const [tab, setTab] = useState<TabKey>('schedule')

  // 月份控制
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // 数据
  const [shifts, setShifts] = useState<ScheduleShift[]>([])
  const [slots, setSlots] = useState<ScheduleSlot[]>([])
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>([])
  const [users, setUsers] = useState<{ id: number; name: string; role: string }[]>([])
  const [loading, setLoading] = useState(false)

  // 弹窗
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [editShift, setEditShift] = useState<ScheduleShift | null>(null)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showSwapModal, setShowSwapModal] = useState(false)

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`

  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([
      getShifts(),
      getSlots(yearMonth),
      getSwapRequests(),
      getScheduleUsers(),
    ])
      .then(([shiftsData, slotsData, swapsData, usersData]) => {
        setShifts(shiftsData)
        setSlots(slotsData.items || [])
        setSwapRequests(swapsData.items || [])
        setUsers(usersData.map((x: any) => ({ id: x.id, name: x.name, role: x.role })))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [yearMonth])

  useEffect(() => { loadData() }, [loadData])

  // 重载换班列表
  const reloadSwaps = () => {
    getSwapRequests().then(d => setSwapRequests(d.items || [])).catch(console.error)
  }

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1) }

  const days = getMonthDays(year, month)
  const todayStr = fmtDate(now.getFullYear(), now.getMonth() + 1, now.getDate())

  // 构建 user -> date -> slot 映射
  const slotMap: Record<number, Record<string, ScheduleSlot>> = {}
  for (const s of slots) {
    if (!slotMap[s.user_id]) slotMap[s.user_id] = {}
    slotMap[s.user_id][s.date] = s
  }

  // 排班人员列表（显示所有用户）
  const scheduleUsers = users

  // ── 渲染 ────────────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">排班表</h2>
          <p className="text-sm text-gray-500 mt-0.5">按月查看全员排班信息</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setShowBatchModal(true)}
              className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium">
              <Plus size={14} /> 批量排班
            </button>
          )}
          <button onClick={() => setShowSwapModal(true)}
            className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium">
            <ArrowLeftRight size={14} /> 换班申请
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100 w-fit">
        {([
          { key: 'schedule' as TabKey, label: '排班日历', icon: Calendar },
          { key: 'shifts' as TabKey, label: '班次管理', icon: Settings },
          { key: 'swaps' as TabKey, label: '换班记录', icon: ArrowLeftRight },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* 排班日历 */}
      {tab === 'schedule' && (
        <div className="space-y-4">
          {/* 月份导航 */}
          <div className="flex items-center gap-4">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={18} /></button>
            <span className="text-lg font-semibold text-gray-800 min-w-32 text-center">{year} 年 {month} 月</span>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={18} /></button>
            <button onClick={goToday} className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">今天</button>
          </div>

          {/* 图例 */}
          <div className="flex flex-wrap gap-3">
            {shifts.map(s => (
              <div key={s.id} className="flex items-center gap-1.5 text-xs">
                <span className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: s.color }}>
                  {s.short_name || s.name[0]}
                </span>
                <span className="text-gray-600">{s.name}{s.start_time ? ` ${s.start_time}-${s.end_time}` : ''}</span>
              </div>
            ))}
          </div>

          {/* 日历表格 */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-20 border-r border-gray-100">员工</th>
                    {days.map((d, i) => (
                      <th key={i} className={`px-1 py-2 font-medium text-center min-w-9 ${d && fmtDate(year, month, d) === todayStr ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}>
                        {d ? (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px]">{WEEKDAYS[i % 7]}</span>
                            <span className="text-xs">{d}</span>
                          </div>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {scheduleUsers.length === 0 ? (
                    <tr><td colSpan={days.length + 1} className="text-center py-10 text-gray-400">暂无排班人员</td></tr>
                  ) : scheduleUsers.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-1.5 font-medium text-gray-800 sticky left-0 bg-white z-10 border-r border-gray-100 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {u.name[0]}
                          </div>
                          <span className="text-sm">{u.name}</span>
                        </div>
                      </td>
                      {days.map((d, i) => {
                        if (!d) return <td key={i} className="px-0.5 py-1.5" />
                        const dateStr = fmtDate(year, month, d)
                        const slot = slotMap[u.id]?.[dateStr]
                        const isToday = dateStr === todayStr
                        const isWeekend = i % 7 >= 5
                        return (
                          <td key={i} className={`px-0.5 py-1.5 text-center ${isToday ? 'bg-blue-50/50' : isWeekend ? 'bg-gray-50/30' : ''}`}>
                            {slot ? (
                              isAdmin ? (
                                <button
                                  onClick={() => {
                                    // 管理员点击可以循环切换班次
                                    const currentIdx = shifts.findIndex(s => s.id === slot.shift_id)
                                    const nextIdx = (currentIdx + 1) % shifts.length
                                    createSlot({ user_id: u.id, date: dateStr, shift_id: shifts[nextIdx].id }).then(loadData)
                                  }}
                                  onContextMenu={e => {
                                    e.preventDefault()
                                    deleteSlot(slot.id).then(loadData)
                                  }}
                                  title="点击切换班次，右键清除"
                                  className="w-7 h-7 rounded-md text-[10px] font-bold text-white flex items-center justify-center mx-auto transition-transform hover:scale-110 cursor-pointer"
                                  style={{ backgroundColor: slot.shift_color }}
                                >
                                  {slot.shift_short_name || slot.shift_name[0]}
                                </button>
                              ) : (
                                <span className="inline-flex w-7 h-7 rounded-md text-[10px] font-bold text-white items-center justify-center" style={{ backgroundColor: slot.shift_color }}>
                                  {slot.shift_short_name || slot.shift_name[0]}
                                </span>
                              )
                            ) : isAdmin ? (
                              <button
                                onClick={() => {
                                  if (shifts.length > 0) {
                                    createSlot({ user_id: u.id, date: dateStr, shift_id: shifts[0].id }).then(loadData)
                                  }
                                }}
                                className="w-7 h-7 rounded-md border border-dashed border-gray-200 text-gray-300 hover:border-blue-400 hover:text-blue-400 flex items-center justify-center mx-auto transition-colors cursor-pointer text-sm"
                              >
                                +
                              </button>
                            ) : null}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {isAdmin && <p className="text-xs text-gray-400">💡 点击格子可切换班次，右键点击可清除排班</p>}
        </div>
      )}

      {/* 班次管理 */}
      {tab === 'shifts' && (
        <div className="space-y-4">
          {isAdmin && (
            <button onClick={() => { setEditShift(null); setShowShiftModal(true) }}
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium">
              <Plus size={14} /> 新增班次
            </button>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map(s => (
              <div key={s.id} className="card p-4 flex items-center gap-4">
                <span className="w-10 h-10 rounded-lg text-white font-bold flex items-center justify-center text-sm flex-shrink-0" style={{ backgroundColor: s.color }}>
                  {s.short_name || s.name[0]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-500">
                    {s.is_rest ? '休息' : s.start_time ? `${s.start_time} - ${s.end_time}` : '未设置时间'}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditShift(s); setShowShiftModal(true) }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors" title="编辑">
                      <Settings size={14} />
                    </button>
                    <button onClick={() => { deleteShift(s.id).then(loadData).catch(e => alert(e?.response?.data?.detail || '删除失败')) }}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="删除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 换班记录 */}
      {tab === 'swaps' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['申请人', '换出日期', '目标人', '换入日期', '原因', '状态', '审批人', '操作'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {swapRequests.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">暂无换班申请</td></tr>
              ) : swapRequests.map(swap => (
                <tr key={swap.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{swap.applicant_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{swap.applicant_date}</td>
                  <td className="px-4 py-3 font-medium">{swap.target_user_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{swap.target_date}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-40 truncate">{swap.reason || '-'}</td>
                  <td className="px-4 py-3"><SwapStatusBadge status={swap.status} /></td>
                  <td className="px-4 py-3 text-gray-600">{swap.reviewer_name || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {swap.status === 'pending' && isAdmin && (
                        <>
                          <button onClick={() => { actionSwapRequest(swap.id, 'approve').then(reloadSwaps).then(loadData) }}
                            className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg transition-colors" title="批准">
                            <Check size={14} />
                          </button>
                          <button onClick={() => { actionSwapRequest(swap.id, 'reject').then(reloadSwaps) }}
                            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors" title="驳回">
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                      {swap.status === 'pending' && swap.applicant_id === user?.id && (
                        <button onClick={() => { cancelSwapRequest(swap.id).then(reloadSwaps) }}
                          className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors" title="取消">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 班次编辑弹窗 */}
      {showShiftModal && (
        <ShiftFormModal
          shift={editShift}
          onSave={(data) => {
            const promise = editShift ? updateShift(editShift.id, data) : createShift(data as any)
            promise.then(() => { setShowShiftModal(false); loadData() }).catch(console.error)
          }}
          onClose={() => setShowShiftModal(false)}
        />
      )}

      {/* 批量排班弹窗 */}
      {showBatchModal && (
        <BatchScheduleModal
          shifts={shifts}
          users={scheduleUsers}
          year={year}
          month={month}
          onSave={() => { setShowBatchModal(false); loadData() }}
          onClose={() => setShowBatchModal(false)}
        />
      )}

      {/* 换班申请弹窗 */}
      {showSwapModal && (
        <SwapRequestModal
          shifts={shifts}
          slots={slots}
          users={scheduleUsers}
          currentUserId={user?.id || 0}
          onSave={() => { setShowSwapModal(false); reloadSwaps() }}
          onClose={() => setShowSwapModal(false)}
        />
      )}
    </div>
  )
}


// ── 子组件 ─────────────────────────────────────────────────────────

function SwapStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: '待审批', color: 'bg-amber-100 text-amber-700' },
    approved: { label: '已批准', color: 'bg-green-100 text-green-700' },
    rejected: { label: '已驳回', color: 'bg-red-100 text-red-700' },
    cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-500' },
  }
  const s = map[status] || map.pending
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
}


function ShiftFormModal({ shift, onSave, onClose }: {
  shift: ScheduleShift | null
  onSave: (data: any) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: shift?.name || '',
    short_name: shift?.short_name || '',
    color: shift?.color || '#1677FF',
    start_time: shift?.start_time || '',
    end_time: shift?.end_time || '',
    sort_order: shift?.sort_order || 0,
    is_rest: shift?.is_rest || false,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{shift ? '编辑班次' : '新增班次'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">班次名称</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如：早班" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">简称</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))} placeholder="如：早" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">颜色</label>
              <input type="color" className="w-full h-10 rounded-lg border border-gray-200 cursor-pointer"
                value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">开始时间</label>
              <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">结束时间</label>
              <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_rest" checked={form.is_rest}
                onChange={e => setForm(f => ({ ...f, is_rest: e.target.checked }))}
                className="rounded border-gray-300" />
              <label htmlFor="is_rest" className="text-sm text-gray-700">休息班次</label>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">排序</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
          <button onClick={() => onSave(form)}
            className="btn-primary px-5 py-2 text-sm font-medium">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}


function BatchScheduleModal({ shifts, users, year, month, onSave, onClose }: {
  shifts: ScheduleShift[]
  users: { id: number; name: string }[]
  year: number
  month: number
  onSave: () => void
  onClose: () => void
}) {
  const [userId, setUserId] = useState(users[0]?.id || 0)
  const [shiftId, setShiftId] = useState(shifts[0]?.id || 0)
  const [startDate, setStartDate] = useState(`${year}-${String(month).padStart(2, '0')}-01`)
  const lastDay = new Date(year, month, 0).getDate()
  const [endDate, setEndDate] = useState(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    setSaving(true)
    batchRangeCreateSlots({ user_id: userId, start_date: startDate, end_date: endDate, shift_id: shiftId })
      .then(() => onSave())
      .catch(e => alert(e?.response?.data?.detail || '排班失败'))
      .finally(() => setSaving(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">批量排班</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">员工</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
              value={userId} onChange={e => setUserId(Number(e.target.value))}>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">班次</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
              value={shiftId} onChange={e => setShiftId(Number(e.target.value))}>
              {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">开始日期</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">结束日期</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-700 text-xs">
            <AlertCircle size={14} />
            <span>将在所选日期范围内为该员工设置同一种班次，已有排班会被覆盖</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary disabled:opacity-60">
            {saving ? '排班中...' : '确认排班'}
          </button>
        </div>
      </div>
    </div>
  )
}


function SwapRequestModal({ shifts, slots, users, currentUserId, onSave, onClose }: {
  shifts: ScheduleShift[]
  slots: ScheduleSlot[]
  users: { id: number; name: string }[]
  currentUserId: number
  onSave: () => void
  onClose: () => void
}) {
  const otherUsers = users.filter(u => u.id !== currentUserId)
  const [targetUserId, setTargetUserId] = useState(otherUsers[0]?.id || 0)
  const [applicantDate, setApplicantDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  // 我的排班日期
  const myDates = slots.filter(s => s.user_id === currentUserId).map(s => s.date)

  // 目标人的排班日期
  const targetDates = slots.filter(s => s.user_id === targetUserId).map(s => s.date)

  const handleSave = () => {
    if (!applicantDate || !targetDate) { alert('请选择换班日期'); return }
    setSaving(true)
    createSwapRequest({ target_user_id: targetUserId, applicant_date: applicantDate, target_date: targetDate, reason })
      .then(() => onSave())
      .catch(e => alert(e?.response?.data?.detail || '申请失败'))
      .finally(() => setSaving(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">换班申请</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">目标换班人</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
              value={targetUserId} onChange={e => setTargetUserId(Number(e.target.value))}>
              {otherUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">我的换出日期</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                value={applicantDate} onChange={e => setApplicantDate(e.target.value)} />
              {myDates.length > 0 && (
                <p className="text-[10px] text-gray-400 mt-1">已排班：{myDates.slice(0, 5).join(', ')}{myDates.length > 5 ? '...' : ''}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">对方的换入日期</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                value={targetDate} onChange={e => setTargetDate(e.target.value)} />
              {targetDates.length > 0 && (
                <p className="text-[10px] text-gray-400 mt-1">已排班：{targetDates.slice(0, 5).join(', ')}{targetDates.length > 5 ? '...' : ''}</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">换班原因</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none resize-none"
              rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="说明换班原因" />
          </div>
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-blue-700 text-xs">
            <ArrowLeftRight size={14} />
            <span>换班申请提交后需管理员审批，批准后班次将自动交换</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary px-5 py-2 text-sm font-medium disabled:opacity-60">
            {saving ? '提交中...' : '提交申请'}
          </button>
        </div>
      </div>
    </div>
  )
}
