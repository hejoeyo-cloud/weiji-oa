import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { Plus, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight, Eye, Download, ReceiptText, Wallet, Ban } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import {
  getAfterSalesList,
  getAfterSalesDetail,
  createAfterSales,
  updateAfterSales,
  deleteAfterSales,
  addAfterSalesFeedback,
  getAfterSalesFeedbacks,
  getAfterSalesChargeRequests,
  createAfterSalesChargeRequest,
  markAfterSalesChargePaid,
  cancelAfterSalesChargeRequest,
} from '../api/afterSales'
import { AfterSalesRecord, AfterSalesFeedback, AfterSalesChargeRequest } from '../types'
import { useAuth } from '../hooks/useAuth'
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

const PROGRESSES = [
  { value: 'pending', label: '待处理', color: 'bg-amber-100 text-amber-700' },
  { value: 'processing', label: '处理中', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: '已完成', color: 'bg-green-100 text-green-700' },
]

const CHARGE_STATUSES = [
  { value: 'none', label: '无需收费', color: 'bg-gray-100 text-gray-600' },
  { value: 'pending_charge', label: '待收费', color: 'bg-rose-100 text-rose-700' },
  { value: 'paid', label: '已收费', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: '已取消', color: 'bg-slate-100 text-slate-600' },
]

const RECORD_TYPES = [
  { value: 'return', label: '退货', color: 'bg-orange-100 text-orange-700' },
  { value: 'exchange', label: '换货', color: 'bg-purple-100 text-purple-700' },
]

function ProgressBadge({ progress }: { progress: string }) {
  const s = PROGRESSES.find(x => x.value === progress) || PROGRESSES[0]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
}

function ChargeStatusBadge({ status }: { status: string }) {
  const s = CHARGE_STATUSES.find(x => x.value === status) || CHARGE_STATUSES[0]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
}

function RecordTypeBadge({ recordType }: { recordType: string }) {
  const s = RECORD_TYPES.find(x => x.value === recordType)
  if (!s) return null
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
}

