import { useState, useEffect, useCallback } from 'react'
import { Plus, X, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { getApprovals, createApproval, handleApproval, cancelApproval, getApprovalUsers } from '../api/approvals'
import { ApprovalRequest } from '../types'
import { useAuth } from '../hooks/useAuth'

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  leave: { label: '请假申请', color: 'bg-blue-100 text-blue-700', icon: '🏖️' },
  reimbursement: { label: '报销申请', color: 'bg-green-100 text-green-700', icon: '💰' },
  purchase: { label: '采购申请', color: 'bg-purple-100 text-purple-700', icon: '🛒' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '审批中', color: 'bg-amber-100 text-amber-700' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-700' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700' },
  cancelled: { label: '已撤销', color: 'bg-gray-100 text-gray-500' },
}

function formatDate(s?: string) {
  if (!s) return ''
  return new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const emptyForm = {
  type: 'leave', title: '', description: '', amount: '',
  start_date: '', end_date: '', approver_ids: [] as number[],
}

export default function ApprovalPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<ApprovalRequest[]>([])
  const [total, setTotal] = useState(0)
  const [viewMode, setViewMode] = useState<'mine' | 'pending_my' | 'all'>('mine')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [allUsers, setAllUsers] = useState<{ id: number; name: string; role: string; is_manager?: boolean }[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [actionModal, setActionModal] = useState<{ id: number; action: 'approve' | 'reject' } | null>(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    getApprovals({
      page: 1, page_size: 50,
      type: typeFilter, status: statusFilter,
      mine: viewMode === 'mine',
      pending_my_approval: viewMode === 'pending_my',
    }).then(data => { setItems(data.items); setTotal(data.total) }).catch(console.error)
  }, [viewMode, typeFilter, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { getApprovalUsers().then(data => setAllUsers(data)).catch(console.error) }, [])

  const handleCreate = () => {
    if (!form.title || form.approver_ids.length === 0) return
    setSaving(true)
    createApproval({
      type: form.type, title: form.title, description: form.description,
      amount: form.amount ? Number(form.amount) : undefined,
      start_date: form.start_date, end_date: form.end_date,
      approver_ids: form.approver_ids,
    }).then(() => { setShowCreate(false); setForm(emptyForm); load() })
      .catch(console.error).finally(() => setSaving(false))
  }

  const handleAction = () => {
    if (!actionModal) return
    setSaving(true)
    handleApproval(actionModal.id, { action: actionModal.action, comment })
      .then(() => { setActionModal(null); setComment(''); load() })
      .catch(console.error).finally(() => setSaving(false))
  }

  const handleCancel = (id: number) => {
    if (!confirm('确认撤销此申请？')) return
    cancelApproval(id).then(load).catch(console.error)
  }

  const toggleApprover = (uid: number) => {
    setForm(f => ({
      ...f,
      approver_ids: f.approver_ids.includes(uid)
        ? f.approver_ids.filter(id => id !== uid)
        : [...f.approver_ids, uid],
    }))
  }

  const canApprove = (req: ApprovalRequest) =>
    req.status === 'pending' &&
    req.steps.some(s => s.approver_id === user?.id && s.status === 'pending')

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">审批管理</h2>
          <p className="text-sm text-gray-500 mt-0.5">共 {total} 条记录</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setShowCreate(true) }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} /> 提交申请
        </button>
      </div>

      {/* 视图切换 + 筛选 */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([['mine', '我的申请'], ['pending_my', '待我审批'], ['all', '全部']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">全部类型</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* 申请列表 */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400">暂无申请记录</div>
        ) : items.map(req => {
          const tc = TYPE_CONFIG[req.type] || TYPE_CONFIG.leave
          const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
          const isExpanded = expanded === req.id
          return (
            <div key={req.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl">{tc.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tc.color}`}>{tc.label}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
                        <h3 className="font-semibold text-gray-800">{req.title}</h3>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>申请人: {req.applicant_name}</span>
                        {req.amount && <span>金额: ¥{req.amount}</span>}
                        {req.start_date && <span>{req.start_date}{req.end_date ? ` ~ ${req.end_date}` : ''}</span>}
                        <span>{formatDate(req.created_at)}</span>
                      </div>
                      {req.description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{req.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canApprove(req) && (
                      <>
                        <button onClick={() => { setActionModal({ id: req.id, action: 'approve' }); setComment('') }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium rounded-lg transition-colors">
                          <CheckCircle size={13} /> 通过
                        </button>
                        <button onClick={() => { setActionModal({ id: req.id, action: 'reject' }); setComment('') }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition-colors">
                          <XCircle size={13} /> 拒绝
                        </button>
                      </>
                    )}
                    {req.applicant_id === user?.id && req.status === 'pending' && (
                      <button onClick={() => handleCancel(req.id)}
                        className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs rounded-lg transition-colors">撤销</button>
                    )}
                    <button onClick={() => setExpanded(isExpanded ? null : req.id)}
                      className="p-1.5 hover:bg-gray-100 text-gray-400 rounded-lg transition-colors">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* 展开：审批步骤 */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-3">审批进度</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {req.steps.map((step, idx) => (
                        <div key={step.id} className="flex items-center gap-2">
                          {idx > 0 && <div className="w-6 h-px bg-gray-200" />}
                          <div className={`flex flex-col items-center text-center ${step.status === 'waiting' ? 'opacity-50' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step.status === 'approve' ? 'bg-green-100 text-green-700' : step.status === 'reject' ? 'bg-red-100 text-red-600' : step.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                              {step.status === 'approve' ? '✓' : step.status === 'reject' ? '✗' : idx + 1}
                            </div>
                            <p className="text-xs text-gray-600 mt-1 whitespace-nowrap">{step.approver_name}</p>
                            {step.status === 'approve' && <p className="text-xs text-green-600">已通过</p>}
                            {step.status === 'reject' && <p className="text-xs text-red-500">已拒绝</p>}
                            {step.status === 'pending' && <p className="text-xs text-amber-600 flex items-center gap-0.5"><Clock size={10} />待审批</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 新建申请弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">提交审批申请</h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">申请类型</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">标题</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="简短说明" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
              </div>
              {form.type !== 'leave' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">金额（元）</label>
                  <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              )}
              {form.type === 'leave' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">开始日期</label>
                    <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                      value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">结束日期</label>
                    <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                      value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">申请说明</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                  rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  审批人 <span className="text-gray-400">（按顺序选择，支持多级）</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {allUsers.filter(u => u.id !== user?.id && u.is_manager).map(u => (
                    <label key={u.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${form.approver_ids.includes(u.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="checkbox" checked={form.approver_ids.includes(u.id)} onChange={() => toggleApprover(u.id)} className="rounded" />
                      <span className="text-sm text-gray-700">{u.name}</span>
                      <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${(TYPE_CONFIG[u.role] || { color: 'bg-gray-100 text-gray-500' }).color}`}>{u.role === 'admin' ? '管理员' : u.role === 'technician' ? '技术员' : '客服'}</span>
                    </label>
                  ))}
                </div>
                {form.approver_ids.length > 0 && (
                  <p className="text-xs text-blue-600 mt-2">
                    审批顺序: {form.approver_ids.map(id => allUsers.find(u => u.id === id)?.name).join(' → ')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleCreate} disabled={saving || !form.title || form.approver_ids.length === 0}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
                {saving ? '提交中...' : '提交申请'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 审批操作弹窗 */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">
                {actionModal.action === 'approve' ? '✅ 审批通过' : '❌ 拒绝申请'}
              </h3>
              <button onClick={() => setActionModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">审批意见（可选）</label>
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                rows={3} placeholder="填写审批意见..." value={comment} onChange={e => setComment(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setActionModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleAction} disabled={saving}
                className={`px-5 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-60 ${actionModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}>
                {saving ? '处理中...' : actionModal.action === 'approve' ? '确认通过' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
