import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, X, Eye, Download, Wand2 } from 'lucide-react'
import Pagination from '../components/Pagination'
import {
  getReturnExchangeList,
  getReturnExchangeDetail,
  createReturnExchange,
  updateReturnExchange,
  deleteReturnExchange,
  addReturnExchangeFeedback,
  getReturnExchangeFeedbacks,
} from '../api/returnExchange'
import { lookupOrder } from '../api/gifts'
import { ReturnExchangeRecord, ReturnExchangeFeedback } from '../types'
import { useAuth } from '../hooks/useAuth'
import ShopSelect from '../components/ShopSelect'
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

const PROGRESSES = [
  { value: 'pending', label: '待处理', color: 'bg-amber-100 text-amber-700' },
  { value: 'processing', label: '处理中', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: '已完成', color: 'bg-green-100 text-green-700' },
]

const RECORD_TYPES = [
  { value: 'return', label: '退货', color: 'bg-orange-100 text-orange-700' },
  { value: 'exchange', label: '换货', color: 'bg-purple-100 text-purple-700' },
  { value: 'upgrade', label: '升级配置', color: 'bg-cyan-100 text-cyan-700' },
]

const CLAIM_STATUSES = [
  { value: 'none', label: '不需要追赔' },
  { value: 'pending', label: '待追赔' },
  { value: 'claimed', label: '已追赔' },
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
  apply_date: '', shop_name: '', order_no: '', return_reason: '', size: '', model: '',
  config: '', computer_price: 0, quantity: 1, accessories: '', accessories_price: 0,
  customer_info: '', return_tracking: '', send_tracking: '', handle_result: '',
  progress: 'pending', disassembly_feedback: '', shipping_fee: 0, remark: '',
  record_type: '', upgrade_config: '', upgrade_fee: 0,
  has_damage: false, damage_items: [] as { name: string; amount: number; desc: string }[], claim_status: 'none',
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
  const [shopFilter, setShopFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [detailRecord, setDetailRecord] = useState<ReturnExchangeRecord | null>(null)
  const [editRecord, setEditRecord] = useState<ReturnExchangeRecord | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [feedbacks, setFeedbacks] = useState<ReturnExchangeFeedback[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [addingFeedback, setAddingFeedback] = useState(false)
  const pageSize = 15

  const canCreate = hasPermission('return_exchange:create')
  const canEdit = hasPermission('return_exchange:edit')
  const canDelete = hasPermission('return_exchange:delete')
  const [lookingUp, setLookingUp] = useState(false)
  const [editingDamage, setEditingDamage] = useState(false)
  const [damageForm, setDamageForm] = useState<{ has_damage: boolean; claim_status: string; damage_items: { name: string; amount: number; desc: string }[] }>({ has_damage: false, claim_status: 'none', damage_items: [] })
  const [savingDamage, setSavingDamage] = useState(false)

  const handleAutoFill = async () => {
    if (!form.order_no.trim()) { alert('请先输入订单编号'); return }
    setLookingUp(true)
    try {
      const result = await lookupOrder(form.order_no.trim())
      if (!result.found) { alert('未找到匹配的发货记录'); return }
      setForm(prev => ({
        ...prev,
        ...(result.shop_name && { shop_name: result.shop_name }),
        ...(result.customer_info && { customer_info: result.customer_info }),
      }))
    } catch { alert('查询失败，请重试') }
    finally { setLookingUp(false) }
  }

  const openDamageEditor = () => {
    if (!detailRecord) return
    setDamageForm({
      has_damage: detailRecord.has_damage || false,
      claim_status: detailRecord.claim_status || 'none',
      damage_items: detailRecord.damage_items?.map(d => ({ ...d })) || [],
    })
    setEditingDamage(true)
  }

  const handleSaveDamage = async () => {
    if (!detailRecord) return
    setSavingDamage(true)
    try {
      await updateReturnExchange(detailRecord.id, {
        has_damage: damageForm.has_damage,
        claim_status: damageForm.claim_status,
        damage_items: damageForm.damage_items,
      })
      const [fresh, fbList] = await Promise.all([
        getReturnExchangeDetail(detailRecord.id),
        getReturnExchangeFeedbacks(detailRecord.id),
      ])
      setDetailRecord(fresh)
      setFeedbacks(fbList)
      setEditingDamage(false)
      load()
    } catch { alert('保存失败') }
    finally { setSavingDamage(false) }
  }

  const load = useCallback(() => {
    setLoading(true)
    getReturnExchangeList({
      page,
      page_size: pageSize,
      search,
      status: statusFilter,
      record_type: recordTypeFilter,
      shop_name: shopFilter,
      start_date: startDate,
      end_date: endDate,
    })
      .then(data => { setRecords(data.items); setTotal(data.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search, statusFilter, recordTypeFilter, shopFilter, startDate, endDate])

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
      shop_name: shopFilter,
      start_date: startDate,
      end_date: endDate,
    })
      .then(data => {
        const rows = data.items.map((r: ReturnExchangeRecord, idx: number) => ({
          '序号': idx + 1,
          '申请日期': r.apply_date || '',
          '登记类型': RECORD_TYPES.find(item => item.value === r.record_type)?.label || '',
          '升级配置': r.upgrade_config || '',
          '升级差价': r.upgrade_fee || 0,
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
      shop_name: record.shop_name || '',
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
      upgrade_config: record.upgrade_config || '',
      upgrade_fee: record.upgrade_fee || 0,
      has_damage: record.has_damage || false,
      damage_items: record.damage_items || [],
      claim_status: record.claim_status || 'none',
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
        const changes: string[] = []
        const s = (v: unknown) => (v ?? '').toString().trim()
        const old = editRecord
        if (s(old.order_no) !== s(form.order_no)) changes.push(`订单编号: ${s(old.order_no) || '无'} → ${s(form.order_no) || '无'}`)
        if (s(old.shop_name) !== s(form.shop_name)) changes.push(`店铺: ${s(old.shop_name) || '无'} → ${s(form.shop_name) || '无'}`)
        if (s(old.model) !== s(form.model)) changes.push(`型号: ${s(old.model) || '无'} → ${s(form.model) || '无'}`)
        if (s(old.config) !== s(form.config)) changes.push(`配置: ${s(old.config) || '无'} → ${s(form.config) || '无'}`)
        if (s(old.size) !== s(form.size)) changes.push(`尺寸: ${s(old.size) || '无'} → ${s(form.size) || '无'}`)
        if (Number(old.quantity) !== Number(form.quantity)) changes.push(`数量: ${old.quantity} → ${form.quantity}`)
        if (Number(old.computer_price) !== Number(form.computer_price)) changes.push(`电脑价格: ¥${old.computer_price} → ¥${form.computer_price}`)
        if (s(old.customer_info) !== s(form.customer_info)) changes.push(`客户信息已更新`)
        if (s(old.return_reason) !== s(form.return_reason)) changes.push(`退换原因已更新`)
        if (s(old.return_tracking) !== s(form.return_tracking)) changes.push(`寄回单号: ${s(old.return_tracking) || '无'} → ${s(form.return_tracking) || '无'}`)
        if (s(old.send_tracking) !== s(form.send_tracking)) changes.push(`寄出单号: ${s(old.send_tracking) || '无'} → ${s(form.send_tracking) || '无'}`)
        if (s(old.handle_result) !== s(form.handle_result)) changes.push(`处理结果已更新`)
        if (s(old.disassembly_feedback) !== s(form.disassembly_feedback)) changes.push(`拆件反馈已更新`)
        if (Number(old.shipping_fee) !== Number(form.shipping_fee)) changes.push(`运费: ¥${old.shipping_fee} → ¥${form.shipping_fee}`)
        if (s(old.remark) !== s(form.remark)) changes.push(`备注已更新`)
        if (old.progress !== form.progress) {
          const ol = PROGRESSES.find(p => p.value === old.progress)?.label || old.progress
          const nl = PROGRESSES.find(p => p.value === form.progress)?.label || form.progress
          changes.push(`处理进度: ${ol} → ${nl}`)
        }
        if (s(old.record_type) !== s(form.record_type)) {
          const ol = RECORD_TYPES.find(p => p.value === old.record_type)?.label || old.record_type || '未设置'
          const nl = RECORD_TYPES.find(p => p.value === form.record_type)?.label || form.record_type || '未设置'
          changes.push(`登记类型: ${ol} → ${nl}`)
        }
        if (s(old.upgrade_config) !== s(form.upgrade_config)) changes.push(`升级配置: ${s(old.upgrade_config) || '无'} → ${s(form.upgrade_config) || '无'}`)
        if (Number(old.upgrade_fee) !== Number(form.upgrade_fee)) changes.push(`升级差价: ¥${old.upgrade_fee || 0} → ¥${form.upgrade_fee || 0}`)
        if (s(old.claim_status) !== s(form.claim_status)) {
          const ol = CLAIM_STATUSES.find(p => p.value === old.claim_status)?.label || old.claim_status
          const nl = CLAIM_STATUSES.find(p => p.value === form.claim_status)?.label || form.claim_status
          changes.push(`追赔状态: ${ol} → ${nl}`)
        }
        if (old.has_damage !== form.has_damage) {
          changes.push(`货损: ${old.has_damage ? '有' : '无'} → ${form.has_damage ? '有' : '无'}`)
        }
        const res = await updateReturnExchange(editRecord.id, form)
        const content = changes.length > 0 ? changes.join('；') : `编辑退换登记 #${editRecord.id}（无字段变更）`
        addReturnExchangeFeedback(res.id, content).catch(console.error)
      } else {
        const res = await createReturnExchange(form)
        addReturnExchangeFeedback(res.id, `新建退换登记 #${res.id}`).catch(console.error)
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

  const handleProgressChange = async (newProgress: string) => {
    if (!detailRecord) return
    const label = PROGRESSES.find(p => p.value === newProgress)?.label || newProgress
    if (!confirm(`确认将状态更改为「${label}」？`)) return
    try {
      await updateReturnExchange(detailRecord.id, { progress: newProgress })
      const oldLabel = PROGRESSES.find(p => p.value === detailRecord.progress)?.label || detailRecord.progress
      addReturnExchangeFeedback(detailRecord.id, `处理进度: ${oldLabel} → ${label}`).catch(console.error)
      const [fresh, fbList] = await Promise.all([
        getReturnExchangeDetail(detailRecord.id),
        getReturnExchangeFeedbacks(detailRecord.id),
      ])
      setDetailRecord(fresh)
      setFeedbacks(fbList)
      load()
    } catch {
      alert('操作失败')
    }
  }

  const handleMarkClaimed = async () => {
    if (!detailRecord) return
    if (!confirm('确认标记为已追赔？')) return
    try {
      await updateReturnExchange(detailRecord.id, { claim_status: 'claimed' })
      addReturnExchangeFeedback(detailRecord.id, '标记追赔状态: 待追赔 → 已追赔').catch(console.error)
      const [fresh, fbList] = await Promise.all([
        getReturnExchangeDetail(detailRecord.id),
        getReturnExchangeFeedbacks(detailRecord.id),
      ])
      setDetailRecord(fresh)
      setFeedbacks(fbList)
      load()
    } catch (e) {
      alert('操作失败')
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
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 btn-primary">
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
          <div className="min-w-[140px]">
            <ShopSelect value={shopFilter} onChange={v => { setShopFilter(v); setPage(1) }} showGear={false} placeholder="全部店铺" />
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
              <input type="text" placeholder="搜索订单编号/寄回单号/寄出单号/型号/客户信息" value={search}
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
              <th className="px-4 py-3 text-left text-gray-500 font-medium">店铺名称</th>
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
              <tr><td colSpan={11} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-8 text-gray-400">暂无数据</td></tr>
            ) : records.map((r, idx) => (
              <tr key={r.id} className={`hover:bg-gray-50 ${(r.duplicate_count ?? 0) > 1 ? 'bg-orange-50 border-l-2 border-l-orange-400' : ''}`}>
                <td className="px-4 py-3">{(page - 1) * pageSize + idx + 1}</td>
                <td className="px-4 py-3">{r.apply_date || '-'}</td>
                <td className="px-4 py-3">{r.shop_name || '-'}</td>
                <td className="px-4 py-3"><RecordTypeBadge recordType={r.record_type} /></td>
                <td className="px-4 py-3">{r.order_no || '-'}{(r.duplicate_count ?? 0) > 1 && <span className="ml-1 text-xs text-orange-600 font-medium">重复</span>}</td>
                <td className="px-4 py-3">{r.matched_gift?.model || r.model || '-'}</td>
                <td className="px-4 py-3">{r.matched_gift?.config || r.config || '-'}</td>
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

        <div className="px-4 py-3 border-t">
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    订单编号
                    <button type="button" onClick={handleAutoFill} disabled={lookingUp}
                      className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50">
                      <Wand2 size={12} />{lookingUp ? '识别中...' : '自动识别'}
                    </button>
                  </label>
                  <input type="text" value={form.order_no} onChange={e => setForm({ ...form, order_no: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">店铺名称</label>
                  <ShopSelect value={form.shop_name} onChange={v => setForm({ ...form, shop_name: v })} showGear={hasPermission('field_options:manage')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                  <input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
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
              {form.record_type === 'upgrade' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">升级后配置</label>
                    <FieldSelect fieldName="config" label="升级后配置" value={form.upgrade_config} onChange={v => setForm({ ...form, upgrade_config: v })} placeholder="请选择或输入升级后的配置" showGear={hasPermission('field_options:manage')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">升级差价</label>
                    <input type="number" min="0" step="0.01" value={form.upgrade_fee} onChange={e => setForm({ ...form, upgrade_fee: Number(e.target.value) })}
                      placeholder="客户补款金额"
                      className="w-full border rounded-lg px-3 py-2" />
                  </div>
                </div>
              )}
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
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">取消</button>
              <button onClick={handleSubmit} disabled={saving}
                className="px-4 py-2 btn-primary disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && detailRecord && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
                <div><span className="text-gray-500">店铺名称：</span>{detailRecord.shop_name || '-'}</div>
                <div><span className="text-gray-500">订单编号：</span>{detailRecord.order_no || '-'}</div>
                <div><span className="text-gray-500">数量：</span>{detailRecord.quantity || 1}</div>
                <div><span className="text-gray-500">登记类型：</span><RecordTypeBadge recordType={detailRecord.record_type} /></div>
                <div className="flex items-center gap-2"><span className="text-gray-500">处理进度：</span><ProgressBadge progress={detailRecord.progress} />
                  {canEdit && detailRecord.progress === 'pending' && (
                    <button onClick={() => handleProgressChange('processing')}
                      className="px-2.5 py-1 btn-primary text-xs rounded">处理中</button>
                  )}
                  {canEdit && detailRecord.progress !== 'completed' && (
                    <button onClick={() => handleProgressChange('completed')}
                      className="px-2.5 py-1 btn-success text-xs rounded">已完成</button>
                  )}
                </div>
                {detailRecord.record_type === 'upgrade' && (
                  <>
                    <div><span className="text-gray-500">升级配置：</span><span className="text-cyan-700 font-medium">{detailRecord.upgrade_config || '-'}</span></div>
                    <div><span className="text-gray-500">升级差价：</span><span className="text-cyan-700 font-medium">¥{detailRecord.upgrade_fee?.toFixed(2) || '0.00'}</span></div>
                  </>
                )}
                <div className="col-span-2"><span className="text-gray-500">客户信息：</span>{detailRecord.customer_info || '-'}</div>
                <div className="col-span-2"><span className="text-gray-500">退换原因：</span>{detailRecord.return_reason || '-'}</div>
                <div><span className="text-gray-500">寄回单号：</span>{detailRecord.return_tracking || '-'}</div>
                <div><span className="text-gray-500">寄出新单号：</span>{detailRecord.send_tracking || '-'}</div>
                <div className="col-span-2"><span className="text-gray-500">处理结果：</span>{detailRecord.handle_result || '-'}</div>
                <div className="col-span-2"><span className="text-gray-500">拆件反馈：</span>{detailRecord.disassembly_feedback || '-'}</div>
                <div><span className="text-gray-500">运费：</span>¥{detailRecord.shipping_fee?.toFixed(2) || '0.00'}</div>
                <div><span className="text-gray-500">备注：</span>{detailRecord.remark || '-'}</div>
                {detailRecord.matched_gift && (() => {
                  const gift = detailRecord.matched_gift
                  const GIFT_STATUS: Record<string, { label: string; cls: string }> = {
                    pending: { label: '待发货', cls: 'bg-yellow-100 text-yellow-700' },
                    sent: { label: '已发货', cls: 'bg-green-100 text-green-700' },
                    intercepted: { label: '已拦截', cls: 'bg-orange-100 text-orange-700' },
                    torn: { label: '已撕单', cls: 'bg-gray-100 text-gray-500' },
                    cancelled: { label: '已取消', cls: 'bg-gray-100 text-gray-500' },
                    returned: { label: '已退货', cls: 'bg-red-100 text-red-600' },
                  }
                  const gs = GIFT_STATUS[gift.status] || { label: gift.status, cls: 'bg-gray-100 text-gray-500' }
                  return (
                    <div className="col-span-2 border-t pt-3 mt-1" style={{ borderColor: '#bfdbfe' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-blue-600 font-medium">关联发货单</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${gs.cls}`}>{gs.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        <span><span className="text-gray-500">发货日期：</span>{gift.date || '-'}</span>
                        <span><span className="text-gray-500">型号：</span>{gift.model || '-'}</span>
                        <span><span className="text-gray-500">配置：</span>{gift.config || '-'}</span>
                        <span><span className="text-gray-500">颜色：</span>{gift.color || '-'}</span>
                        <span><span className="text-gray-500">数量：</span>{gift.quantity}</span>
                        <span><span className="text-gray-500">发出单号：</span>{gift.send_tracking || '-'}</span>
                        <span><span className="text-gray-500">订单金额：</span>¥{gift.order_amount.toFixed(2)}</span>
                      </div>
                      {gift.gift_costs && gift.gift_costs.length > 0 && (
                        <div className="mt-1">
                          <span className="text-gray-500">礼品：</span>
                          {gift.gift_costs.map((g, i) => (
                            <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 text-sm mr-1">
                              {g.name} <span className="text-blue-500">¥{g.amount}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
                {/* 货损信息 */}
                {editingDamage ? (
                  <div className="col-span-2 border-t pt-3 mt-1" style={{ borderColor: '#fecaca' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-red-600 font-medium">编辑货损信息</span>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingDamage(false)} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">取消</button>
                        <button onClick={handleSaveDamage} disabled={savingDamage}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50">
                          {savingDamage ? '保存中...' : '保存'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 mb-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={damageForm.has_damage}
                          onChange={e => setDamageForm({ ...damageForm, has_damage: e.target.checked, claim_status: e.target.checked ? damageForm.claim_status : 'none', damage_items: e.target.checked ? damageForm.damage_items : [] })}
                          className="w-4 h-4 rounded border-gray-300" />
                        有货损
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-500">追赔状态：</label>
                        <select value={damageForm.claim_status} onChange={e => setDamageForm({ ...damageForm, claim_status: e.target.value })}
                          disabled={!damageForm.has_damage}
                          className="border rounded-lg px-3 py-1.5 text-sm disabled:opacity-50" style={{ borderColor: '#e5e5e5' }}>
                          <option value="none">不需要追赔</option>
                          <option value="pending">待追赔</option>
                          <option value="claimed">已追赔</option>
                        </select>
                      </div>
                    </div>
                    {damageForm.has_damage && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">货损明细</label>
                          <button type="button"
                            onClick={() => setDamageForm({ ...damageForm, damage_items: [...damageForm.damage_items, { name: '', amount: 0, desc: '' }] })}
                            className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1">
                            <Plus size={12} /> 添加货损物品
                          </button>
                        </div>
                        {damageForm.damage_items.length > 0 && (
                          <div className="space-y-2 mb-2">
                            {damageForm.damage_items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <FieldSelect fieldName="damage_item_name" label="物品名称"
                                  value={item.name}
                                  onChange={v => { const updated = [...damageForm.damage_items]; updated[idx] = { ...updated[idx], name: v }; setDamageForm({ ...damageForm, damage_items: updated }) }}
                                  onOptionSelect={opt => {
                                    if (opt.price) {
                                      const updated = [...damageForm.damage_items]
                                      updated[idx] = { ...updated[idx], name: opt.value, amount: opt.price }
                                      setDamageForm({ ...damageForm, damage_items: updated })
                                    }
                                  }}
                                  placeholder="物品名称" showGear={hasPermission('field_options:manage')} showPrice />
                                <input type="number" step="0.01" min="0" value={item.amount}
                                  onChange={e => { const updated = [...damageForm.damage_items]; updated[idx] = { ...updated[idx], amount: parseFloat(e.target.value) || 0 }; setDamageForm({ ...damageForm, damage_items: updated }) }}
                                  placeholder="金额" className="w-24 border rounded-lg px-3 py-2 text-sm" style={{ borderColor: '#e5e5e5' }} />
                                <input type="text" value={item.desc}
                                  onChange={e => { const updated = [...damageForm.damage_items]; updated[idx] = { ...updated[idx], desc: e.target.value }; setDamageForm({ ...damageForm, damage_items: updated }) }}
                                  placeholder="损坏描述" className="flex-1 border rounded-lg px-3 py-2 text-sm" style={{ borderColor: '#e5e5e5' }} />
                                <button type="button"
                                  onClick={() => setDamageForm({ ...damageForm, damage_items: damageForm.damage_items.filter((_, i) => i !== idx) })}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {damageForm.damage_items.length > 0 && (
                          <div className="text-sm text-red-600 text-right font-medium">
                            货损合计: ¥{damageForm.damage_items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="col-span-2 border-t pt-3 mt-1" style={{ borderColor: detailRecord.has_damage ? '#fecaca' : '#e5e7eb' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={detailRecord.has_damage ? 'text-red-600 font-medium' : 'text-gray-500 font-medium'}>
                        货损信息
                      </span>
                      {canEdit && (
                        <button onClick={openDamageEditor}
                          className="px-2.5 py-1 btn-danger text-xs rounded">
                          {detailRecord.has_damage ? '编辑货损' : '登记货损'}
                        </button>
                      )}
                    </div>
                    {detailRecord.has_damage ? (
                      <>
                        <div className="flex items-center gap-2"><span className="text-gray-500">追赔状态：</span>
                          <span className={detailRecord.claim_status === 'claimed' ? 'text-green-600' : detailRecord.claim_status === 'pending' ? 'text-orange-600' : 'text-gray-500'}>
                            {detailRecord.claim_status === 'claimed' ? '已追赔' : detailRecord.claim_status === 'pending' ? '待追赔' : '不需要追赔'}
                          </span>
                          {detailRecord.claim_status === 'pending' && canEdit && (
                            <button onClick={handleMarkClaimed}
                              className="px-2.5 py-1 btn-success text-xs rounded">
                              已追赔
                            </button>
                          )}
                        </div>
                        <div><span className="text-gray-500">货损总额：</span><span className="text-red-600 font-medium">¥{detailRecord.total_damage_amount?.toFixed(2) || '0.00'}</span></div>
                        {detailRecord.damage_items && detailRecord.damage_items.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-gray-500">货损明细：</span>
                            <div className="mt-1 space-y-1">
                              {detailRecord.damage_items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 text-sm">
                                  <span className="text-gray-700">{item.name || '未命名'}</span>
                                  <span className="text-red-500">¥{item.amount?.toFixed(2) || '0.00'}</span>
                                  {item.desc && <span className="text-gray-400">{item.desc}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">暂无货损记录</p>
                    )}
                  </div>
                )}
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
                      className="px-4 py-2 btn-primary text-sm disabled:opacity-50">
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