const emptyForm = {
  apply_date: '', order_no: '', return_reason: '', size: '', model: '',
  config: '', computer_price: 0, quantity: 1, accessories: '', accessories_price: 0,
  customer_info: '', return_tracking: '', send_tracking: '', handle_result: '',
  progress: 'pending', disassembly_feedback: '', shipping_fee: 0, remark: '',
  record_type: '',
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

function formatChargeAmount(record: AfterSalesRecord) {
  if (record.charge_status === 'pending_charge' && record.current_expected_amount > 0) {
    return `预计 ${formatCurrency(record.current_expected_amount)}`
  }
  if (record.charge_status === 'paid' && record.current_paid_amount > 0) {
    return `实收 ${formatCurrency(record.current_paid_amount)}`
  }
  return '-'
}

export default function AfterSalesList() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef<HTMLTableRowElement | null>(null)
  const [records, setRecords] = useState<AfterSalesRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [chargeStatusFilter, setChargeStatusFilter] = useState('')
  const [recordTypeFilter, setRecordTypeFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [detailRecord, setDetailRecord] = useState<AfterSalesRecord | null>(null)
  const [editRecord, setEditRecord] = useState<AfterSalesRecord | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [feedbacks, setFeedbacks] = useState<AfterSalesFeedback[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [addingFeedback, setAddingFeedback] = useState(false)
  const [chargeRequests, setChargeRequests] = useState<AfterSalesChargeRequest[]>([])
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

  const canCreateChargeRequest = user?.role === 'admin' || user?.role === 'technician'
  const canMarkChargePaid = user?.role === 'admin' || user?.role === 'customer'
  const pendingChargeRequest = chargeRequests.find(item => item.status === 'pending_charge')

  const load = useCallback(() => {
    setLoading(true)
    getAfterSalesList({
      page,
      page_size: pageSize,
      search,
      status: statusFilter,
      charge_status: chargeStatusFilter,
      record_type: recordTypeFilter,
      start_date: startDate,
      end_date: endDate,
    })
      .then(data => { setRecords(data.items); setTotal(data.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search, statusFilter, chargeStatusFilter, recordTypeFilter, startDate, endDate])

  useEffect(() => { load() }, [load])

  // 高亮滚动效果
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 3秒后移除高亮
      setTimeout(() => {
        if (highlightRef.current) {
          highlightRef.current.classList.remove('highlight-row')
        }
      }, 3000)
    }
  }, [records, highlightId])

  const loadDetailArtifacts = useCallback((recordId: number) => {
    return Promise.all([
      getAfterSalesDetail(recordId),
      getAfterSalesFeedbacks(recordId),
      getAfterSalesChargeRequests(recordId),
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
    getAfterSalesList({
      page: 1,
      page_size: 100000,
      search,
      status: statusFilter,
      charge_status: chargeStatusFilter,
      record_type: recordTypeFilter,
      start_date: startDate,
      end_date: endDate,
    })
      .then(data => {
        const rows = data.items.map((r: AfterSalesRecord, idx: number) => ({
          '序号': idx + 1,
          '申请日期': r.apply_date || '',
          '登记类型': RECORD_TYPES.find(item => item.value === r.record_type)?.label || '',
          '订单编号': r.order_no || '',
          '型号': r.model || '',
          '配置': r.config || '',
          '尺寸': r.size || '',
          '数量': r.quantity || '',
          '电脑价格': r.computer_price || 0,
          '客户信息': r.customer_info || '',
          '处理进度': r.progress || '',
          '收费状态': CHARGE_STATUSES.find(item => item.value === r.charge_status)?.label || '无需收费',
          '收费金额': formatChargeAmount(r),
          '处理结果': r.handle_result || '',
          '备注': r.remark || '',
          '登记人': r.creator_name || '',
          '登记时间': formatDateTime(r.created_at),
        }))
        exportToExcel('售后登记（旧）', rows)
      })
      .catch(console.error)
  }

  const openCreate = () => {
    setEditRecord(null)
    setForm({ ...emptyForm, apply_date: todayStr() })
    setShowModal(true)
  }

  const openEdit = (r: AfterSalesRecord) => {
    setEditRecord(r)
    setForm({
      apply_date: r.apply_date, order_no: r.order_no, return_reason: r.return_reason,
      size: r.size, model: r.model, config: r.config,
      computer_price: r.computer_price, quantity: r.quantity,
      accessories: r.accessories, accessories_price: r.accessories_price,
      customer_info: r.customer_info, return_tracking: r.return_tracking,
      send_tracking: r.send_tracking, handle_result: r.handle_result,
      progress: r.progress, disassembly_feedback: r.disassembly_feedback,
      shipping_fee: r.shipping_fee, remark: r.remark,
      record_type: r.record_type || '',
    })
    setShowDetail(false)
    setShowModal(true)
  }

  const openDetail = (r: AfterSalesRecord) => {
    setDetailRecord(r)
    setFeedbackText('')
    resetChargeForms()
    setShowDetail(true)
    loadDetailArtifacts(r.id).catch(console.error)
  }

  const handleSave = () => {
    setSaving(true)
    const promise = editRecord
      ? updateAfterSales(editRecord.id, form)
      : createAfterSales(form)
    promise.then((saved) => {
      const newId = saved?.id || editRecord?.id
      const changes: string[] = []
      if (!editRecord) {
        changes.push(`新建售后登记（旧） #${newId}`)
      } else {
        const old = editRecord
        if (old.apply_date !== form.apply_date) changes.push(`申请日期: ${old.apply_date || '无'} → ${form.apply_date || '无'}`)
        if (old.order_no !== form.order_no) changes.push(`订单编号: ${old.order_no || '无'} → ${form.order_no || '无'}`)
        if (old.progress !== form.progress) changes.push(`处理进度: ${old.progress || '无'} → ${form.progress || '无'}`)
        if (old.return_tracking !== form.return_tracking) changes.push(`寄回单号: ${old.return_tracking || '无'} → ${form.return_tracking || '无'}`)
        if (old.send_tracking !== form.send_tracking) changes.push(`寄出新单号: ${old.send_tracking || '无'} → ${form.send_tracking || '无'}`)
        if (old.record_type !== form.record_type) {
          const oldLabel = RECORD_TYPES.find(s => s.value === old.record_type)?.label || '未选'
          const newLabel = RECORD_TYPES.find(s => s.value === form.record_type)?.label || '未选'
          changes.push(`登记类型: ${oldLabel} → ${newLabel}`)
        }
        if (old.handle_result !== form.handle_result) changes.push(`处理结果: ${old.handle_result || '无'} → ${form.handle_result || '无'}`)
        if (old.remark !== form.remark) changes.push(`备注: ${old.remark || '无'} → ${form.remark || '无'}`)
        if (changes.length === 0) changes.push(`更新售后登记 #${newId}（无字段变更）`)
      }
      const content = editRecord ? changes.join('；') : `新建售后登记（旧） #${newId}`
      if (newId !== undefined) {
        addAfterSalesFeedback(newId, content).catch(console.error)
      }
      setShowModal(false)
      load()
    })
      .catch(console.error)
      .finally(() => setSaving(false))
  }

  const handleDelete = (id: number) => {
    if (!confirm('确认删除这条售后记录？')) return
    deleteAfterSales(id).then(load).catch(console.error)
  }

  const handleAddFeedback = () => {
    if (!detailRecord || !feedbackText.trim()) return
    setAddingFeedback(true)
    addAfterSalesFeedback(detailRecord.id, feedbackText.trim())
      .then(fb => {
        setFeedbacks(prev => [...prev, fb])
        setFeedbackText('')
      })
      .catch(console.error)
      .finally(() => setAddingFeedback(false))
  }

  const refreshCurrentDetail = () => {
    if (!detailRecord) return Promise.resolve()
    return loadDetailArtifacts(detailRecord.id).then(() => load())
  }

  const handleCreateChargeRequest = () => {
    if (!detailRecord) return
    const expectedAmount = Number(chargeForm.expected_amount)
    if (!expectedAmount || expectedAmount <= 0) {
      alert('请填写正确的预计收费金额')
      return
    }
    setChargeBusy(true)
    createAfterSalesChargeRequest(detailRecord.id, {
      expected_amount: expectedAmount,
      charge_note: chargeForm.charge_note.trim(),
    })
      .then(() => {
        resetChargeForms()
        return refreshCurrentDetail()
      })
      .catch((error) => {
        alert(error?.response?.data?.detail || '发起收费失败')
      })
      .finally(() => setChargeBusy(false))
  }

  const handleMarkPaid = () => {
    if (!pendingChargeRequest) return
    const paidAmount = Number(paidForm.paid_amount)
    if (!paidAmount || paidAmount <= 0) {
      alert('请填写正确的实收金额')
      return
    }
    if (paidAmount !== Number(pendingChargeRequest.expected_amount || 0) && !paidForm.amount_change_note.trim()) {
      alert('金额有变更时必须填写修改说明')
      return
    }
    setChargeBusy(true)
    markAfterSalesChargePaid(pendingChargeRequest.id, {
      paid_amount: paidAmount,
      amount_change_note: paidForm.amount_change_note.trim(),
    })
      .then(() => {
        resetChargeForms()
        return refreshCurrentDetail()
      })
      .catch((error) => {
        alert(error?.response?.data?.detail || '确认收费失败')
      })
      .finally(() => setChargeBusy(false))
  }

  const handleCancelCharge = () => {
    if (!pendingChargeRequest) return
    setChargeBusy(true)
    cancelAfterSalesChargeRequest(pendingChargeRequest.id, cancelReason.trim())
      .then(() => {
        resetChargeForms()
        return refreshCurrentDetail()
      })
      .catch((error) => {
        alert(error?.response?.data?.detail || '取消收费失败')
      })
      .finally(() => setChargeBusy(false))
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <>
      <style>{highlightStyle}</style>
      <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">售后登记（旧）</h2>
          <p className="text-sm text-gray-500 mt-0.5">售后退货记录管理，共 {total} 条</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} /> 新建登记
        </button>
      </div>

      <div className="flex flex-wrap gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400" />
          <input className="flex-1 text-sm outline-none bg-transparent"
            placeholder="搜索订单号、型号、客户信息..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} />
        <span className="text-gray-400 self-center">-</span>
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} />
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">全部进度</option>
          {PROGRESSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={chargeStatusFilter} onChange={e => { setChargeStatusFilter(e.target.value); setPage(1) }}>
          <option value="">全部收费状态</option>
          {CHARGE_STATUSES.filter(s => s.value !== 'cancelled').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={recordTypeFilter} onChange={e => { setRecordTypeFilter(e.target.value); setPage(1) }}>
          <option value="">全部类型</option>
          {RECORD_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium rounded-lg border border-emerald-200 transition-colors">
          <Download size={14} /> 导出
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {['#', '申请日期', '登记类型', '订单编号', '型号', '配置', '客户信息', '处理进度', '收费状态', '收费金额', '操作'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={11} className="text-center py-10 text-gray-400">加载中...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-10 text-gray-400">暂无记录</td></tr>
              ) : records.map(r => (
                <tr
                  key={r.id}
                  ref={r.id.toString() === highlightId ? highlightRef : undefined}
                  className={`transition-colors highlight-row ${r.charge_status === 'pending_charge' ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-gray-50'}`}
                  style={r.id.toString() === highlightId ? { animation: 'highlight-flash 3s ease-out' } : {}}
                >
                  <td className="px-4 py-3 text-gray-400 font-mono">#{r.id}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.apply_date || '-'}</td>
                  <td className="px-4 py-3"><RecordTypeBadge recordType={r.record_type} /></td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs max-w-32 truncate">{r.order_no || '-'}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-28 truncate">{r.model || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-28 truncate">{r.config || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-40 truncate">{r.customer_info || '-'}</td>
                  <td className="px-4 py-3"><ProgressBadge progress={r.progress} /></td>
                  <td className="px-4 py-3"><ChargeStatusBadge status={r.charge_status} /></td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatChargeAmount(r)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openDetail(r)} className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors" title="查看详情"><Eye size={14} /></button>
                      <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors" title="编辑"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors" title="删除"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">第 {page} / {totalPages} 页</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showDetail && detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">售后记录详情 #{detailRecord.id}</h3>
              <button onClick={() => setShowDetail(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="申请日期" value={detailRecord.apply_date} />
                <DetailItem label="订单编号" value={detailRecord.order_no} mono />
                <DetailItem label="尺寸" value={detailRecord.size} />
                <DetailItem label="型号" value={detailRecord.model} />
                <DetailItem label="配置" value={detailRecord.config} />
                <DetailItem label="数量" value={String(detailRecord.quantity)} />
                <DetailItem label="电脑价格" value={formatCurrency(detailRecord.computer_price)} />
                <DetailItem label="配件价格" value={formatCurrency(detailRecord.accessories_price)} />
                <DetailItem label="运费" value={formatCurrency(detailRecord.shipping_fee)} />
                <div>
                  <span className="text-xs text-gray-400">登记类型</span>
                  <div className="mt-1"><RecordTypeBadge recordType={detailRecord.record_type} /></div>
                </div>
                <div>
                  <span className="text-xs text-gray-400">处理进度</span>
                  <div className="mt-1"><ProgressBadge progress={detailRecord.progress} /></div>
                </div>
              </div>
              <DetailItem label="退货原因" value={detailRecord.return_reason} full />
              <DetailItem label="配件" value={detailRecord.accessories} full />
              <DetailItem label="客户信息" value={detailRecord.customer_info} full />
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="寄回单号" value={detailRecord.return_tracking} mono />
                <DetailItem label="寄出新单号" value={detailRecord.send_tracking} mono />
              </div>
              <DetailItem label="处理结果" value={detailRecord.handle_result} full />
              <DetailItem label="拆件反馈" value={detailRecord.disassembly_feedback} full />
              <DetailItem label="备注" value={detailRecord.remark} full />
              <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                <span>登记人：{detailRecord.creator_name}</span>
                <span>{formatDateTime(detailRecord.created_at)}</span>
              </div>

              <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/60 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">收费维修</h4>
                    <p className="text-xs text-gray-500 mt-1">售后发起收费后，客服确认收款并回传实收金额。</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ChargeStatusBadge status={detailRecord.charge_status} />
                    {canCreateChargeRequest && detailRecord.charge_status !== 'pending_charge' && (
                      <button
                        onClick={() => {
                          setShowChargeForm(value => !value)
                          setShowPaidForm(false)
                          setShowCancelForm(false)
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                      >
                        <ReceiptText size={14} /> 发起收费维修
                      </button>
                    )}
                    {canMarkChargePaid && pendingChargeRequest && (
                      <button
                        onClick={() => {
                          setPaidForm({
                            paid_amount: pendingChargeRequest.expected_amount ? String(pendingChargeRequest.expected_amount) : '',
                            amount_change_note: '',
                          })
                          setShowPaidForm(value => !value)
                          setShowChargeForm(false)
                          setShowCancelForm(false)
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                      >
                        <Wallet size={14} /> 已收费
                      </button>
                    )}
                    {canCreateChargeRequest && pendingChargeRequest && (
                      <button
                        onClick={() => {
                          setShowCancelForm(value => !value)
                          setShowChargeForm(false)
                          setShowPaidForm(false)
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors"
                      >
                        <Ban size={14} /> 取消收费
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <SummaryCard label="当前收费状态" value={<ChargeStatusBadge status={detailRecord.charge_status} />} />
                  <SummaryCard label="预计收费" value={detailRecord.current_expected_amount ? formatCurrency(detailRecord.current_expected_amount) : '-'} />
                  <SummaryCard label="实收金额" value={detailRecord.current_paid_amount ? formatCurrency(detailRecord.current_paid_amount) : '-'} />
                  <SummaryCard label="最近收费单" value={detailRecord.last_charge_request_id ? `#${detailRecord.last_charge_request_id}` : '-'} />
                </div>

                {showChargeForm && (
                  <div className="rounded-xl border border-blue-100 bg-white p-4 space-y-3">
                    <h5 className="text-sm font-medium text-gray-800">发起收费维修</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <F
                        label="预计收费金额"
                        value={chargeForm.expected_amount}
                        s={v => setChargeForm(f => ({ ...f, expected_amount: v }))}
                        type="number"
                      />
                      <F
                        label="收费说明"
                        value={chargeForm.charge_note}
                        s={v => setChargeForm(f => ({ ...f, charge_note: v }))}
                        placeholder="如 更换主板、屏幕维修"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={resetChargeForms} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                      <button
                        onClick={handleCreateChargeRequest}
                        disabled={chargeBusy}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                      >
                        {chargeBusy ? '提交中...' : '提交收费申请'}
                      </button>
                    </div>
                  </div>
                )}

                {showPaidForm && pendingChargeRequest && (
                  <div className="rounded-xl border border-emerald-100 bg-white p-4 space-y-3">
                    <h5 className="text-sm font-medium text-gray-800">确认已收费</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <F
                        label={`实收金额（预计 ${formatCurrency(pendingChargeRequest.expected_amount)}）`}
                        value={paidForm.paid_amount}
                        s={v => setPaidForm(f => ({ ...f, paid_amount: v }))}
                        type="number"
                      />
                      <F
                        label="改价说明"
                        value={paidForm.amount_change_note}
                        s={v => setPaidForm(f => ({ ...f, amount_change_note: v }))}
                        placeholder="金额变更时必填"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={resetChargeForms} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                      <button
                        onClick={handleMarkPaid}
                        disabled={chargeBusy}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                      >
                        {chargeBusy ? '提交中...' : '确认已收费'}
                      </button>
                    </div>
                  </div>
                )}

                {showCancelForm && pendingChargeRequest && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                    <h5 className="text-sm font-medium text-gray-800">取消收费请求</h5>
                    <F label="取消原因" value={cancelReason} s={setCancelReason} placeholder="可选填写取消原因" />
                    <div className="flex justify-end gap-2">
                      <button onClick={resetChargeForms} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">返回</button>
                      <button
                        onClick={handleCancelCharge}
                        disabled={chargeBusy}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 hover:bg-gray-900 text-white transition-colors disabled:opacity-50"
                      >
                        {chargeBusy ? '处理中...' : '确认取消'}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-3">收费记录历史</h5>
                  {chargeRequests.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4 bg-white rounded-xl border border-dashed border-gray-200">暂无收费记录</p>
                  ) : (
                    <div className="space-y-3">
                      {chargeRequests.map(item => (
                        <div key={item.id} className="rounded-xl bg-white border border-gray-100 px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">收费单 #{item.id}</span>
                              <ChargeStatusBadge status={item.status} />
                            </div>
                            <span className="text-xs text-gray-400">{formatDateTime(item.created_at)}</span>
                          </div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                            <span>发起人：{item.created_by_name || '-'}</span>
                            <span>预计金额：{item.expected_amount ? formatCurrency(item.expected_amount) : '-'}</span>
                            <span>实收金额：{item.paid_amount ? formatCurrency(item.paid_amount) : '-'}</span>
                          </div>
                          {item.charge_note && <p className="mt-2 text-sm text-gray-600">收费说明：{item.charge_note}</p>}
                          {item.amount_change_note && <p className="mt-2 text-sm text-gray-600">改价说明：{item.amount_change_note}</p>}
                          {item.paid_by_name && (
                            <p className="mt-2 text-sm text-gray-600">
                              收费人：{item.paid_by_name} · {formatDateTime(item.paid_at)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">处理记录</h4>
                {feedbacks.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">暂无处理记录</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {feedbacks.map(fb => (
                      <div key={fb.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                          {fb.user_name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-gray-800">{fb.user_name}</span>
                            <span className="text-xs text-gray-400">{formatDateTime(fb.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5 break-words">{fb.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="添加处理记录..."
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddFeedback()}
                  />
                  <button
                    onClick={handleAddFeedback}
                    disabled={addingFeedback || !feedbackText.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                    {addingFeedback ? '...' : '记录'}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => { setShowDetail(false); openEdit(detailRecord) }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                编辑
              </button>
              <button onClick={() => setShowDetail(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">{editRecord ? '编辑售后记录（旧）' : '新建售后登记（旧）'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <F label="申请日期" value={form.apply_date} s={v => setForm(f => ({ ...f, apply_date: v }))} type="date" />
                <F label="订单编号" value={form.order_no} s={v => setForm(f => ({ ...f, order_no: v }))} />
                <F label="尺寸" value={form.size} s={v => setForm(f => ({ ...f, size: v }))} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <F label="型号" value={form.model} s={v => setForm(f => ({ ...f, model: v }))} />
                <F label="配置" value={form.config} s={v => setForm(f => ({ ...f, config: v }))} />
                <F label="数量" value={String(form.quantity)} s={v => setForm(f => ({ ...f, quantity: Number(v) || 1 }))} type="number" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <F label="电脑价格" value={String(form.computer_price)} s={v => setForm(f => ({ ...f, computer_price: Number(v) || 0 }))} type="number" />
                <F label="配件" value={form.accessories} s={v => setForm(f => ({ ...f, accessories: v }))} />
                <F label="配件价格" value={String(form.accessories_price)} s={v => setForm(f => ({ ...f, accessories_price: Number(v) || 0 }))} type="number" />
              </div>
              <F label="客户信息" value={form.customer_info} s={v => setForm(f => ({ ...f, customer_info: v }))} placeholder="姓名 / 手机号 / 地址" />
              <F label="退货原因" value={form.return_reason} s={v => setForm(f => ({ ...f, return_reason: v }))} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">登记类型</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                  value={form.record_type} onChange={e => setForm(f => ({ ...f, record_type: e.target.value }))}>
                  <option value="">请选择</option>
                  {RECORD_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <F label="寄回单号" value={form.return_tracking} s={v => setForm(f => ({ ...f, return_tracking: v }))} />
                <F label="寄出新单号" value={form.send_tracking} s={v => setForm(f => ({ ...f, send_tracking: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <F label="运费" value={String(form.shipping_fee)} s={v => setForm(f => ({ ...f, shipping_fee: Number(v) || 0 }))} type="number" />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">处理进度</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    value={form.progress} onChange={e => setForm(f => ({ ...f, progress: e.target.value }))}>
                    {PROGRESSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <F label="处理结果" value={form.handle_result} s={v => setForm(f => ({ ...f, handle_result: v }))} />
              <F label="拆件反馈" value={form.disassembly_feedback} s={v => setForm(f => ({ ...f, disassembly_feedback: v }))} />
              <F label="备注" value={form.remark} s={v => setForm(f => ({ ...f, remark: v }))} />
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

function DetailItem({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean }) {
  return (
    <div className={`${full ? 'col-span-2' : ''} min-w-0`}>
      <span className="text-xs text-gray-400 block">{label}</span>
      <span className={`text-sm text-gray-800 break-words ${mono ? 'font-mono' : ''}`}>{value || '-'}</span>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
      <p className="text-xs text-gray-400">{label}</p>
      <div className="mt-1 text-sm font-medium text-gray-800">{value}</div>
    </div>
  )
}

function F({ label, value, s, placeholder, type }: { label: string; value: string; s: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <input
        type={type || 'text'}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
        value={value} onChange={e => s(e.target.value)} placeholder={placeholder}
      />
    </div>
  )
}
