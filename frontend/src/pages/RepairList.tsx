import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight, Eye, Download, Wallet, Ban } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import {
  getRepairList,
  getRepairDetail,
  createRepair,
  updateRepair,
  deleteRepair,
  addRepairFeedback,
  getRepairFeedbacks,
  getRepairChargeRequests,
  createRepairChargeRequest,
  markRepairChargePaid,
  cancelRepairChargeRequest,
} from '../api/repair'
import { RepairRecord, RepairFeedback, RepairChargeRequest } from '../types'
import { useAuth } from '../hooks/useAuth'
import FieldSelect from '../components/FieldSelect'
import * as XLSX from 'xlsx'

function exportToExcel(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) { alert('暂无数据可导出'); return }
  try {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, filename)
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } catch (e) {
    alert('导出失败，请重试')
    console.error(e)
  }
}

const REPAIR_STATUSES = [
  { value: 'pending_repair', label: '待维修', color: 'bg-amber-100 text-amber-700' },
  { value: 'processing_repair', label: '维修中', color: 'bg-orange-100 text-orange-700' },
  { value: 'completed_repair', label: '已修好', color: 'bg-green-100 text-green-700' },
]

const CHARGE_STATUSES = [
  { value: 'none', label: '无需收费', color: 'bg-gray-100 text-gray-600' },
  { value: 'pending_charge', label: '待收费', color: 'bg-rose-100 text-rose-700' },
  { value: 'paid', label: '已收费', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: '已取消', color: 'bg-slate-100 text-slate-600' },
]

function RepairStatusBadge({ status }: { status: string }) {
  const s = REPAIR_STATUSES.find(x => x.value === status) || REPAIR_STATUSES[0]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
}

function ChargeStatusBadge({ status }: { status: string }) {
  const s = CHARGE_STATUSES.find(x => x.value === status) || CHARGE_STATUSES[0]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
}

