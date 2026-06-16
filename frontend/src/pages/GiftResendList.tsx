import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, Eye, Gift, Download } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { getGiftResendList, createGiftResend, updateGiftResend, deleteGiftResend, addGiftResendFeedback, getGiftResendFeedbacks, getGiftResendPresets, createGiftResendPreset, deleteGiftResendPreset, GiftResendPreset } from '../api/giftResend'
import { GiftResendRecord, GiftResendFeedback } from '../types'
import { useAuth } from '../hooks/useAuth'
import ShopSelect from '../components/ShopSelect'
import FieldSelect from '../components/FieldSelect'
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

const emptyForm = {
  apply_date: '', order_no: '', shop_name: '', type: '',
  gift_detail: '', gift_items: [] as { name: string; quantity: number }[],
  customer_info: '', express_company: '',
  tracking_no: '', remark: '',
}

/** 获取本地 YYYY-MM-DD 格式日期字符串 */
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function GiftResendList() {
  const { hasPermission } = useAuth()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef<HTMLTableRowElement | null>(null)
  const [records, setRecords] = useState<GiftResendRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [shopFilter, setShopFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [detailRecord, setDetailRecord] = useState<GiftResendRecord | null>(null)
  const [editRecord, setEditRecord] = useState<GiftResendRecord | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  // 处理记录
  const [feedbacks, setFeedbacks] = useState<GiftResendFeedback[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [addingFeedback, setAddingFeedback] = useState(false)
  // 预设组合
  const [presets, setPresets] = useState<GiftResendPreset[]>([])
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
    getGiftResendList({ page, page_size: pageSize, search, shop_name: shopFilter, start_date: startDate, end_date: endDate })
      .then(data => { setRecords(data.items); setTotal(data.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search, shopFilter, startDate, endDate])

  useEffect(() => { load() }, [load])
  useEffect(() => { getGiftResendPresets().then(setPresets).catch(console.error) }, [])

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
    getGiftResendList({ page: 1, page_size: 100000, search, shop_name: shopFilter, start_date: startDate, end_date: endDate })
      .then(data => {
        const rows = data.items.map((r: GiftResendRecord, idx: number) => ({
          '序号': idx + 1,
          '申请时间': r.apply_date || '',
          '订单编号': r.order_no || '',
          '店铺名称': r.shop_name || '',
          '类型': r.type || '',
          '礼品明细': r.gift_items && r.gift_items.length > 0
            ? r.gift_items.map(g => `${g.name}x${g.quantity}`).join('、')
            : r.gift_detail || '',
          '客户信息': r.customer_info || '',
          '快递公司': r.express_company || '',
          '寄出单号': r.tracking_no || '',
          '备注': r.remark || '',
          '登记人': r.creator_name || '',
          '登记时间': r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '',
        }))
        exportToExcel('礼品补发', rows)
      })
      .catch(console.error)
  }

  const openCreate = () => { setEditRecord(null); setForm({ ...emptyForm, apply_date: todayStr() }); setShowModal(true) }
  const openEdit = (r: GiftResendRecord) => {
    setEditRecord(r)
    setForm({
      apply_date: r.apply_date, order_no: r.order_no, shop_name: r.shop_name,
      type: r.type, gift_detail: r.gift_detail, gift_items: r.gift_items || [],
      customer_info: r.customer_info,
      express_company: r.express_company, tracking_no: r.tracking_no, remark: r.remark,
    })
    setShowDetail(false)
    setShowModal(true)
  }
  const openDetail = (r: GiftResendRecord) => {
    setDetailRecord(r)
    setShowDetail(true)
    setFeedbackText('')
    getGiftResendFeedbacks(r.id)
      .then(data => setFeedbacks(data))
      .catch(console.error)
  }

  const handleSave = () => {
    setSaving(true)
    const promise = editRecord ? updateGiftResend(editRecord.id, form) : createGiftResend(form)
    promise.then((saved) => {
      const newId = saved?.id || editRecord?.id
      const changes: string[] = []
      if (!editRecord) {
        changes.push(`新建礼品补发 #${newId}`)
      } else {
        const old = editRecord
        if (old.apply_date !== form.apply_date) changes.push(`申请时间: ${old.apply_date || '无'} → ${form.apply_date || '无'}`)
        if (old.order_no !== form.order_no) changes.push(`订单编号: ${old.order_no || '无'} → ${form.order_no || '无'}`)
        if (old.shop_name !== form.shop_name) changes.push(`店铺名称: ${old.shop_name || '无'} → ${form.shop_name || '无'}`)
        if (old.tracking_no !== form.tracking_no) changes.push(`寄出单号: ${old.tracking_no || '无'} → ${form.tracking_no || '无'}`)
        if (old.remark !== form.remark) changes.push(`备注: ${old.remark || '无'} → ${form.remark || '无'}`)
        if (changes.length === 0) changes.push(`更新礼品补发 #${newId}（无字段变更）`)
      }
      const content = editRecord ? changes.join('；') : `新建礼品补发 #${newId}`
      if (newId !== undefined) {
        addGiftResendFeedback(newId, content).catch(console.error)
      }
      setShowModal(false)
      load()
    })
      .catch(console.error).finally(() => setSaving(false))
  }

  const handleDelete = (id: number) => {
    if (!confirm('确认删除这条补发记录？')) return
    deleteGiftResend(id).then(load).catch(console.error)
  }

  const handleAddFeedback = () => {
    if (!detailRecord || !feedbackText.trim()) return
    setAddingFeedback(true)
    addGiftResendFeedback(detailRecord.id, feedbackText.trim())
      .then(fb => {
        setFeedbacks(prev => [...prev, fb])
        setFeedbackText('')
      })
      .catch(console.error)
      .finally(() => setAddingFeedback(false))
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <>
      <style>{highlightStyle}</style>
      <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">礼品补发登记</h2>
          <p className="text-sm text-gray-500 mt-0.5">礼品补发记录管理，共 {total} 条</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} /> 新建补发
        </button>
      </div>

      <div className="flex flex-wrap gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400" />
          <input className="flex-1 text-sm outline-none bg-transparent"
            placeholder="搜索订单号、店铺、客户信息..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="min-w-[140px]">
          <ShopSelect value={shopFilter} onChange={v => { setShopFilter(v); setPage(1) }} showGear={false} placeholder="全部店铺" />
        </div>
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} />
        <span className="text-gray-400 self-center">-</span>
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} />
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
                {['#', '申请时间', '订单编号', '店铺名称', '类型', '礼品明细', '客户信息', '快递公司', '寄出单号', '操作'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400">加载中...</td></tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-gray-400">
                    <Gift size={32} className="mx-auto mb-2 opacity-30" />
                    <p>暂无补发记录</p>
                  </td>
                </tr>
              ) : records.map(r => (
                <tr
                  key={r.id}
                  ref={r.id.toString() === highlightId ? highlightRef : undefined}
                  className={`hover:bg-gray-50 transition-colors ${r.id.toString() === highlightId ? 'highlight-row' : ''}`}
                  style={r.id.toString() === highlightId ? { animation: 'highlight-flash 3s ease-out' } : {}}
                >
                  <td className="px-4 py-3 text-gray-400 font-mono">#{r.id}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.apply_date || '-'}</td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs max-w-28 truncate">{r.order_no || '-'}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-28 truncate">{r.shop_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.type || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-36 truncate">{
                    r.gift_items && r.gift_items.length > 0
                      ? r.gift_items.map(g => `${g.name}x${g.quantity}`).join('、')
                      : r.gift_detail || '-'
                  }</td>
                  <td className="px-4 py-3 text-gray-600 max-w-36 truncate">{r.customer_info || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.express_company || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{r.tracking_no || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openDetail(r)} className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors" title="查看详情"><Eye size={14} /></button>
                      <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-emerald-50 text-emerald-500 rounded-lg transition-colors" title="编辑"><Edit2 size={14} /></button>
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
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100"><ChevronLeft size={16} /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {showDetail && detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">补发记录详情 #{detailRecord.id}</h3>
              <button onClick={() => setShowDetail(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="申请时间" value={detailRecord.apply_date} />
                <DetailItem label="订单编号" value={detailRecord.order_no} mono />
                <DetailItem label="店铺名称" value={detailRecord.shop_name} />
                <DetailItem label="类型" value={detailRecord.type} />
                <DetailItem label="快递公司" value={detailRecord.express_company} />
                <DetailItem label="寄出单号" value={detailRecord.tracking_no} mono />
              </div>
              {detailRecord.gift_items && detailRecord.gift_items.length > 0 ? (
                <div>
                  <span className="text-xs text-gray-500">礼品明细</span>
                  <div className="mt-1 border border-gray-100 rounded-lg divide-y divide-gray-50">
                    {detailRecord.gift_items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-gray-700">{item.name || '未命名'}</span>
                        <span className="text-gray-500">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-400 text-right mt-1">
                    共 {detailRecord.gift_items.reduce((sum, item) => sum + item.quantity, 0)} 件
                  </div>
                </div>
              ) : (
                <DetailItem label="礼品明细" value={detailRecord.gift_detail} full />
              )}
              <DetailItem label="客户信息" value={detailRecord.customer_info} full />
              <DetailItem label="备注" value={detailRecord.remark} full />
              <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                <span>登记人：{detailRecord.creator_name}</span>
                <span>{detailRecord.created_at?.slice(0, 16).replace('T', ' ')}</span>
              </div>

              {/* 处理记录区域 */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">处理记录</h4>
                {feedbacks.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">暂无处理记录</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {feedbacks.map(fb => (
                      <div key={fb.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-medium">
                          {fb.user_name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-gray-800">{fb.user_name}</span>
                            <span className="text-xs text-gray-400">{fb.created_at ? fb.created_at.slice(0, 16).replace('T', ' ') : ''}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5 break-words">{fb.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="添加处理记录..."
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddFeedback()}
                  />
                  <button
                    onClick={handleAddFeedback}
                    disabled={addingFeedback || !feedbackText.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                    {addingFeedback ? '...' : '记录'}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => { setShowDetail(false); openEdit(detailRecord) }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
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

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">{editRecord ? '编辑补发记录' : '新建礼品补发'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <F label="申请时间" value={form.apply_date} s={v => setForm(f => ({ ...f, apply_date: v }))} type="date" />
                <F label="订单编号" value={form.order_no} s={v => setForm(f => ({ ...f, order_no: v }))} />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">店铺名称</label>
                  <ShopSelect value={form.shop_name} onChange={v => setForm(f => ({ ...f, shop_name: v }))} showGear={hasPermission('field_options:manage')} />
                </div>
                <F label="类型" value={form.type} s={v => setForm(f => ({ ...f, type: v }))} />
              </div>
              {/* 礼品明细 */}
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-600">礼品明细</label>
                  <div className="flex items-center gap-2">
                    {presets.length > 0 && (
                      <div className="relative">
                        <button type="button"
                          onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                          className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1 border border-gray-200 rounded px-2 py-1 hover:border-emerald-300">
                          预设组合 <ChevronDown size={12} />
                        </button>
                        {showPresetDropdown && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-48 max-h-48 overflow-y-auto">
                            {presets.map(p => (
                              <div key={p.id} className="flex items-center justify-between px-3 py-2 hover:bg-emerald-50 group">
                                <button type="button"
                                  onClick={() => {
                                    setForm(f => ({ ...f, gift_items: p.items.map(i => ({ ...i })) }))
                                    setShowPresetDropdown(false)
                                  }}
                                  className="flex-1 text-left text-sm text-gray-700 hover:text-emerald-700">
                                  {p.name}
                                  <span className="text-xs text-gray-400 ml-1">({p.items.length}项)</span>
                                </button>
                                <button type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    if (!confirm(`删除预设「${p.name}」？`)) return
                                    await deleteGiftResendPreset(p.id)
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
                    {form.gift_items.length > 0 && (
                      <button type="button"
                        onClick={() => { setShowSavePreset(true); setPresetName('') }}
                        className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1">
                        保存预设
                      </button>
                    )}
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, gift_items: [...f.gift_items, { name: '', quantity: 1 }] }))}
                      className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                      <Plus size={12} /> 添加礼品
                    </button>
                  </div>
                </div>
                {form.gift_items.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {form.gift_items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex-1">
                          <FieldSelect fieldName="gift_name" label="礼品名称"
                            value={item.name}
                            onChange={v => {
                              const updated = [...form.gift_items]
                              updated[idx] = { ...updated[idx], name: v }
                              setForm(f => ({ ...f, gift_items: updated }))
                            }}
                            onOptionSelect={opt => {
                              if (opt.price) {
                                const updated = [...form.gift_items]
                                updated[idx] = { ...updated[idx], name: opt.value }
                                setForm(f => ({ ...f, gift_items: updated }))
                              }
                            }}
                            placeholder="请选择或输入礼品名称"
                            showGear={hasPermission('field_options:manage')} />
                        </div>
                        <input type="number" min="1" value={item.quantity}
                          onChange={e => {
                            const updated = [...form.gift_items]
                            updated[idx] = { ...updated[idx], quantity: parseInt(e.target.value) || 1 }
                            setForm(f => ({ ...f, gift_items: updated }))
                          }}
                          placeholder="数量"
                          className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        <button type="button"
                          onClick={() => setForm(f => ({ ...f, gift_items: f.gift_items.filter((_, i) => i !== idx) }))}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {form.gift_items.length > 0 && (
                  <div className="text-xs text-gray-500 text-right">
                    共 {form.gift_items.reduce((sum, item) => sum + item.quantity, 0)} 件
                  </div>
                )}
              </div>
              <F label="客户信息" value={form.customer_info} s={v => setForm(f => ({ ...f, customer_info: v }))} placeholder="姓名 / 手机号 / 地址" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">快递公司</label>
                  <FieldSelect fieldName="express_company" label="快递公司" value={form.express_company} onChange={v => setForm(f => ({ ...f, express_company: v }))} placeholder="请选择或输入快递公司" showGear={hasPermission('field_options:manage')} />
                </div>
                <F label="礼品寄出单号" value={form.tracking_no} s={v => setForm(f => ({ ...f, tracking_no: v }))} />
              </div>
              <F label="备注" value={form.remark} s={v => setForm(f => ({ ...f, remark: v }))} />
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
                {saving ? '保存中...' : '保存'}
              </button>
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
                  createGiftResendPreset({ name: presetName.trim(), items: form.gift_items }).then(p => {
                    setPresets(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)))
                    setShowSavePreset(false)
                  })
                }
              }}
              placeholder="输入组合名称，如：标准三件套"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4" />
            <div className="text-xs text-gray-500 mb-4">
              将保存 {form.gift_items.length} 项礼品：
              {form.gift_items.map((g, i) => (
                <span key={i} className="ml-1 text-gray-700">{g.name}{g.quantity > 1 ? `x${g.quantity}` : ''}{i < form.gift_items.length - 1 ? '、' : ''}</span>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSavePreset(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">
                取消
              </button>
              <button onClick={() => {
                if (!presetName.trim()) return
                createGiftResendPreset({ name: presetName.trim(), items: form.gift_items }).then(p => {
                  setPresets(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)))
                  setShowSavePreset(false)
                })
              }}
                disabled={!presetName.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-40">
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

function DetailItem({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean }) {
  return (
    <div className={`${full ? 'col-span-2' : ''} min-w-0`}>
      <span className="text-xs text-gray-400 block">{label}</span>
      <span className={`text-sm text-gray-800 break-words ${mono ? 'font-mono' : ''}`}>{value || '-'}</span>
    </div>
  )
}

function F({ label, value, s, placeholder, type }: { label: string; value: string; s: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <input type={type || 'text'}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-100"
        value={value} onChange={e => s(e.target.value)} placeholder={placeholder} />
    </div>
  )
}
