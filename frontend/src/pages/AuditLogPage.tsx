import React, { useState, useEffect, useCallback } from 'react'
import { Search, Shield, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { getAuditLogs } from '../api/auditLogs'
import { AuditLog } from '../types'

const RESOURCE_TYPES = [
  { value: '', label: '全部类型' },
  { value: 'ticket', label: '工单' },
  { value: 'user', label: '用户' },
  { value: 'knowledge_article', label: '知识库文章' },
  { value: 'knowledge_category', label: '知识库分类' },
  { value: 'return_exchange', label: '退换登记' },
  { value: 'repair', label: '维修登记' },
  { value: 'gift', label: '发货登记' },
  { value: 'gift_cashback', label: '返现登记' },
  { value: 'gift_resend', label: '礼品补发' },
  { value: 'announcement', label: '公告' },
  { value: 'approval', label: '审批' },
  { value: 'department', label: '部门' },
  { value: 'shop', label: '店铺' },
  { value: 'role', label: '角色' },
  { value: 'product', label: '产品' },
  { value: 'warehouse_product', label: '仓储货品' },
  { value: 'warehouse_inbound', label: '入库' },
  { value: 'warehouse_outbound', label: '出库' },
  { value: 'task', label: '任务' },
  { value: 'message', label: '邮件' },
  { value: 'schedule', label: '排班' },
  { value: 'attendance', label: '考勤' },
]

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
}

const ACTION_LABELS: Record<string, string> = {
  create: '创建', update: '更新', delete: '删除',
}

function formatTime(s?: string) {
  if (!s) return '-'
  const d = new Date(s)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [resourceType, setResourceType] = useState('')
  const [action, setAction] = useState('')
  const [username, setUsername] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const pageSize = 30

  const load = useCallback(() => {
    setLoading(true)
    getAuditLogs({ page, page_size: pageSize, resource_type: resourceType, action, username, start_date: startDate, end_date: endDate })
      .then(data => { setLogs(data.items); setTotal(data.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, resourceType, action, username, startDate, endDate])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
          <Shield size={20} className="text-slate-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">操作日志</h2>
          <p className="text-sm text-gray-500">系统所有增删改操作记录，共 {total} 条</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-2.5 rounded-lg border border-amber-200">
        <CalendarDays size={15} />
        <span>操作日志仅保留最近三个月的记录</span>
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap gap-3 card p-4">
        <div className="flex items-center gap-2 flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400" />
          <input className="flex-1 text-sm outline-none bg-transparent"
            placeholder="搜索操作人用户名..."
            value={username} onChange={e => { setUsername(e.target.value); setPage(1) }} />
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={resourceType} onChange={e => { setResourceType(e.target.value); setPage(1) }}>
          {RESOURCE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={action} onChange={e => { setAction(e.target.value); setPage(1) }}>
          <option value="">全部操作</option>
          <option value="create">创建</option>
          <option value="update">更新</option>
          <option value="delete">删除</option>
        </select>
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }}
          placeholder="开始日期" />
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }}
          placeholder="结束日期" />
      </div>

      {/* 日志列表 */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {['时间', '操作人', '操作', '资源类型', '资源ID', '详情', '变更'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">加载中...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">暂无操作日志</td></tr>
            ) : logs.map(log => {
              const hasChanges = log.changes && Object.keys(log.changes).length > 0
              const isExpanded = expandedId === log.id
              return (
                <React.Fragment key={log.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{formatTime(log.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{log.user_name || log.username}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                        {RESOURCE_TYPES.find(r => r.value === log.resource_type)?.label || log.resource_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono">{log.resource_id || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-64 truncate">{log.detail || '-'}</td>
                    <td className="px-4 py-3">
                      {hasChanges ? (
                        <button onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline">
                          {isExpanded ? '收起' : '查看变更'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && hasChanges && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 bg-gray-50">
                        <div className="max-w-2xl">
                          <p className="text-xs font-medium text-gray-500 mb-2">字段变更详情</p>
                          <div className="space-y-1">
                            {Object.entries(log.changes!).map(([field, val]) => (
                              <div key={field} className="flex items-center gap-2 text-xs">
                                <span className="font-medium text-gray-600 w-24 flex-shrink-0">{field}</span>
                                <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded max-w-48 truncate">{val.old || '(空)'}</span>
                                <span className="text-gray-400">→</span>
                                <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded max-w-48 truncate">{val.new || '(空)'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">第 {page} / {totalPages} 页，共 {total} 条</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100"><ChevronLeft size={16} /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