const emptyForm = {
  apply_date: '', order_no: '', return_reason: '', model: '',
  config: '', quantity: 1, accessories: '',
  customer_info: '', return_tracking: '', send_tracking: '', handle_result: '',
  repair_status: 'pending_repair',
  charge_required: false, charge_status: 'none',
  current_expected_amount: 0, current_paid_amount: 0, last_charge_request_id: undefined as number | undefined,
  disassembly_feedback: '', shipping_fee: 0, remark: '',
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatCurrency(value?: number) {
  return `¥${(value || 0).toFixed(2)}`
}

function formatDateTime(value?: string) {
  return value ? value.slice(0, 16).replace('T', ' ') : '-'
}

function formatChargeAmount(record: RepairRecord) {
  if (record.charge_status === 'pending_charge' && record.current_expected_amount > 0) {
    return `预计 ${formatCurrency(record.current_expected_amount)}`
  }
  if (record.charge_status === 'paid' && record.current_paid_amount > 0) {
    return `实收 ${formatCurrency(record.current_paid_amount)}`
  }
  return '-'
}

export default function RepairList() {
  const { user, hasPermission } = useAuth()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef<HTMLTableRowElement | null>(null)
  const [records, setRecords] = useState<RepairRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [repairStatusFilter, setRepairStatusFilter] = useState('')
  const [chargeStatusFilter, setChargeStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [detailRecord, setDetailRecord] = useState<RepairRecord | null>(null)
  const [editRecord, setEditRecord] = useState<RepairRecord | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [feedbacks, setFeedbacks] = useState<RepairFeedback[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [addingFeedback, setAddingFeedback] = useState(false)
  const [chargeRequests, setChargeRequests] = useState<RepairChargeRequest[]>([])
  const [chargeBusy, setChargeBusy] = useState(false)
  const [showChargeForm, setShowChargeForm] = useState(false)
  const [showPaidForm, setShowPaidForm] = useState(false)
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [chargeForm, setChargeForm] = useState({ expected_amount: '', charge_note: '' })
  const [paidForm, setPaidForm] = useState({ paid_amount: '', amount_change_note: '' })
  const [cancelReason, setCancelReason] = useState('')
  const pageSize = 15

  // 高亮动画样式
  const highlightStyle = `
    @keyframes highlight-flash {
      0% { background-color: #fef3c7; }
      20% { background-color: #fde68a; }
      40% { background-color: #fef3c7; }
      60% { background-color: #fde68a; }
      80% { background-color: #fef3c7; }
      100% { background-color: transparent; }
    }
    .highlight-row { animation: highlight-flash 3s ease-out; }
  `

  const canCreate = hasPermission('repair:create')
  const canEdit = hasPermission('repair:edit')
  const canDelete = hasPermission('repair:delete')
  const canProcess = hasPermission('repair:process')
  const canCreateChargeRequest = user?.role === 'admin' || user?.role === 'technician'
  const canMarkChargePaid = user?.role === 'admin' || user?.role === 'customer'
  const pendingChargeRequest = chargeRequests.find(item => item.status === 'pending_charge')

  const load = useCallback(() => {
    setLoading(true)
    getRepairList({
      page,
      page_size: pageSize,
      search,
      repair_status: repairStatusFilter,
      charge_status: chargeStatusFilter,
      start_date: startDate,
      end_date: endDate,
    })
      .then(data => { setRecords(data.items); setTotal(data.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search, repairStatusFilter, chargeStatusFilter, startDate, endDate])

  useEffect(() => { load() }, [load])

  // 高亮滚动效果
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => {
        if (highlightRef.current) {
          highlightRef.current.classList.remove('highlight-row')
        }
      }, 3000)
    }
  }, [records, highlightId])

  const loadDetailArtifacts = useCallback((recordId: number) => {
    return Promise.all([
      getRepairDetail(recordId),
      getRepairFeedbacks(recordId),
      getRepairChargeRequests(recordId),
    ]).then(([record, feedbackList, chargeList]) => {
      setDetailRecord(record)
      setFeedbacks(feedbackList)
      setChargeRequests(chargeList)
      return record
    })
  }, [])

  const resetChargeForms = () => {
    setShowChargeForm(false)
    setShowPaidForm(false)
    setShowCancelForm(false)
    setChargeForm({ expected_amount: '', charge_note: '' })
    setPaidForm({ paid_amount: '', amount_change_note: '' })
    setCancelReason('')
  }

  const handleExport = () => {
    getRepairList({
      page: 1,
      page_size: 100000,
      search,
      repair_status: repairStatusFilter,
      charge_status: chargeStatusFilter,
      start_date: startDate,
      end_date: endDate,
    })
      .then(data => {
        const rows = data.items.map((r: RepairRecord, idx: number) => ({
          '序号': idx + 1,
          '申请日期': r.apply_date || '',
          '订单编号': r.order_no || '',
          '型号': r.model || '',
          '配置': r.config || '',
          '数量': r.quantity || '',
          '配件': r.accessories || '',
          '客户信息': r.customer_info || '',
          '故障描述': r.return_reason || '',
          '寄回单号': r.return_tracking || '',
          '寄出新单号': r.send_tracking || '',
          '维修结果': r.handle_result || '',
          '拆件反馈': r.disassembly_feedback || '',
          '维修状态': REPAIR_STATUSES.find(item => item.value === r.repair_status)?.label || '待维修',
          '收费状态': CHARGE_STATUSES.find(item => item.value === r.charge_status)?.label || '无需收费',
          '收费金额': formatChargeAmount(r),
          '运费': r.shipping_fee || '',
          '备注': r.remark || '',
          '登记人': r.creator_name || '',
          '登记时间': formatDateTime(r.created_at),
        }))
        exportToExcel('维修登记', rows)
      })
      .catch(console.error)
  }

  const openCreate = () => {
    setEditRecord(null)
    setForm({ ...emptyForm, apply_date: todayStr() })
    setShowModal(true)
  }

  const openEdit = (record: RepairRecord) => {
    setEditRecord(record)
    setForm({
      apply_date: record.apply_date || '',
      order_no: record.order_no || '',
      return_reason: record.return_reason || '',
      model: record.model || '',
      config: record.config || '',
      quantity: record.quantity || 1,
      accessories: record.accessories || '',
      customer_info: record.customer_info || '',
      return_tracking: record.return_tracking || '',
      send_tracking: record.send_tracking || '',
      handle_result: record.handle_result || '',
      repair_status: record.repair_status || 'pending_repair',
      charge_required: record.charge_required || false,
      charge_status: record.charge_status || 'none',
      current_expected_amount: record.current_expected_amount || 0,
      current_paid_amount: record.current_paid_amount || 0,
      last_charge_request_id: record.last_charge_request_id,
      disassembly_feedback: record.disassembly_feedback || '',
      shipping_fee: record.shipping_fee || 0,
      remark: record.remark || '',
    })
    setShowModal(true)
  }

  const openDetail = async (record: RepairRecord) => {
    try {
      await loadDetailArtifacts(record.id)
      resetChargeForms()
      setShowDetail(true)
    } catch (e) {
      console.error('加载详情失败:', e)
      alert('加载详情失败，请重试')
    }
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      if (editRecord) {
        await updateRepair(editRecord.id, form)
      } else {
        await createRepair(form)
      }
      setShowModal(false)
      load()
    } catch (e) {
      alert('保存失败')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (record: RepairRecord) => {
    if (!confirm(`确定删除维修登记 #${record.id}？`)) return
    try {
      await deleteRepair(record.id)
      load()
    } catch (e) {
      alert('删除失败')
      console.error(e)
    }
  }

  const handleAddFeedback = async () => {
    if (!feedbackText.trim() || !detailRecord) return
    setAddingFeedback(true)
    try {
      const fb = await addRepairFeedback(detailRecord.id, feedbackText)
      setFeedbacks([...feedbacks, fb])
      setFeedbackText('')
    } catch (e) {
      alert('添加处理记录失败')
      console.error(e)
    } finally {
      setAddingFeedback(false)
    }
  }

  const handleCreateCharge = async () => {
    if (!detailRecord || !chargeForm.expected_amount) return
    setChargeBusy(true)
    try {
      await createRepairChargeRequest(detailRecord.id, {
        expected_amount: Number(chargeForm.expected_amount),
        charge_note: chargeForm.charge_note,
      })
      await loadDetailArtifacts(detailRecord.id)
      resetChargeForms()
    } catch (e) {
      alert('发起收费失败')
      console.error(e)
    } finally {
      setChargeBusy(false)
    }
  }

  const handleMarkPaid = async () => {
    if (!detailRecord || !pendingChargeRequest || !paidForm.paid_amount) return
    setChargeBusy(true)
    try {
      await markRepairChargePaid(pendingChargeRequest.id, {
        paid_amount: Number(paidForm.paid_amount),
        amount_change_note: paidForm.amount_change_note,
      })
      await loadDetailArtifacts(detailRecord.id)
      resetChargeForms()
    } catch (e) {
      alert('确认收费失败')
      console.error(e)
    } finally {
      setChargeBusy(false)
    }
  }

  const handleCancelCharge = async () => {
    if (!detailRecord || !pendingChargeRequest || !cancelReason.trim()) return
    setChargeBusy(true)
    try {
      await cancelRepairChargeRequest(pendingChargeRequest.id, cancelReason)
      await loadDetailArtifacts(detailRecord.id)
      resetChargeForms()
    } catch (e) {
      alert('取消收费失败')
      console.error(e)
    } finally {
      setChargeBusy(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <>
      <style>{highlightStyle}</style>
      <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">维修登记</h1>
        {canCreate && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus size={18} /> 新增登记
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">维修状态:</span>
            <select value={repairStatusFilter} onChange={e => { setRepairStatusFilter(e.target.value); setPage(1) }}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="">全部</option>
              {REPAIR_STATUSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">收费状态:</span>
            <select value={chargeStatusFilter} onChange={e => { setChargeStatusFilter(e.target.value); setPage(1) }}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="">全部</option>
              {CHARGE_STATUSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">日期:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm" />
            <span className="text-gray-400">-</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="搜索订单编号/型号/客户信息" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            <Download size={16} /> 导出
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">序号</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">申请日期</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">订单编号</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">型号</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">寄回单号</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">维修状态</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">收费状态</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">登记人</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">暂无数据</td></tr>
            ) : records.map((r, idx) => (
              <tr
                key={r.id}
                ref={r.id.toString() === highlightId ? highlightRef : undefined}
                className={`hover:bg-gray-50 ${r.id.toString() === highlightId ? 'highlight-row' : ''}`}
                style={r.id.toString() === highlightId ? { animation: 'highlight-flash 3s ease-out' } : {}}
              >
                <td className="px-4 py-3">{(page - 1) * pageSize + idx + 1}</td>
                <td className="px-4 py-3">{r.apply_date || '-'}</td>
                <td className="px-4 py-3">{r.order_no || '-'}</td>
                <td className="px-4 py-3">{r.model || '-'}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.return_tracking || '-'}</td>
                <td className="px-4 py-3"><RepairStatusBadge status={r.repair_status} /></td>
                <td className="px-4 py-3"><ChargeStatusBadge status={r.charge_status} /></td>
                <td className="px-4 py-3">{r.creator_name || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openDetail(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="查看详情">
                      <Eye size={16} />
                    </button>
                    {canEdit && (
                      <button onClick={() => openEdit(r)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="编辑">
                        <Edit2 size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(r)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="删除">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-gray-500">共 {total} 条，第 {page}/{totalPages} 页</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50">
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editRecord ? '编辑维修登记' : '新增维修登记'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">申请日期</label>
                  <input type="date" value={form.apply_date} onChange={e => setForm({ ...form, apply_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">订单编号</label>
                  <input type="text" value={form.order_no} onChange={e => setForm({ ...form, order_no: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">型号</label>
                  <FieldSelect fieldName="model" label="型号" value={form.model || ''} onChange={v => setForm({ ...form, model: v })} placeholder="请选择或输入型号" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">配置</label>
                  <FieldSelect fieldName="config" label="配置" value={form.config || ''} onChange={v => setForm({ ...form, config: v })} placeholder="请选择或输入配置" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                  <input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">配件</label>
                  <FieldSelect fieldName="accessories" label="配件" value={form.accessories || ''} onChange={v => setForm({ ...form, accessories: v })} placeholder="请选择或输入配件" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">维修状态</label>
                  <select value={form.repair_status} onChange={e => setForm({ ...form, repair_status: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2">
                    {REPAIR_STATUSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">客户信息</label>
                <textarea value={form.customer_info} onChange={e => setForm({ ...form, customer_info: e.target.value })}
                  rows={2} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">故障描述</label>
                <textarea value={form.return_reason} onChange={e => setForm({ ...form, return_reason: e.target.value })}
                  rows={2} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">寄回单号</label>
                  <input type="text" value={form.return_tracking} onChange={e => setForm({ ...form, return_tracking: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">寄出新单号</label>
                  <input type="text" value={form.send_tracking} onChange={e => setForm({ ...form, send_tracking: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">维修结果</label>
                <textarea value={form.handle_result} onChange={e => setForm({ ...form, handle_result: e.target.value })}
                  rows={2} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">拆件反馈</label>
                <textarea value={form.disassembly_feedback} onChange={e => setForm({ ...form, disassembly_feedback: e.target.value })}
                  rows={2} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">运费</label>
                  <input type="number" min="0" step="0.01" value={form.shipping_fee} onChange={e => setForm({ ...form, shipping_fee: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                  <input type="text" value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">取消</button>
              <button onClick={handleSubmit} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && detailRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">维修登记详情 #{detailRecord.id}</h2>
              <button onClick={() => setShowDetail(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div><span className="text-gray-500">申请日期：</span>{detailRecord.apply_date || '-'}</div>
                <div><span className="text-gray-500">订单编号：</span>{detailRecord.order_no || '-'}</div>
                <div><span className="text-gray-500">型号：</span>{detailRecord.model || '-'}</div>
                <div><span className="text-gray-500">配置：</span>{detailRecord.config || '-'}</div>
                <div><span className="text-gray-500">数量：</span>{detailRecord.quantity || 1}</div>
                <div><span className="text-gray-500">配件：</span>{detailRecord.accessories || '-'}</div>
                <div><span className="text-gray-500">维修状态：</span><RepairStatusBadge status={detailRecord.repair_status} /></div>
                <div><span className="text-gray-500">收费状态：</span><ChargeStatusBadge status={detailRecord.charge_status} /></div>
                <div className="col-span-2"><span className="text-gray-500">客户信息：</span>{detailRecord.customer_info || '-'}</div>
                <div className="col-span-2"><span className="text-gray-500">故障描述：</span>{detailRecord.return_reason || '-'}</div>
                <div><span className="text-gray-500">寄回单号：</span>{detailRecord.return_tracking || '-'}</div>
                <div><span className="text-gray-500">寄出新单号：</span>{detailRecord.send_tracking || '-'}</div>
                <div className="col-span-2"><span className="text-gray-500">维修结果：</span>{detailRecord.handle_result || '-'}</div>
                <div className="col-span-2"><span className="text-gray-500">拆件反馈：</span>{detailRecord.disassembly_feedback || '-'}</div>
                <div><span className="text-gray-500">运费：</span>¥{detailRecord.shipping_fee?.toFixed(2) || '0.00'}</div>
                <div><span className="text-gray-500">备注：</span>{detailRecord.remark || '-'}</div>
                <div><span className="text-gray-500">登记人：</span>{detailRecord.creator_name || '-'}</div>
                <div><span className="text-gray-500">登记时间：</span>{formatDateTime(detailRecord.created_at)}</div>
              </div>

              {/* 收费操作 */}
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">收费管理</h3>
                  {/* 无 pending 时允许发起新收费（支持多次收费） */}
                  {!pendingChargeRequest && canCreateChargeRequest && !showChargeForm && (
                    <button onClick={() => { setChargeForm({ expected_amount: '', charge_note: '' }); setShowChargeForm(true) }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                      <Wallet size={14} /> 发起{chargeRequests.length > 0 ? '新' : ''}收费
                    </button>
                  )}
                </div>

                {/* 累计金额汇总行 */}
                {chargeRequests.length > 0 && (
                  <div className="flex items-center gap-4 text-sm bg-gray-50 rounded-lg px-3 py-2 mb-3">
                    <span className="text-gray-500">累计：</span>
                    <span className="text-amber-700">
                      预计 {formatCurrency(chargeRequests.filter(r => r.status !== 'cancelled').reduce((s, r) => s + (r.expected_amount || 0), 0))}
                    </span>
                    <span className="text-green-700">
                      实收 {formatCurrency(chargeRequests.filter(r => r.status === 'paid').reduce((s, r) => s + (r.paid_amount || 0), 0))}
                    </span>
                  </div>
                )}

                {/* 当前待收费操作按钮 */}
                {pendingChargeRequest && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-amber-600">
                      待收费（第 {chargeRequests.findIndex(r => r.id === pendingChargeRequest.id) + 1} 笔）：{formatCurrency(pendingChargeRequest.expected_amount)}
                    </span>
                    {canMarkChargePaid && (
                      <>
                        <button onClick={() => { setPaidForm({ paid_amount: String(pendingChargeRequest.expected_amount), amount_change_note: '' }); setShowPaidForm(true) }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                          <Wallet size={14} /> 确认收费
                        </button>
                        <button onClick={() => { setCancelReason(''); setShowCancelForm(true) }}
                          className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">
                          <Ban size={14} /> 取消
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* 发起收费表单 */}
                {showChargeForm && (
                  <div className="bg-blue-50 rounded-lg p-3 mb-3">
                    <div className="text-sm font-medium text-blue-700 mb-2">
                      发起{chargeRequests.length > 0 ? `第 ${chargeRequests.length + 1} 笔` : ''}收费
                    </div>
                    <div className="flex gap-2">
                      <input type="number" placeholder="预计收费金额" value={chargeForm.expected_amount}
                        onChange={e => setChargeForm({ ...chargeForm, expected_amount: e.target.value })}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                      <input type="text" placeholder="备注（选填）" value={chargeForm.charge_note}
                        onChange={e => setChargeForm({ ...chargeForm, charge_note: e.target.value })}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                      <button onClick={handleCreateCharge} disabled={chargeBusy}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                        {chargeBusy ? '提交中...' : '提交'}
                      </button>
                      <button onClick={() => setShowChargeForm(false)}
                        className="px-4 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
                        取消
                      </button>
                    </div>
                  </div>
                )}

                {showPaidForm && (
                  <div className="bg-green-50 rounded-lg p-3 mb-3">
                    <div className="text-sm font-medium text-green-700 mb-2">确认收费</div>
                    <div className="flex gap-2">
                      <input type="number" placeholder="实收金额" value={paidForm.paid_amount}
                        onChange={e => setPaidForm({ ...paidForm, paid_amount: e.target.value })}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                      <input type="text" placeholder="金额变更说明（如有）" value={paidForm.amount_change_note}
                        onChange={e => setPaidForm({ ...paidForm, amount_change_note: e.target.value })}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                      <button onClick={handleMarkPaid} disabled={chargeBusy}
                        className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                        {chargeBusy ? '提交中...' : '确认'}
                      </button>
                      <button onClick={() => setShowPaidForm(false)}
                        className="px-4 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
                        取消
                      </button>
                    </div>
                  </div>
                )}

                {showCancelForm && (
                  <div className="bg-red-50 rounded-lg p-3 mb-3">
                    <div className="text-sm font-medium text-red-700 mb-2">取消收费</div>
                    <div className="flex gap-2">
                      <input type="text" placeholder="取消原因" value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                      <button onClick={handleCancelCharge} disabled={chargeBusy || !cancelReason.trim()}
                        className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                        {chargeBusy ? '提交中...' : '确认取消'}
                      </button>
                      <button onClick={() => setShowCancelForm(false)}
                        className="px-4 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
                        取消
                      </button>
                    </div>
                  </div>
                )}

                {/* 收费历史记录（全量） */}
                {chargeRequests.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">收费历史</div>
                    {chargeRequests.map((cr, idx) => (
                      <div key={cr.id} className="flex items-start gap-3 text-sm bg-white border rounded-lg px-3 py-2">
                        <span className="text-gray-400 text-xs whitespace-nowrap mt-0.5">第 {idx + 1} 笔</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <ChargeStatusBadge status={cr.status} />
                            <span className="text-gray-700">预计 {formatCurrency(cr.expected_amount)}</span>
                            {cr.status === 'paid' && (
                              <span className="text-green-700">实收 {formatCurrency(cr.paid_amount)}</span>
                            )}
                            {cr.charge_note && (
                              <span className="text-gray-400 text-xs">备注：{cr.charge_note}</span>
                            )}
                          </div>
                          <div className="text-gray-400 text-xs mt-1">
                            {formatDateTime(cr.created_at)} 由 {cr.created_by_name} 发起
                            {cr.status === 'paid' && cr.paid_by_name && ` · 由 ${cr.paid_by_name} 收款`}
                            {cr.status === 'paid' && cr.amount_change_note && ` · 改价说明：${cr.amount_change_note}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {chargeRequests.length === 0 && (
                  <p className="text-sm text-gray-400">暂无收费记录</p>
                )}
              </div>

              {/* 处理记录 */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">处理记录</h3>
                <div className="space-y-2 mb-4">
                  {feedbacks.length === 0 ? (
                    <p className="text-sm text-gray-400">暂无处理记录</p>
                  ) : feedbacks.map(fb => (
                    <div key={fb.id} className="flex gap-3 text-sm">
                      <span className="text-gray-400 whitespace-nowrap">{formatDateTime(fb.created_at)}</span>
                      <span className="font-medium">{fb.user_name}</span>
                      <span className="text-gray-600">{fb.content}</span>
                    </div>
                  ))}
                </div>
                {canProcess && (
                  <div className="flex gap-2">
                    <input type="text" placeholder="添加处理记录..." value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddFeedback()}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                    <button onClick={handleAddFeedback} disabled={addingFeedback || !feedbackText.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                      {addingFeedback ? '添加中...' : '添加'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
