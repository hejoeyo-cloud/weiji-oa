import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, Eye, Download, Settings } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { getGiftList, getGiftDetail, createGift, updateGift, deleteGift, addGiftFeedback, getGiftFeedbacks, getGiftPresets, createGiftPreset, deleteGiftPreset, GiftPreset } from '../api/gifts'
import { getShops, createShop as apiCreateShop, deleteShop as apiDeleteShop, Shop } from '../api/shops'
import { useAuth } from '../hooks/useAuth'
import ShopSelect from '../components/ShopSelect'
import FieldSelect from '../components/FieldSelect'
import { GiftRecord, GiftFeedback } from '../types'
import * as XLSX from 'xlsx'

/** 通用 Excel 导出（浏览器端） */
function exportToExcel(filename: string, rows: Record<string, any>[]) {
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

const STATUSES = [
  { value: 'pending', label: '待发货', color: 'bg-amber-100 text-amber-700' },
  { value: 'sent', label: '已发出', color: 'bg-blue-100 text-blue-700' },
  { value: 'intercepted', label: '已拦截', color: 'bg-red-100 text-red-700' },
  { value: 'torn', label: '已撕单', color: 'bg-gray-100 text-gray-700' },
  { value: 'cancelled', label: '已取消', color: 'bg-stone-100 text-stone-600' },
]

function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find(x => x.value === status) || STATUSES[0]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
}

const emptyForm = {
  date: '', shop_id: null as number | null, shop_name: '', order_no: '', product: '', size: '', model: '', config: '', color: '',
  quantity: 1, accessories: '', customer_info: '', send_tracking: '',
  shipping_fee: 0, order_amount: 0, cost: 0, gift_costs: [] as { name: string; amount: number }[],
  remark: '', ship_date: '', status: 'pending',
}

