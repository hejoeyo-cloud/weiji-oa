import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight, Eye, Download } from 'lucide-react'
import {
  getReturnExchangeList,
  getReturnExchangeDetail,
  createReturnExchange,
  updateReturnExchange,
  deleteReturnExchange,
  addReturnExchangeFeedback,
  getReturnExchangeFeedbacks,
} from '../api/returnExchange'
import { ReturnExchangeRecord, ReturnExchangeFeedback } from '../types'
import DynamicFormFields from '../components/DynamicFormFields'
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

const RECORD_TYPES = [
  { value: 'return', label: '退货', color: 'bg-orange-100 text-orange-700' },
  { value: 'exchange', label: '换货', color: 'bg-purple-100 text-purple-700' },
]

function ProgressBadge({ progress }: { progress: string }) {
  const s = PROGRESSES.find(x => x.value === progress) || PROGRESSES[0]
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

function formatDateTime(value?: string) {
  return value ? value.slice(0, 16).replace('T', ' ') : '-'
}

export default function ReturnExchangeList() {
  const { user, hasPermission } = useAuth()
  const [records, setRecords] = useState<ReturnExchangeRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [recordTypeFilter, setRecordTypeFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [detailRecord, setDetailRecord] = useState<ReturnExchangeRecord | null>(null)
  const [editRecord, setEditRecord] = useState<ReturnExchangeRecord | null>(null)
  const [customData, setCustomData] = useState<Record<string,any>>({})
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [feedbacks, setFeedbacks] = useState<ReturnExchangeFeedback[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [addingFeedback, setAddingFeedback] = useState(false)
  const pageSize = 15

  const canCreate = hasPermission('return_exchange:create')
  const canEdit = hasPermission('return_exchange:edit')
  const canDelete = hasPermission('return_exchange:delete')

  const load = useCallback(() => {
    setLoading(true)
    getReturnExchangeList({
      page,
      page_size: pageSize,
      search,
      status: statusFilter,
      record_type: recordTypeFilter,
      start_date: startDate,
      end_date: endDate,
    })
      .then(data => { setRecords(data.items); setTotal(data.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search, statusFilter, recordTypeFilter, startDate, endDate])

  useEffect(() => { load() }, [load])

  const loadDetailArtifacts = useCallback((recordId: number) => {
    return Promise.all([
      getReturnExchangeDetail(recordId),
      getReturnExchangeFeedbacks(recordId),
    ]).then(([record, feedbackList]) => {
      setDetailRecord(record)
      setFeedbacks(feedbackList)
      return record
    })
  }, [])

  const handleExport = () => {
    getReturnExchangeList({
      page: 1,
      page_size: 100000,
      search,
      status: statusFilter,
      record_type: recordTypeFilter,
      start_date: startDate,
      end_date: endDate,
    })
      .then(data => {
        const rows = data.items.map((r: ReturnExchangeRecord, idx: number) => ({
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
          '处理结果': r.handle_result || '',
          '备注': r.remark || '',
          '登记人': r.creator_name || '',
          '登记时间': formatDateTime(r.created_at),
        }))
        exportToExcel('退换登记', rows)
      })
      .catch(console.error)
  }

  const openCreate = () => {
    setEditRecord(null)
    setForm({ ...emptyForm, apply_date: todayStr() })
    setShowModal(true)
  }

  const openEdit = (record: ReturnExchangeRecord) => {
    setEditRecord(record)
    setForm({
      apply_date: record.apply_date || '',
      order_no: record.order_no || '',
      return_reason: record.return_reason || '',
      size: record.size || '',
      model: record.model || '',
      config: record.config || '',
      computer_price: record.computer_price || 0,
      quantity: record.quantity || 1,
      accessories: record.accessories || '',
      accessories_price: record.accessories_price || 0,
      customer_info: record.customer_info || '',
      return_tracking: record.return_tracking || '',
      send_tracking: record.send_tracking || '',
      handle_result: record.handle_result || '',
      progress: record.progress || 'pending',
      disassembly_feedback: record.disassembly_feedback || '',
      shipping_fee: record.shipping_fee || 0,
      remark: record.remark || '',
      record_type: record.record_type || '',
    })
    setShowModal(true)
  }

  const openDetail = async (record: ReturnExchangeRecord) => {
    await loadDetailArtifacts(record.id)
    setShowDetail(true)
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      if (editRecord) {
        await updateReturnExchange(editRecord.id, { ...form, custom_data: customData })
      } else {
        await createReturnExchange({ ...form, custom_data: customData })
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

  const handleDelete = async (record: ReturnExchangeRecord) => {
    if (!confirm(`确定删除退换登记 #${record.id}？`)) return
    try {
      await deleteReturnExchange(record.id)
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
      const fb = await addReturnExchangeFeedback(detailRecord.id, feedbackText)
      setFeedbacks([...feedbacks, fb])
      setFeedbackText('')
    } catch (e) {
      alert('添加处理记录失败')
      console.error(e)
    } finally {
      setAddingFeedback(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">退换登记</h1>
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
            <span className="text-sm text-gray-500">状态:</span>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="">全部</option>
              {PROGRESSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">类型:</span>
            <select value={recordTypeFilter} onChange={e => { setRecordTypeFilter(e.target.value); setPage(1) }}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="">全部</option>
              {RECORD_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
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
              <th className="px-4 py-3 text-left text-gray-500 font-medium">登记类型</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">订单编号</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">型号</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">配置</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">客户信息</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">处理进度</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">登记人</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={10} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-8 text-gray-400">暂无数据</td></tr>
            ) : records.map((r, idx) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{(page - 1) * pageSize + idx + 1}</td>
                <td className="px-4 py-3">{r.apply_date || '-'}</td>
                <td className="px-4 py-3"><RecordTypeBadge recordType={r.record_type} /></td>
                <td className="px-4 py-3">{r.order_no || '-'}</td>
                <td className="px-4 py-3">{r.model || '-'}</td>
                <td className="px-4 py-3">{r.config || '-'}</td>
                <td className="px-4 py-3 max-w-[150px] truncate">{r.customer_info || '-'}</td>
                <td className="px-4 py-3"><ProgressBadge progress={r.progress} /></td>
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
              <h2 className="text-lg font-semibold">{editRecord ? '编辑退换登记' : '新增退换登记'}</h2>
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
                  <input type="text" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">配置</label>
                  <input type="text" value={form.config} onChange={e => setForm({ ...form, config: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">尺寸</label>
                  <input type="text" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                  <input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">电脑价格</label>
                  <input type="number" min="0" step="0.01" value={form.computer_price} onChange={e => setForm({ ...form, computer_price: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">配件</label>
                  <input type="text" value={form.accessories} onChange={e => setForm({ ...form, accessories: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">配件价格</label>
                <input type="number" min="0" step="0.01" value={form.accessories_price} onChange={e => setForm({ ...form, accessories_price: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">登记类型</label>
                <select value={form.record_type} onChange={e => setForm({ ...form, record_type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2">
                  <option value="">请选择</option>
                  {RECORD_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">处理进度</label>
                <select value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2">
                  {PROGRESSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">客户信息</label>
                <textarea value={form.customer_info} onChange={e => setForm({ ...form, customer_info: e.target.value })}
                  rows={2} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">退换原因</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">处理结果</label>
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
            <div className="mt-4 pt-4 border-t" style={{ borderColor: '#f0f0f0' }}>
              <DynamicFormFields moduleKey="return_exchange" value={customData} onChange={setCustomData} />
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
              <h2 className="text-lg font-semibold">退换登记详情 #{detailRecord.id}</h2>
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
                <div><span className="text-gray-500">尺寸：</span>{detailRecord.size || '-'}</div>
                <div><span className="text-gray-500">数量：</span>{detailRecord.quantity || 1}</div>
                <div><span className="text-gray-500">电脑价格：</span>¥{detailRecord.computer_price?.toFixed(2) || '0.00'}</div>
                <div><span className="text-gray-500">登记类型：</span><RecordTypeBadge recordType={detailRecord.record_type} /></div>
                <div><span className="text-gray-500">处理进度：</span><ProgressBadge progress={detailRecord.progress} /></div>
                <div className="col-span-2"><span className="text-gray-500">客户信息：</span>{detailRecord.customer_info || '-'}</div>
                <div className="col-span-2"><span className="text-gray-500">退换原因：</span>{detailRecord.return_reason || '-'}</div>
                <div><span className="text-gray-500">寄回单号：</span>{detailRecord.return_tracking || '-'}</div>
                <div><span className="text-gray-500">寄出新单号：</span>{detailRecord.send_tracking || '-'}</div>
                <div className="col-span-2"><span className="text-gray-500">处理结果：</span>{detailRecord.handle_result || '-'}</div>
                <div className="col-span-2"><span className="text-gray-500">拆件反馈：</span>{detailRecord.disassembly_feedback || '-'}</div>
                <div><span className="text-gray-500">运费：</span>¥{detailRecord.shipping_fee?.toFixed(2) || '0.00'}</div>
                <div><span className="text-gray-500">备注：</span>{detailRecord.remark || '-'}</div>
                <div><span className="text-gray-500">登记人：</span>{detailRecord.creator_name || '-'}</div>
                <div><span className="text-gray-500">登记时间：</span>{formatDateTime(detailRecord.created_at)}</div>
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
                {hasPermission('return_exchange:process') && (
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
  )
}