/** 获取本地 YYYY-MM-DD 格式日期字符串 */
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function GiftList() {
  const { user, hasPermission } = useAuth()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef<HTMLTableRowElement | null>(null)
  const canCostView = hasPermission('gifts:cost_view')
  const canCreate = hasPermission('gifts:create')
  const canEdit = hasPermission('gifts:edit')
  const canDelete = hasPermission('gifts:delete')

  const [records, setRecords] = useState<GiftRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [detailRecord, setDetailRecord] = useState<GiftRecord | null>(null)
  const [editRecord, setEditRecord] = useState<GiftRecord | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  // 处理记录
  const [feedbacks, setFeedbacks] = useState<GiftFeedback[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [addingFeedback, setAddingFeedback] = useState(false)
  // 店铺
  const [shops, setShops] = useState<Shop[]>([])
  const [showShopModal, setShowShopModal] = useState(false)
  const [newShopName, setNewShopName] = useState('')
  const [presets, setPresets] = useState<GiftPreset[]>([])
  const [showPresetDropdown, setShowPresetDropdown] = useState(false)
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [presetName, setPresetName] = useState('')
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

  const load = useCallback(() => {
    setLoading(true)
    getGiftList({ page, page_size: pageSize, search, status: statusFilter, start_date: startDate, end_date: endDate })
      .then(data => { setRecords(data.items); setTotal(data.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search, statusFilter, startDate, endDate])

  useEffect(() => { load() }, [load])

  useEffect(() => { getShops().then(setShops).catch(console.error) }, [])
  useEffect(() => { getGiftPresets().then(setPresets).catch(console.error) }, [])

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

  const handleExport = () => {
    getGiftList({ page: 1, page_size: 100000, search, status: statusFilter, start_date: startDate, end_date: endDate })
      .then(data => {
        const exportData: Record<string, any>[] = data.items.map((r: GiftRecord, idx: number) => {
          const row: Record<string, any> = {
            '序号': idx + 1,
            '日期': r.date || '',
            '店铺': r.shop_name || '',
            '订单编号': r.order_no || '',
            '型号': r.model || '',
            '配置': r.config || '',
            '尺寸': r.size || '',
            '颜色': r.color || '',
            '数量': r.quantity || '',
            '配件': r.accessories || '',
            '客户信息': r.customer_info || '',
            '发出单号': r.send_tracking || '',
            '出货日期': r.ship_date || '',
            '返现金额': r.total_cashback || 0,
            '运费': r.shipping_fee || 0,
            '状态': r.status || '',
            '备注': r.remark || '',
            '登记人': r.creator_name || '',
            '登记时间': r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '',
          }
          // 有成本查看权限时才导出财务数据
          if (canCostView) {
            row['订单金额'] = r.order_amount || 0
            row['产品成本'] = r.cost || 0
            row['毛利'] = r.profit || 0
          }
          return row
        })
        exportToExcel('发货登记', exportData)
      })
      .catch(console.error)
  }

  const openCreate = () => { setEditRecord(null); setForm({ ...emptyForm, date: todayStr() }); setShowModal(true) }
  const openEdit = (r: GiftRecord) => {
    setEditRecord(r)
    setForm({
      date: r.date, shop_id: r.shop_id || null, shop_name: r.shop_name || '', order_no: r.order_no, product: r.product || '', size: r.size, model: r.model,
      config: r.config, color: r.color, quantity: r.quantity,
      accessories: r.accessories, customer_info: r.customer_info,
      send_tracking: r.send_tracking, shipping_fee: r.shipping_fee,
      order_amount: r.order_amount, cost: r.cost,
      gift_costs: r.gift_costs || [],
      remark: r.remark, ship_date: r.ship_date, status: r.status,
    })
    setShowDetail(false)
    setShowModal(true)
  }
  const openDetail = (r: GiftRecord) => {
    setDetailRecord(r)
    setShowDetail(true)
    setFeedbackText('')
    getGiftFeedbacks(r.id)
      .then(data => setFeedbacks(data))
      .catch(console.error)
  }

  const handleSave = () => {
    setSaving(true)
    const submitData = {
      ...form,
      status: form.status || (form.send_tracking?.trim() ? 'sent' : 'pending'),
      ship_date: form.ship_date || (form.send_tracking?.trim() ? todayStr() : ''),
    }
    const promise = editRecord ? updateGift(editRecord.id, submitData) : createGift(submitData)
    promise.then((saved) => {
      const newId = saved?.id || editRecord?.id
      const changes: string[] = []
      if (!editRecord) {
        changes.push(`新建发货登记 #${newId}`)
      } else {
        const old = editRecord
        if (old.date !== form.date) changes.push(`日期: ${old.date || '无'} → ${form.date || '无'}`)
        if (old.shop_name !== form.shop_name) changes.push(`店铺: ${old.shop_name || '无'} → ${form.shop_name || '无'}`)
        if (old.order_no !== form.order_no) changes.push(`订单编号: ${old.order_no || '无'} → ${form.order_no || '无'}`)
        if (old.send_tracking !== form.send_tracking) changes.push(`发出单号: ${old.send_tracking || '无'} → ${form.send_tracking || '无'}`)
        if (old.ship_date !== form.ship_date) changes.push(`出货日期: ${old.ship_date || '无'} → ${form.ship_date || '无'}`)
        if (old.remark !== form.remark) changes.push(`备注: ${old.remark || '无'} → ${form.remark || '无'}`)
        if (old.status !== form.status) {
          const oldLabel = STATUSES.find(s => s.value === old.status)?.label || old.status
          const newLabel = STATUSES.find(s => s.value === form.status)?.label || form.status
          changes.push(`状态: ${oldLabel} → ${newLabel}`)
        }
        if (changes.length === 0) changes.push(`更新发货登记 #${newId}（无字段变更）`)
      }
      const content = editRecord ? changes.join('；') : `新建发货登记 #${newId}`
      if (newId !== undefined) {
        addGiftFeedback(newId, content).catch(console.error)
      }
      setShowModal(false)
      load()
    })
      .catch(console.error).finally(() => setSaving(false))
  }

  const handleDelete = (id: number) => {
    if (!confirm('确认删除这条发货记录？')) return
    deleteGift(id).then(load).catch(console.error)
  }

  const handleIntercept = () => {
    if (!detailRecord) return
    if (!confirm('确认拦截此快递？拦截后状态将变为"已拦截"')) return
    const oldLabel = STATUSES.find(s => s.value === detailRecord.status)?.label || detailRecord.status
    updateGift(detailRecord.id, { status: 'intercepted' })
      .then(() => {
        addGiftFeedback(detailRecord.id, `拦截快递，状态: ${oldLabel} → 已拦截`).catch(console.error)
        return getGiftDetail(detailRecord.id)
      })
      .then(fresh => {
        setDetailRecord(fresh)
        load()
      })
      .catch(console.error)
  }

  const handleTorn = () => {
    if (!detailRecord) return
    if (!confirm('确认撕单？撕单后状态将变为"已撕单"')) return
    const oldLabel = STATUSES.find(s => s.value === detailRecord.status)?.label || detailRecord.status
    updateGift(detailRecord.id, { status: 'torn' })
      .then(() => {
        addGiftFeedback(detailRecord.id, `撕单，状态: ${oldLabel} → 已撕单`).catch(console.error)
        return getGiftDetail(detailRecord.id)
      })
      .then(fresh => {
        setDetailRecord(fresh)
        load()
      })
      .catch(console.error)
  }

  const handleCancel = () => {
    if (!detailRecord) return
    if (!confirm('确认取消此订单？取消后状态将变为"已取消"')) return
    const oldLabel = STATUSES.find(s => s.value === detailRecord.status)?.label || detailRecord.status
    updateGift(detailRecord.id, { status: 'cancelled' })
      .then(() => {
        addGiftFeedback(detailRecord.id, `取消订单，状态: ${oldLabel} → 已取消`).catch(console.error)
        return getGiftDetail(detailRecord.id)
      })
      .then(fresh => {
        setDetailRecord(fresh)
        load()
      })
      .catch(console.error)
  }

  const handleAddFeedback = () => {
    if (!detailRecord || !feedbackText.trim()) return
    setAddingFeedback(true)
    addGiftFeedback(detailRecord.id, feedbackText.trim())
      .then(fb => {
        setFeedbacks(prev => [...prev, fb])
        setFeedbackText('')
      })
      .catch(console.error)
      .finally(() => setAddingFeedback(false))
  }

  const handleAddShop = () => {
    if (!newShopName.trim()) return
    apiCreateShop({ name: newShopName.trim() })
      .then(shop => { setShops(prev => [...prev, shop]); setNewShopName('') })
      .catch(console.error)
  }

  const handleDeleteShop = (id: number) => {
    if (!confirm('确认删除此店铺？')) return
    apiDeleteShop(id).then(() => setShops(prev => prev.filter(s => s.id !== id))).catch(console.error)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <>
      <style>{highlightStyle}</style>
      <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">发货登记</h2>
          <p className="text-sm text-gray-500 mt-0.5">产品发货记录管理，共 {total} 条</p>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={16} /> 新建登记
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="搜索订单号/型号/客户信息..."
            className="flex-1 outline-none text-sm"
          />
        </div>
        <select value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input type="date" value={startDate}
          onChange={e => { setStartDate(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <span className="self-center text-gray-400">至</span>
        <input type="date" value={endDate}
          onChange={e => { setEndDate(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <button onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm rounded-lg transition-colors">
          <Download size={14} /> 导出
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">日期</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">店铺</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">订单编号</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">型号/配置</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">颜色</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">数量</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">客户信息</th>
              {canCostView && (
                <>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">订单金额</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">成本</th>
                </>
              )}
              <th className="text-left px-4 py-3 font-medium text-gray-600">返现</th>
              {canCostView && (
                <th className="text-left px-4 py-3 font-medium text-gray-600">毛利</th>
              )}
              <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={canCostView ? 14 : 11} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={canCostView ? 14 : 11} className="text-center py-8 text-gray-400">暂无数据</td></tr>
            ) : records.map((r, idx) => (
              <tr
                key={r.id}
                ref={r.id.toString() === highlightId ? highlightRef : undefined}
                className={`hover:bg-gray-50 ${r.id.toString() === highlightId ? 'highlight-row' : ''}`}
                style={r.id.toString() === highlightId ? { animation: 'highlight-flash 3s ease-out' } : {}}
              >
                <td className="px-4 py-3 text-gray-400">{(page - 1) * pageSize + idx + 1}</td>
                <td className="px-4 py-3 text-gray-600">{r.date || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{r.shop_name || '-'}</td>
                <td className="px-4 py-3 font-medium">{r.order_no || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{r.model || '-'}{r.config ? ` / ${r.config}` : ''}</td>
                <td className="px-4 py-3">{r.color || '-'}</td>
                <td className={`px-4 py-3 font-bold ${r.quantity > 1 ? 'text-red-600 bg-red-50 rounded' : ''}`}>{r.quantity || 1}</td>
                <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">{r.customer_info || '-'}</td>
                {canCostView && (
                  <>
                    <td className="px-4 py-3 text-gray-600">{r.order_amount > 0 ? `¥${r.order_amount.toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-3 text-orange-500">{(r.cost + r.total_gift_cost) > 0 ? `¥${(r.cost + r.total_gift_cost).toFixed(2)}` : '-'}</td>
                  </>
                )}
                <td className="px-4 py-3 text-red-500">{r.total_cashback > 0 ? `¥${r.total_cashback.toFixed(2)}` : '-'}</td>
                {canCostView && (
                  <td className={`px-4 py-3 font-medium ${r.profit > 0 ? 'text-green-600' : r.profit < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {r.profit > 0 ? `¥${r.profit.toFixed(2)}` : r.profit < 0 ? `-¥${Math.abs(r.profit).toFixed(2)}` : '-'}
                  </td>
                )}
                <td className="px-4 py-3"><StatusBadge status={r.status || (r.send_tracking ? 'sent' : 'pending')} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openDetail(r)} className={`p-1 rounded ${r.remark ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-gray-400 hover:text-violet-600'}`} title={r.remark ? `备注: ${r.remark}` : '查看详情'}><Eye size={14} /></button>
                    {canEdit && <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-violet-600"><Edit2 size={14} /></button>}
                    {canDelete && <button onClick={() => handleDelete(r.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-gray-600">第 {page} / {totalPages} 页</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">{editRecord ? '编辑发货' : '新建发货'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                  <input type="date" value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    店铺
                    <button type="button" onClick={() => setShowShopModal(true)}
                      className="ml-1.5 text-gray-400 hover:text-violet-500 align-middle transition-colors">
                      <Settings size={12} />
                    </button>
                  </label>
                  <select value={form.shop_id || ''}
                    onChange={e => {
                      const id = e.target.value ? parseInt(e.target.value) : null
                      const shop = shops.find(s => s.id === id)
                      setForm({ ...form, shop_id: id, shop_name: shop?.name || '' })
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">请选择店铺</option>
                    {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">订单编号</label>
                  <input value={form.order_no}
                    onChange={e => setForm({ ...form, order_no: e.target.value })}
                    placeholder="请输入订单编号"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">产品</label>
                  <FieldSelect
                    fieldName="product"
                    label="产品"
                    value={form.product}
                    onChange={v => setForm({ ...form, product: v })}
                    placeholder="请选择产品"
                    showGear={hasPermission('field_options:manage')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">型号</label>
                  <FieldSelect
                    fieldName="model"
                    label="型号"
                    value={form.model}
                    onChange={v => setForm({ ...form, model: v })}
                    placeholder="请选择型号"
                    showGear={hasPermission('field_options:manage')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">配置</label>
                  <FieldSelect
                    fieldName="config"
                    label="配置"
                    value={form.config}
                    onChange={v => setForm({ ...form, config: v })}
                    placeholder="请选择配置"
                    showGear={hasPermission('field_options:manage')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">尺寸</label>
                  <FieldSelect
                    fieldName="size"
                    label="尺寸"
                    value={form.size}
                    onChange={v => setForm({ ...form, size: v })}
                    placeholder="请选择尺寸"
                    showGear={hasPermission('field_options:manage')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">颜色</label>
                  <FieldSelect
                    fieldName="color"
                    label="颜色"
                    value={form.color}
                    onChange={v => setForm({ ...form, color: v })}
                    placeholder="请选择颜色"
                    showGear={hasPermission('field_options:manage')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                  <input type="number" min="1"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">配件</label>
                  <FieldSelect
                    fieldName="accessories"
                    label="配件"
                    value={form.accessories}
                    onChange={v => setForm({ ...form, accessories: v })}
                    placeholder="请选择配件"
                    showGear={hasPermission('field_options:manage')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">客户信息</label>
                <textarea value={form.customer_info}
                  onChange={e => setForm({ ...form, customer_info: e.target.value })}
                  rows={2}
                  placeholder="姓名/电话/地址"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">发出单号</label>
                  <input value={form.send_tracking}
                    onChange={e => {
                      const tracking = e.target.value
                      setForm({ ...form, send_tracking: tracking, status: tracking ? 'sent' : 'pending' })
                    }}
                    placeholder="请输入快递单号"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">运费</label>
                  <input type="number" step="0.01" min="0"
                    value={form.shipping_fee}
                    onChange={e => setForm({ ...form, shipping_fee: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* 财务信息区域 - 仅成本查看权限可见 */}
              {canCostView && (
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-800 mb-3">财务信息</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">订单金额</label>
                      <input type="number" step="0.01" min="0"
                        value={form.order_amount}
                        onChange={e => setForm({ ...form, order_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">产品成本</label>
                      <input type="number" step="0.01" min="0"
                        value={form.cost}
                        onChange={e => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                  </div>

                  {/* 礼品成本 */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">礼品成本</label>
                      <div className="flex items-center gap-2">
                        {presets.length > 0 && (
                          <div className="relative">
                            <button type="button"
                              onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                              className="text-xs text-gray-500 hover:text-violet-600 flex items-center gap-1 border border-gray-200 rounded px-2 py-1 hover:border-violet-300">
                              预设组合 <ChevronDown size={12} />
                            </button>
                            {showPresetDropdown && (
                              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-48 max-h-48 overflow-y-auto">
                                {presets.map(p => (
                                  <div key={p.id} className="flex items-center justify-between px-3 py-2 hover:bg-violet-50 group">
                                    <button type="button"
                                      onClick={() => {
                                        setForm({ ...form, gift_costs: p.items.map(i => ({ ...i })) })
                                        setShowPresetDropdown(false)
                                      }}
                                      className="flex-1 text-left text-sm text-gray-700 hover:text-violet-700">
                                      {p.name}
                                      <span className="text-xs text-gray-400 ml-1">({p.items.length}项)</span>
                                    </button>
                                    <button type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        if (!confirm(`删除预设「${p.name}」？`)) return
                                        await deleteGiftPreset(p.id)
                                        setPresets(prev => prev.filter(x => x.id !== p.id))
                                      }}
                                      className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {form.gift_costs.length > 0 && (
                          <button type="button"
                            onClick={() => { setShowSavePreset(true); setPresetName('') }}
                            className="text-xs text-gray-500 hover:text-violet-600 flex items-center gap-1">
                            保存预设
                          </button>
                        )}
                        <button type="button"
                          onClick={() => setForm({ ...form, gift_costs: [...form.gift_costs, { name: '', amount: 0 }] })}
                          className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1">
                          <Plus size={12} /> 添加礼品
                        </button>
                      </div>
                    </div>
                    {form.gift_costs.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {form.gift_costs.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="flex-1">
                              <FieldSelect
                                fieldName="gift_name"
                                label="礼品名称"
                                value={item.name}
                                onChange={v => {
                                  const updated = [...form.gift_costs]
                                  updated[idx] = { ...updated[idx], name: v }
                                  setForm({ ...form, gift_costs: updated })
                                }}
                                onOptionSelect={opt => {
                                  if (opt.price) {
                                    const updated = [...form.gift_costs]
                                    updated[idx] = { ...updated[idx], name: opt.value, amount: opt.price }
                                    setForm({ ...form, gift_costs: updated })
                                  }
                                }}
                                placeholder="请选择或输入礼品名称"
                                showGear={hasPermission('field_options:manage')}
                                showPrice
                              />
                            </div>
                            <input type="number" step="0.01" min="0"
                              value={item.amount}
                              onChange={e => {
                                const updated = [...form.gift_costs]
                                updated[idx] = { ...updated[idx], amount: parseFloat(e.target.value) || 0 }
                                setForm({ ...form, gift_costs: updated })
                              }}
                              placeholder="金额"
                              className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                            <button type="button"
                              onClick={() => setForm({ ...form, gift_costs: form.gift_costs.filter((_, i) => i !== idx) })}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {form.gift_costs.length > 0 && (
                      <div className="text-sm text-gray-500 text-right">
                        礼品合计: <span className="font-medium text-gray-700">¥{form.gift_costs.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea value={form.remark}
                  onChange={e => setForm({ ...form, remark: e.target.value })}
                  rows={2}
                  placeholder="备注信息"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">
                取消
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {showDetail && detailRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">发货详情 #{detailRecord.id}</h3>
              <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><span className="text-gray-500">日期：</span><span className="font-medium">{detailRecord.date || '-'}</span></div>
              <div><span className="text-gray-500">店铺：</span><span className="font-medium">{detailRecord.shop_name || '-'}</span></div>
              <div><span className="text-gray-500">订单编号：</span><span className="font-medium">{detailRecord.order_no || '-'}</span></div>
              <div><span className="text-gray-500">产品：</span>{detailRecord.product || '-'}</div>
              <div><span className="text-gray-500">型号：</span>{detailRecord.model || '-'}</div>
              <div><span className="text-gray-500">配置：</span>{detailRecord.config || '-'}</div>
              <div><span className="text-gray-500">尺寸：</span>{detailRecord.size || '-'}</div>
              <div><span className="text-gray-500">颜色：</span>{detailRecord.color || '-'}</div>
              <div><span className="text-gray-500">数量：</span><span className={detailRecord.quantity > 1 ? 'text-red-600 font-bold' : ''}>{detailRecord.quantity || 1}{detailRecord.quantity > 1 ? ' (多件)' : ''}</span></div>
              <div><span className="text-gray-500">配件：</span>{detailRecord.accessories || '-'}</div>
              <div className="col-span-2"><span className="text-gray-500">客户信息：</span>{detailRecord.customer_info || '-'}</div>
              <div><span className="text-gray-500">发出单号：</span>{detailRecord.send_tracking || '-'}</div>
              <div><span className="text-gray-500">出货日期：</span>{detailRecord.ship_date || '-'}</div>
              <div><span className="text-gray-500">运费：</span>¥{detailRecord.shipping_fee?.toFixed(2) || '0.00'}</div>
              {canCostView && detailRecord.order_amount > 0 && (
                <div><span className="text-gray-500">订单金额：</span><span className="text-gray-700">¥{detailRecord.order_amount?.toFixed(2)}</span></div>
              )}
              {canCostView && detailRecord.cost > 0 && (
                <div><span className="text-gray-500">产品成本：</span><span className="text-orange-500">¥{detailRecord.cost?.toFixed(2)}</span></div>
              )}
              {canCostView && detailRecord.gift_costs && detailRecord.gift_costs.length > 0 && (
                <div className="col-span-2">
                  <span className="text-gray-500">礼品成本：</span>
                  <div className="mt-1 space-y-1">
                    {detailRecord.gift_costs.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">{item.name || '未命名'}</span>
                        <span className="text-orange-500">¥{item.amount?.toFixed(2) || '0.00'}</span>
                      </div>
                    ))}
                    <div className="text-sm font-medium text-gray-700 pt-1 border-t border-gray-100">
                      礼品合计: ¥{detailRecord.total_gift_cost?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                </div>
              )}
              {detailRecord.total_cashback > 0 && (
                <div><span className="text-gray-500">返现金额：</span><span className="text-red-500">-¥{detailRecord.total_cashback?.toFixed(2)}</span></div>
              )}
              {canCostView && detailRecord.profit !== undefined && (
                <div>
                  <span className="text-gray-500">毛利：</span>
                  <span className={detailRecord.profit > 0 ? 'text-green-600' : detailRecord.profit < 0 ? 'text-red-600' : 'text-gray-500'}>
                    {detailRecord.profit > 0 ? `¥${detailRecord.profit.toFixed(2)}` : detailRecord.profit < 0 ? `-¥${Math.abs(detailRecord.profit).toFixed(2)}` : '-'}
                  </span>
                </div>
              )}
              <div className="col-span-2 flex items-center gap-2">
                <span className="text-gray-500">状态：</span>
                <StatusBadge status={detailRecord.status || (detailRecord.send_tracking ? 'sent' : 'pending')} />
                {detailRecord.status === 'sent' && (
                  <>
                    <button onClick={handleIntercept}
                      className="px-2.5 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
                      拦截快递
                    </button>
                    <button onClick={handleTorn}
                      className="px-2.5 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700">
                      撕单
                    </button>
                    <button onClick={handleCancel}
                      className="px-2.5 py-1 bg-stone-500 text-white rounded text-xs hover:bg-stone-600">
                      取消订单
                    </button>
                  </>
                )}
              </div>
              <div className="col-span-2"><span className="text-gray-500">备注：</span>{detailRecord.remark || '-'}</div>
              <div className="col-span-2"><span className="text-gray-500">登记人：</span>{detailRecord.creator_name || '-'}</div>
              <div className="col-span-2"><span className="text-gray-500">登记时间：</span>{detailRecord.created_at ? detailRecord.created_at.slice(0, 16).replace('T', ' ') : '-'}</div>
            </div>

            {/* 处理记录 */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-800 mb-3">处理记录</h4>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {feedbacks.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">暂无处理记录</p>
                ) : feedbacks.map(fb => (
                  <div key={fb.id} className="flex gap-3">
                    <div className="w-20 text-xs text-gray-400 pt-1">{fb.created_at?.slice(0, 16).replace('T', ' ')}</div>
                    <div className="flex-1">
                      <span className="text-xs text-violet-600 font-medium">{fb.user_name}</span>
                      <p className="text-sm text-gray-600">{fb.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <input
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddFeedback()}
                  placeholder="输入处理记录，回车发送..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                <button onClick={handleAddFeedback} disabled={addingFeedback || !feedbackText.trim()}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm disabled:opacity-50">
                  发送
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowDetail(false); openEdit(detailRecord) }}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm">
                编辑
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 店铺管理弹窗 */}
      {showShopModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">管理店铺</h3>
              <button onClick={() => setShowShopModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex gap-2 mb-4">
              <input value={newShopName}
                onChange={e => setNewShopName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddShop()}
                placeholder="输入新店铺名称"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <button onClick={handleAddShop}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm">
                添加
              </button>
            </div>
            <div className="space-y-2">
              {shops.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">暂无店铺</p>
              ) : shops.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">{s.name}</span>
                  <button onClick={() => handleDeleteShop(s.id)}
                    className="text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 保存预设弹窗 */}
      {showSavePreset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-4">保存为预设组合</h3>
            <input value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && presetName.trim()) {
                  createGiftPreset({ name: presetName.trim(), items: form.gift_costs }).then(p => {
                    setPresets(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)))
                    setShowSavePreset(false)
                  })
                }
              }}
              placeholder="输入组合名称，如：标准三件套"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4" />
            <div className="text-xs text-gray-500 mb-4">
              将保存 {form.gift_costs.length} 项礼品：
              {form.gift_costs.map((g, i) => (
                <span key={i} className="ml-1 text-gray-700">{g.name}{g.amount ? `¥${g.amount}` : ''}{i < form.gift_costs.length - 1 ? '、' : ''}</span>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSavePreset(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">
                取消
              </button>
              <button onClick={() => {
                if (!presetName.trim()) return
                createGiftPreset({ name: presetName.trim(), items: form.gift_costs }).then(p => {
                  setPresets(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)))
                  setShowSavePreset(false)
                })
              }}
                disabled={!presetName.trim()}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm disabled:opacity-40">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}