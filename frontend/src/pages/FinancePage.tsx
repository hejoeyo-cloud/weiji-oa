import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight,
  Download, FileText, TrendingUp, TrendingDown, Receipt, AlertTriangle, Eye, Upload, File, Info, Copy, Ban
} from 'lucide-react'
import {
  getInvoiceRequests, createInvoiceRequest, updateInvoiceRequest, deleteInvoiceRequest,
  getSalesInvoices, createSalesInvoice, updateSalesInvoice, deleteSalesInvoice,
  getPurchaseInvoices, createPurchaseInvoice, updatePurchaseInvoice, deletePurchaseInvoice,
  getExpenseInvoices, createExpenseInvoice, updateExpenseInvoice, deleteExpenseInvoice,
  getFinanceStats, uploadInvoiceFile,
} from '../api/finance'
import { useAuth } from '../hooks/useAuth'
import ShopSelect from '../components/ShopSelect'
import * as XLSX from 'xlsx'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fileUrlWithToken(url: string): string {
  if (!url) return url
  const token = localStorage.getItem('token')
  if (!token) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}token=${token}`
}

function fmtMoney(v: number | undefined) {
  if (v === undefined || v === null) return '0.00'
  return v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function exportToExcel(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) { alert('暂无数据可导出'); return }
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, filename)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const INVOICE_TYPES = ['电子发票', '普通发票', '专用发票']
const TAX_RATES = [0.01, 0.03, 0.06, 0.09, 0.13]

const REQUEST_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'bg-yellow-100 text-yellow-800' },
  processing: { label: '开票中', color: 'bg-blue-100 text-blue-800' },
  issued: { label: '已开具', color: 'bg-green-100 text-green-800' },
  mailed: { label: '已邮寄', color: 'bg-purple-100 text-purple-800' },
  signed: { label: '已签收', color: 'bg-gray-100 text-gray-800' },
  voided: { label: '已作废', color: 'bg-red-100 text-red-800' },
}

// ─────────────────────────────────────────────────────────────
// 客户开票申请 Tab
// ─────────────────────────────────────────────────────────────

const emptyInvReq = {
  apply_date: '', order_no: '', shop_name: '',
  customer_name: '', tax_id: '', register_address: '', bank_account: '',
  invoice_type: '电子发票', invoice_content: '', amount: 0,
  tax_rate: 0.03, tax_amount: 0, email: '', mail_address: '',
  status: 'pending', remark: '', handler: '', invoice_file: '', invoice_filename: '',
}

function InvoiceRequestTab() {
  const { hasPermission, user } = useAuth()
  const canCreate = hasPermission('finance_invoice_request:create')
  const canEdit = hasPermission('finance_invoice_request:edit')
  const canDelete = hasPermission('finance_invoice_request:delete')

  const [records, setRecords] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [form, setForm] = useState(emptyInvReq)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewInvoice, setPreviewInvoice] = useState<{ url: string; filename: string } | null>(null)
  const [detailRecord, setDetailRecord] = useState<any>(null)
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef<HTMLTableRowElement | null>(null)
  const pageSize = 15

  const load = useCallback(() => {
    setLoading(true)
    getInvoiceRequests({ page, page_size: pageSize, keyword, status: filterStatus, invoice_type: filterType, start_date: startDate, end_date: endDate })
      .then(r => { setRecords(r.data.items); setTotal(r.data.total) })
      .catch(console.error).finally(() => setLoading(false))
  }, [page, keyword, filterStatus, filterType, startDate, endDate])

  // 高亮定位
  useEffect(() => {
    if (!highlightId || records.length === 0) return
    const target = records.find(r => r.id.toString() === highlightId)
    if (target) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [records, highlightId])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (!detailRecord) setConfirmStatus(null) }, [detailRecord])

  const openCreate = () => {
    setEditRecord(null)
    setForm({ ...emptyInvReq, apply_date: todayStr(), handler: user?.name || '' })
    setShowModal(true)
  }
  const openEdit = (r: any) => { setEditRecord(r); setForm({ ...emptyInvReq, ...r }); setShowModal(true) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editRecord) { await updateInvoiceRequest(editRecord.id, form) }
      else { await createInvoiceRequest(form) }
      setShowModal(false); load()
    } catch { alert('保存失败') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除？')) return
    await deleteInvoiceRequest(id); load()
  }

  const handleUploadInvoice = async (e: React.ChangeEvent<HTMLInputElement>, fromDetail = false) => {
    const file = e.target.files?.[0]
    const record = fromDetail ? detailRecord : editRecord
    if (!file || !record) return
    setUploading(true)
    try {
      const res = await uploadInvoiceFile(record.id, file)
      const newStatus = record.status === 'pending' || record.status === 'processing' ? 'issued' : record.status
      await updateInvoiceRequest(record.id, { status: newStatus })
      setForm(f => ({ ...f, invoice_file: res.data.url, invoice_filename: res.data.filename, status: newStatus }))
      setEditRecord((r: any) => r ? ({ ...r, invoice_file: res.data.url, invoice_filename: res.data.filename, status: newStatus }) : r)
      setDetailRecord((r: any) => r ? ({ ...r, invoice_file: res.data.url, invoice_filename: res.data.filename, status: newStatus }) : r)
      load()
      alert('发票上传成功！' + (newStatus === 'issued' ? '状态已自动更新为「已开具」' : ''))
    } catch {
      alert('上传失败，请重试')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleExport = () => {
    getInvoiceRequests({ all: true, keyword, status: filterStatus, invoice_type: filterType, start_date: startDate, end_date: endDate })
      .then(r => exportToExcel('客户开票申请', r.data.items.map((x: any, i: number) => ({
        序号: i + 1, 申请日期: x.apply_date, 订单编号: x.order_no, 店铺: x.shop_name,
        客户名称: x.customer_name, 纳税人识别号: x.tax_id,
        注册地址: x.register_address, 开户行及账号: x.bank_account, 发票类型: x.invoice_type,
        开票内容: x.invoice_content, 开票金额: x.amount, 税率: `${(x.tax_rate * 100).toFixed(0)}%`,
        税额: x.tax_amount, 邮箱: x.email, 邮寄地址: x.mail_address,
        状态: REQUEST_STATUS_MAP[x.status]?.label || x.status, 经手人: x.handler, 备注: x.remark,
      }))))
  }

  const handleDetailStatusChange = async (newStatus: string) => {
    if (!detailRecord) return
    try {
      await updateInvoiceRequest(detailRecord.id, { status: newStatus })
      const updated = { ...detailRecord, status: newStatus }
      setDetailRecord(updated)
      setEditRecord((r: any) => r && r.id === detailRecord.id ? { ...r, status: newStatus } : r)
      load()
    } catch {
      alert('状态更新失败')
    }
  }

  const handleCopyInfo = (r: any) => {
    const lines = [
      `客户名称（抬头）：${r.customer_name}`,
      `纳税人识别号：${r.tax_id}`,
      r.register_address ? `注册地址：${r.register_address}` : null,
      r.bank_account ? `开户行及账号：${r.bank_account}` : null,
      `发票类型：${r.invoice_type}`,
      `开票内容：${r.invoice_content}`,
      `开票金额（含税）：¥${fmtMoney(r.amount)}`,
      `税率：${(r.tax_rate * 100).toFixed(0)}%`,
      `税额：¥${fmtMoney(r.tax_amount)}`,
      r.email ? `邮箱：${r.email}` : null,
      r.mail_address ? `邮寄地址：${r.mail_address}` : null,
      r.remark ? `备注：${r.remark}` : null,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(lines).then(() => alert('已复制到剪贴板'))
  }

  const F = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <style>{`
        @keyframes highlight-flash-finance {
          0%, 30% { background: #fef9c3; }
          100% { background: transparent; }
        }
      `}</style>
      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="搜索订单号/客户名称/店铺" value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1) }} />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
          <option value="">全部状态</option>
          {Object.entries(REQUEST_STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}>
          <option value="">全部类型</option>
          {INVOICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} />
        <span className="self-center text-gray-400 text-sm">至</span>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} />
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
          <Download size={15} />导出
        </button>
        {canCreate && (
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 btn-primary text-sm">
            <Plus size={15} />新建申请
          </button>
        )}
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left font-medium">申请日期</th>
              <th className="px-3 py-2 text-left font-medium">订单编号</th>
              <th className="px-3 py-2 text-left font-medium">店铺</th>
              <th className="px-3 py-2 text-left font-medium">客户名称</th>
              <th className="px-3 py-2 text-left font-medium">发票类型</th>
              <th className="px-3 py-2 text-left font-medium">开票内容</th>
              <th className="px-3 py-2 text-right font-medium">金额</th>
              <th className="px-3 py-2 text-left font-medium">状态</th>
              <th className="px-3 py-2 text-left font-medium">经手人</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={10} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-8 text-gray-400">暂无数据</td></tr>
            ) : records.map(r => (
              <tr key={r.id} ref={r.id.toString() === highlightId ? highlightRef : undefined} className={`hover:bg-gray-50 ${r.id.toString() === highlightId ? 'highlight-row-finance' : ''}`} style={r.id.toString() === highlightId ? { animation: 'highlight-flash-finance 3s ease-out' } : {}}>
                <td className="px-3 py-2">{r.apply_date}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.order_no}</td>
                <td className="px-3 py-2">{r.shop_name}</td>
                <td className="px-3 py-2">{r.customer_name}</td>
                <td className="px-3 py-2">{r.invoice_type}</td>
                <td className="px-3 py-2 text-gray-600">{r.invoice_content}</td>
                <td className="px-3 py-2 text-right font-medium">¥{fmtMoney(r.amount)}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${REQUEST_STATUS_MAP[r.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                    {REQUEST_STATUS_MAP[r.status]?.label || r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500">{r.handler}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => setDetailRecord(r)} className="p-1 text-gray-500 hover:bg-gray-50 rounded" title="查看详情"><Eye size={14} /></button>
                    {r.invoice_file && (
                      <button onClick={() => setPreviewInvoice({ url: fileUrlWithToken(r.invoice_file), filename: r.invoice_filename })} className="p-1 text-green-500 hover:bg-green-50 rounded" title="查看发票"><Info size={14} /></button>
                    )}
                    {canEdit && <button onClick={() => openEdit(r)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>}
                    {canDelete && <button onClick={() => handleDelete(r.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>共 {total} 条</span>
          <div className="flex gap-1 items-center">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 disabled:opacity-40 hover:bg-gray-100 rounded"><ChevronLeft size={16} /></button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1 disabled:opacity-40 hover:bg-gray-100 rounded"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="font-medium text-base">{editRecord ? '编辑开票申请' : '新建开票申请'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">申请日期</label><input type="date" className="w-full border rounded px-3 py-1.5 text-sm" value={form.apply_date} onChange={e => F('apply_date', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">订单编号</label><input className="w-full border rounded px-3 py-1.5 text-sm" placeholder="订单编号" value={form.order_no} onChange={e => F('order_no', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">店铺名称</label><ShopSelect value={form.shop_name} onChange={v => F('shop_name', v)} showGear /></div>
              <div><label className="block text-xs text-gray-500 mb-1">发票类型</label>
                <select className="w-full border rounded px-3 py-1.5 text-sm" value={form.invoice_type} onChange={e => F('invoice_type', e.target.value)}>
                  {INVOICE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">客户名称（开票抬头）</label><input className="w-full border rounded px-3 py-1.5 text-sm" placeholder="发票抬头" value={form.customer_name} onChange={e => F('customer_name', e.target.value)} /></div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">纳税人识别号</label><input className="w-full border rounded px-3 py-1.5 text-sm font-mono" placeholder="统一社会信用代码 / 纳税人识别号" value={form.tax_id} onChange={e => F('tax_id', e.target.value)} /></div>
              {form.invoice_type === '专用发票' && (
                <>
                  <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">注册地址</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.register_address} onChange={e => F('register_address', e.target.value)} /></div>
                  <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">开户行及账号</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.bank_account} onChange={e => F('bank_account', e.target.value)} /></div>
                </>
              )}
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">开票内容（品名）</label><input className="w-full border rounded px-3 py-1.5 text-sm" placeholder="如：计算机/笔记本电脑" value={form.invoice_content} onChange={e => F('invoice_content', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">开票金额（含税）</label><input type="number" min="0" step="0.01" className="w-full border rounded px-3 py-1.5 text-sm" value={form.amount} onChange={e => { const a = parseFloat(e.target.value) || 0; const tax = parseFloat((a * form.tax_rate / (1 + form.tax_rate)).toFixed(2)); F('amount', a); setForm(f => ({ ...f, amount: a, tax_amount: tax })) }} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">税率</label>
                <select className="w-full border rounded px-3 py-1.5 text-sm" value={form.tax_rate} onChange={e => { const r = parseFloat(e.target.value); const tax = parseFloat((form.amount * r / (1 + r)).toFixed(2)); setForm(f => ({ ...f, tax_rate: r, tax_amount: tax })) }}>
                  {TAX_RATES.map(r => <option key={r} value={r}>{(r * 100).toFixed(0)}%</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">税额（自动计算）</label><input readOnly className="w-full border rounded px-3 py-1.5 text-sm bg-gray-50" value={form.tax_amount} /></div>
              {form.invoice_type === '电子发票' ? (
                <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">收票邮箱</label><input type="email" className="w-full border rounded px-3 py-1.5 text-sm" value={form.email} onChange={e => F('email', e.target.value)} /></div>
              ) : (
                <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">邮寄地址</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.mail_address} onChange={e => F('mail_address', e.target.value)} /></div>
              )}
              <div><label className="block text-xs text-gray-500 mb-1">经手人</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.handler} onChange={e => F('handler', e.target.value)} /></div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">备注</label><textarea rows={2} className="w-full border rounded px-3 py-1.5 text-sm" value={form.remark} onChange={e => F('remark', e.target.value)} /></div>
              {/* 发票附件区域（仅编辑时显示） */}
              {editRecord && canEdit && (
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">发票附件</label>
                  {form.invoice_file ? (
                    <div className="flex items-center gap-2 p-2 border rounded bg-gray-50">
                      <File size={16} className="text-gray-400" />
                      <span className="flex-1 text-sm truncate">{form.invoice_filename || '发票文件'}</span>
                      <button onClick={() => setPreviewInvoice({ url: fileUrlWithToken(form.invoice_file!), filename: form.invoice_filename })} className="text-blue-500 hover:text-blue-700 text-xs">查看</button>
                      <label className="cursor-pointer text-green-500 hover:text-green-700 text-xs">
                        重新上传
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp" className="hidden" onChange={handleUploadInvoice} disabled={uploading} />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <Upload size={20} className="text-gray-400" />
                      <span className="text-xs text-gray-500">{uploading ? '上传中...' : '点击上传发票（PDF 或图片）'}</span>
                      <span className="text-[10px] text-gray-400">最大 20MB</span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp" className="hidden" onChange={handleUploadInvoice} disabled={uploading} />
                    </label>
                  )}
                </div>
              )}
              {/* 只读模式查看发票 */}
              {editRecord && !canEdit && form.invoice_file && (
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">发票附件</label>
                  <div className="flex items-center gap-2 p-2 border rounded bg-gray-50">
                    <File size={16} className="text-gray-400" />
                    <span className="flex-1 text-sm truncate">{form.invoice_filename || '发票文件'}</span>
                    <button onClick={() => setPreviewInvoice({ url: fileUrlWithToken(form.invoice_file!), filename: form.invoice_filename })} className="text-blue-500 hover:text-blue-700 text-xs">查看</button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 btn-primary text-sm disabled:opacity-60">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 发票预览弹窗 */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-medium text-base">发票预览 - {previewInvoice.filename}</h3>
              <div className="flex gap-2">
                <a href={previewInvoice.url} download={previewInvoice.filename} className="flex items-center gap-1 px-3 py-1.5 btn-primary text-sm">
                  <Download size={14} />下载
                </a>
                <button onClick={() => setPreviewInvoice(null)} className="p-1.5 hover:bg-gray-100 rounded"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {previewInvoice.filename?.toLowerCase().endsWith('.pdf') ? (
                <iframe src={previewInvoice.url} className="w-full h-full min-h-[60vh] rounded" title="发票预览" />
              ) : (
                <img src={previewInvoice.url} alt="发票" className="max-w-full mx-auto rounded shadow" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {detailRecord && (() => {
        const r = detailRecord
        const DV = ({ label, value }: { label: string; value: any }) => {
          if (value === undefined || value === null || value === '') return null
          return (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{label}</p>
              <p className="text-sm text-gray-900 select-text">{value}</p>
            </div>
          )
        }
        return (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                <h3 className="font-medium text-base">开票申请详情</h3>
                <button onClick={() => setDetailRecord(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <DV label="申请日期" value={r.apply_date} />
                <DV label="订单编号" value={r.order_no} />
                <DV label="店铺名称" value={r.shop_name} />
                <DV label="发票类型" value={r.invoice_type} />
                <div className="col-span-2"><DV label="客户名称（开票抬头）" value={r.customer_name} /></div>
                <div className="col-span-2"><DV label="纳税人识别号" value={r.tax_id} /></div>
                {r.invoice_type === '专用发票' && (
                  <>
                    <div className="col-span-2"><DV label="注册地址" value={r.register_address} /></div>
                    <div className="col-span-2"><DV label="开户行及账号" value={r.bank_account} /></div>
                  </>
                )}
                <div className="col-span-2"><DV label="开票内容（品名）" value={r.invoice_content} /></div>
                <DV label="开票金额（含税）" value={`¥${fmtMoney(r.amount)}`} />
                <DV label="税率" value={`${(r.tax_rate * 100).toFixed(0)}%`} />
                <DV label="税额" value={`¥${fmtMoney(r.tax_amount)}`} />
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 mb-2">状态</p>
                  {(() => {
                    const allStatuses = Object.entries(REQUEST_STATUS_MAP).filter(([k]) => k !== 'voided')
                    const statuses = r.invoice_type === '电子发票'
                      ? allStatuses.filter(([k]) => ['pending', 'processing', 'issued'].includes(k))
                      : allStatuses
                    const keys = statuses.map(([k]) => k)
                    const currentIdx = keys.indexOf(r.status)
                    return (
                      <>
                        <div className="flex items-center gap-0">
                          {statuses.map(([k, v], i) => {
                            const isActive = r.status === k
                            const isPast = i < currentIdx
                            return (
                              <div key={k} className="flex items-center">
                                <button type="button"
                                  onClick={() => { if (!isActive) setConfirmStatus(k) }}
                                  className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all ${
                                    isActive
                                      ? v.color + ' ring-2 ring-offset-1 ring-current shadow-sm cursor-default'
                                      : isPast
                                        ? 'bg-green-50 text-green-600 hover:bg-green-100 cursor-pointer'
                                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100 cursor-pointer'
                                  }`}
                                >
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    isActive ? 'bg-current/20' : isPast ? 'bg-green-200 text-green-700' : 'bg-gray-200 text-gray-400'
                                  }`}>
                                    {isPast ? '✓' : i + 1}
                                  </span>
                                  <span className="text-[11px] font-medium whitespace-nowrap">{v.label}</span>
                                </button>
                                {i < statuses.length - 1 && (
                                  <div className={`w-6 h-0.5 mx-0.5 ${isPast ? 'bg-green-300' : 'bg-gray-200'}`} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {confirmStatus && (
                          <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm animate-pulse">
                            <span className="text-amber-700">
                              确认将状态变更为「<b>{REQUEST_STATUS_MAP[confirmStatus]?.label}</b>」？
                            </span>
                            <div className="flex gap-1.5 ml-auto">
                              <button onClick={() => setConfirmStatus(null)} className="px-2.5 py-1 text-xs border rounded-md hover:bg-gray-50">取消</button>
                              <button onClick={async () => { await handleDetailStatusChange(confirmStatus); setConfirmStatus(null) }} className="px-2.5 py-1 text-xs btn-primary rounded-md">确认</button>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                  {r.status !== 'voided' && (
                    <button onClick={() => { if (confirm('确认作废此开票申请？')) handleDetailStatusChange('voided') }}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors">
                      <Ban size={12} /> 作废此申请
                    </button>
                  )}
                  {r.status === 'voided' && (
                    <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 bg-red-50 rounded-lg border border-red-200">
                      <Ban size={12} /> 已作废
                    </span>
                  )}
                </div>
                {r.invoice_type === '电子发票' ? (
                  <DV label="收票邮箱" value={r.email} />
                ) : (
                  <DV label="邮寄地址" value={r.mail_address} />
                )}
                <DV label="经手人" value={r.handler} />
                {r.remark && <div className="col-span-2"><DV label="备注" value={r.remark} /></div>}
                <div className="col-span-2 text-xs text-gray-400 pt-2 border-t">
                  创建时间：{r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : '-'}
                  {r.updated_at && ` · 更新时间：${new Date(r.updated_at).toLocaleString('zh-CN')}`}
                </div>
                <div className="col-span-2 border-t pt-3">
                  <p className="text-xs text-gray-500 mb-1">发票附件</p>
                  {r.invoice_file ? (
                    <div className="flex items-center gap-2 p-2 border rounded bg-gray-50">
                      <File size={16} className="text-gray-400" />
                      <span className="flex-1 text-sm truncate">{r.invoice_filename || '发票文件'}</span>
                      <button onClick={() => { setDetailRecord(null); setPreviewInvoice({ url: fileUrlWithToken(r.invoice_file), filename: r.invoice_filename }) }} className="text-blue-500 hover:text-blue-700 text-xs">查看</button>
                      <label className="cursor-pointer text-green-500 hover:text-green-700 text-xs">
                        重新上传
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp" className="hidden" onChange={e => handleUploadInvoice(e, true)} disabled={uploading} />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <Upload size={20} className="text-gray-400" />
                      <span className="text-xs text-gray-500">{uploading ? '上传中...' : '点击上传发票（PDF 或图片）'}</span>
                      <span className="text-[10px] text-gray-400">最大 20MB · 上传后状态自动更新为「已开具」</span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp" className="hidden" onChange={e => handleUploadInvoice(e, true)} disabled={uploading} />
                    </label>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t">
                <button onClick={() => handleCopyInfo(r)} className="flex items-center gap-1.5 px-4 py-2 btn-primary text-sm">
                  <Copy size={14} />复制开票信息
                </button>
                <button onClick={() => setDetailRecord(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">关闭</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 销项发票台账 Tab
// ─────────────────────────────────────────────────────────────

const emptySales = {
  invoice_date: '', invoice_code: '', invoice_no: '', invoice_type: '普通发票',
  buyer_name: '', buyer_tax_id: '', invoice_content: '',
  amount: 0, tax_rate: 0.03, tax_amount: 0, total_amount: 0,
  order_no: '', shop_name: '', handler: '', remark: '',
}

function SalesInvoiceTab() {
  const { hasPermission, user } = useAuth()
  const canCreate = hasPermission('finance_sales_invoice:create')
  const canEdit = hasPermission('finance_sales_invoice:edit')
  const canDelete = hasPermission('finance_sales_invoice:delete')

  const [records, setRecords] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [filterType, setFilterType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [form, setForm] = useState(emptySales)
  const [saving, setSaving] = useState(false)
  const pageSize = 15

  const load = useCallback(() => {
    setLoading(true)
    getSalesInvoices({ page, page_size: pageSize, keyword, invoice_type: filterType, start_date: startDate, end_date: endDate })
      .then(r => { setRecords(r.data.items); setTotal(r.data.total) })
      .catch(console.error).finally(() => setLoading(false))
  }, [page, keyword, filterType, startDate, endDate])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditRecord(null); setForm({ ...emptySales, invoice_date: todayStr(), handler: user?.name || '' }); setShowModal(true) }
  const openEdit = (r: any) => { setEditRecord(r); setForm({ ...emptySales, ...r }); setShowModal(true) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editRecord) { await updateSalesInvoice(editRecord.id, form) }
      else { await createSalesInvoice(form) }
      setShowModal(false); load()
    } catch { alert('保存失败') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除？')) return
    await deleteSalesInvoice(id); load()
  }

  const handleExport = () => {
    getSalesInvoices({ all: true, keyword, invoice_type: filterType, start_date: startDate, end_date: endDate })
      .then(r => exportToExcel('销项发票台账', r.data.items.map((x: any, i: number) => ({
        序号: i + 1, 开票日期: x.invoice_date, 发票代码: x.invoice_code, 发票号码: x.invoice_no,
        发票类型: x.invoice_type, 购方名称: x.buyer_name, 购方税号: x.buyer_tax_id,
        开票内容: x.invoice_content, 不含税金额: x.amount, 税率: `${(x.tax_rate * 100).toFixed(0)}%`,
        税额: x.tax_amount, 价税合计: x.total_amount, 订单编号: x.order_no,
        店铺: x.shop_name, 经手人: x.handler, 备注: x.remark,
      }))))
  }

  const F = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="搜索发票号/购方名称/订单号" value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1) }} />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}>
          <option value="">全部类型</option>
          {INVOICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} />
        <span className="self-center text-gray-400 text-sm">至</span>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} />
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"><Download size={15} />导出</button>
        {canCreate && <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 btn-success text-sm"><Plus size={15} />新建销项</button>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left font-medium">开票日期</th>
              <th className="px-3 py-2 text-left font-medium">发票号码</th>
              <th className="px-3 py-2 text-left font-medium">发票类型</th>
              <th className="px-3 py-2 text-left font-medium">购方名称</th>
              <th className="px-3 py-2 text-left font-medium">开票内容</th>
              <th className="px-3 py-2 text-right font-medium">不含税金额</th>
              <th className="px-3 py-2 text-right font-medium">税额</th>
              <th className="px-3 py-2 text-right font-medium">价税合计</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={9} className="text-center py-8 text-gray-400">加载中...</td></tr>
              : records.length === 0 ? <tr><td colSpan={9} className="text-center py-8 text-gray-400">暂无数据</td></tr>
              : records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{r.invoice_date}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.invoice_no}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{r.invoice_type}</span></td>
                  <td className="px-3 py-2">{r.buyer_name}</td>
                  <td className="px-3 py-2 text-gray-600">{r.invoice_content}</td>
                  <td className="px-3 py-2 text-right">¥{fmtMoney(r.amount)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">¥{fmtMoney(r.tax_amount)}</td>
                  <td className="px-3 py-2 text-right font-medium">¥{fmtMoney(r.total_amount)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {canEdit && <button onClick={() => openEdit(r)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>}
                      {canDelete && <button onClick={() => handleDelete(r.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>共 {total} 条</span>
          <div className="flex gap-1 items-center">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 disabled:opacity-40 hover:bg-gray-100 rounded"><ChevronLeft size={16} /></button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1 disabled:opacity-40 hover:bg-gray-100 rounded"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="font-medium text-base">{editRecord ? '编辑销项发票' : '新建销项发票'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">开票日期</label><input type="date" className="w-full border rounded px-3 py-1.5 text-sm" value={form.invoice_date} onChange={e => F('invoice_date', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">发票类型</label>
                <select className="w-full border rounded px-3 py-1.5 text-sm" value={form.invoice_type} onChange={e => F('invoice_type', e.target.value)}>
                  {INVOICE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">发票代码</label><input className="w-full border rounded px-3 py-1.5 text-sm font-mono" value={form.invoice_code} onChange={e => F('invoice_code', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">发票号码</label><input className="w-full border rounded px-3 py-1.5 text-sm font-mono" value={form.invoice_no} onChange={e => F('invoice_no', e.target.value)} /></div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">购方名称</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.buyer_name} onChange={e => F('buyer_name', e.target.value)} /></div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">购方纳税人识别号</label><input className="w-full border rounded px-3 py-1.5 text-sm font-mono" value={form.buyer_tax_id} onChange={e => F('buyer_tax_id', e.target.value)} /></div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">开票内容</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.invoice_content} onChange={e => F('invoice_content', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">不含税金额</label>
                <input type="number" min="0" step="0.01" className="w-full border rounded px-3 py-1.5 text-sm" value={form.amount}
                  onChange={e => { const a = parseFloat(e.target.value) || 0; const tax = parseFloat((a * form.tax_rate).toFixed(2)); setForm(f => ({ ...f, amount: a, tax_amount: tax, total_amount: parseFloat((a + tax).toFixed(2)) })) }} />
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">税率</label>
                <select className="w-full border rounded px-3 py-1.5 text-sm" value={form.tax_rate}
                  onChange={e => { const r = parseFloat(e.target.value); const tax = parseFloat((form.amount * r).toFixed(2)); setForm(f => ({ ...f, tax_rate: r, tax_amount: tax, total_amount: parseFloat((f.amount + tax).toFixed(2)) })) }}>
                  {TAX_RATES.map(r => <option key={r} value={r}>{(r * 100).toFixed(0)}%</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">税额</label><input readOnly className="w-full border rounded px-3 py-1.5 text-sm bg-gray-50" value={form.tax_amount} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">价税合计</label><input readOnly className="w-full border rounded px-3 py-1.5 text-sm bg-gray-50 font-medium" value={form.total_amount} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">关联订单号</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.order_no} onChange={e => F('order_no', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">店铺名称</label><ShopSelect value={form.shop_name} onChange={v => F('shop_name', v)} showGear /></div>
              <div><label className="block text-xs text-gray-500 mb-1">经手人</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.handler} onChange={e => F('handler', e.target.value)} /></div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">备注</label><textarea rows={2} className="w-full border rounded px-3 py-1.5 text-sm" value={form.remark} onChange={e => F('remark', e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 btn-success text-sm disabled:opacity-60">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 进项发票台账 Tab
// ─────────────────────────────────────────────────────────────

const emptyPurchase = {
  receive_date: '', invoice_date: '', invoice_code: '', invoice_no: '', invoice_type: '专用发票',
  seller_name: '', seller_tax_id: '', invoice_content: '',
  amount: 0, tax_rate: 0.13, tax_amount: 0, total_amount: 0,
  is_certified: false, certified_date: '', certification_result: '', due_date: '',
  related_contract: '', receiver: '', remark: '',
}

function PurchaseInvoiceTab() {
  const { hasPermission, user } = useAuth()
  const canCreate = hasPermission('finance_purchase_invoice:create')
  const canEdit = hasPermission('finance_purchase_invoice:edit')
  const canDelete = hasPermission('finance_purchase_invoice:delete')

  const [records, setRecords] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCertified, setFilterCertified] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [form, setForm] = useState(emptyPurchase)
  const [saving, setSaving] = useState(false)
  const pageSize = 15

  const load = useCallback(() => {
    setLoading(true)
    const params: any = { page, page_size: pageSize, keyword, invoice_type: filterType, start_date: startDate, end_date: endDate }
    if (filterCertified !== '') params.is_certified = filterCertified === 'true'
    getPurchaseInvoices(params)
      .then(r => { setRecords(r.data.items); setTotal(r.data.total) })
      .catch(console.error).finally(() => setLoading(false))
  }, [page, keyword, filterType, filterCertified, startDate, endDate])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditRecord(null); setForm({ ...emptyPurchase, receive_date: todayStr(), receiver: user?.name || '' }); setShowModal(true) }
  const openEdit = (r: any) => { setEditRecord(r); setForm({ ...emptyPurchase, ...r }); setShowModal(true) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editRecord) { await updatePurchaseInvoice(editRecord.id, form) }
      else { await createPurchaseInvoice(form) }
      setShowModal(false); load()
    } catch { alert('保存失败') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除？')) return
    await deletePurchaseInvoice(id); load()
  }

  const handleExport = () => {
    getPurchaseInvoices({ all: true, keyword, invoice_type: filterType, start_date: startDate, end_date: endDate })
      .then(r => exportToExcel('进项发票台账', r.data.items.map((x: any, i: number) => ({
        序号: i + 1, 收票日期: x.receive_date, 开票日期: x.invoice_date,
        发票代码: x.invoice_code, 发票号码: x.invoice_no, 发票类型: x.invoice_type,
        销方名称: x.seller_name, 销方税号: x.seller_tax_id, 发票内容: x.invoice_content,
        不含税金额: x.amount, 税率: `${(x.tax_rate * 100).toFixed(0)}%`,
        税额: x.tax_amount, 价税合计: x.total_amount,
        是否认证: x.is_certified ? '是' : '否', 认证结果: x.certification_result,
        抵扣到期日: x.due_date, 关联合同: x.related_contract, 收票人: x.receiver, 备注: x.remark,
      }))))
  }

  const F = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="搜索发票号/销方名称/合同" value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1) }} />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}>
          <option value="">全部类型</option>
          {INVOICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterCertified} onChange={e => { setFilterCertified(e.target.value); setPage(1) }}>
          <option value="">认证状态</option>
          <option value="false">未认证</option>
          <option value="true">已认证</option>
        </select>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} />
        <span className="self-center text-gray-400 text-sm">至</span>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} />
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"><Download size={15} />导出</button>
        {canCreate && <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 btn-primary text-sm"><Plus size={15} />新建进项</button>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left font-medium">收票日期</th>
              <th className="px-3 py-2 text-left font-medium">发票号码</th>
              <th className="px-3 py-2 text-left font-medium">发票类型</th>
              <th className="px-3 py-2 text-left font-medium">销方名称</th>
              <th className="px-3 py-2 text-left font-medium">发票内容</th>
              <th className="px-3 py-2 text-right font-medium">价税合计</th>
              <th className="px-3 py-2 text-left font-medium">认证</th>
              <th className="px-3 py-2 text-left font-medium">到期日</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={9} className="text-center py-8 text-gray-400">加载中...</td></tr>
              : records.length === 0 ? <tr><td colSpan={9} className="text-center py-8 text-gray-400">暂无数据</td></tr>
              : records.map(r => {
                const overdue = r.due_date && r.due_date < todayStr() && !r.is_certified
                return (
                  <tr key={r.id} className={`hover:bg-gray-50 ${overdue ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-2">{r.receive_date}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.invoice_no}</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">{r.invoice_type}</span></td>
                    <td className="px-3 py-2">{r.seller_name}</td>
                    <td className="px-3 py-2 text-gray-600">{r.invoice_content}</td>
                    <td className="px-3 py-2 text-right font-medium">¥{fmtMoney(r.total_amount)}</td>
                    <td className="px-3 py-2">
                      {r.is_certified
                        ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">已认证</span>
                        : <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">未认证</span>
                      }
                    </td>
                    <td className={`px-3 py-2 text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {overdue && <AlertTriangle size={13} className="inline mr-1" />}{r.due_date}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {canEdit && <button onClick={() => openEdit(r)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>}
                        {canDelete && <button onClick={() => handleDelete(r.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>共 {total} 条</span>
          <div className="flex gap-1 items-center">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 disabled:opacity-40 hover:bg-gray-100 rounded"><ChevronLeft size={16} /></button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1 disabled:opacity-40 hover:bg-gray-100 rounded"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="font-medium text-base">{editRecord ? '编辑进项发票' : '新建进项发票'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">收票日期</label><input type="date" className="w-full border rounded px-3 py-1.5 text-sm" value={form.receive_date} onChange={e => F('receive_date', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">开票日期</label><input type="date" className="w-full border rounded px-3 py-1.5 text-sm" value={form.invoice_date} onChange={e => F('invoice_date', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">发票类型</label>
                <select className="w-full border rounded px-3 py-1.5 text-sm" value={form.invoice_type} onChange={e => F('invoice_type', e.target.value)}>
                  {INVOICE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">发票号码</label><input className="w-full border rounded px-3 py-1.5 text-sm font-mono" value={form.invoice_no} onChange={e => F('invoice_no', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">发票代码</label><input className="w-full border rounded px-3 py-1.5 text-sm font-mono" value={form.invoice_code} onChange={e => F('invoice_code', e.target.value)} /></div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">销方名称</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.seller_name} onChange={e => F('seller_name', e.target.value)} /></div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">销方纳税人识别号</label><input className="w-full border rounded px-3 py-1.5 text-sm font-mono" value={form.seller_tax_id} onChange={e => F('seller_tax_id', e.target.value)} /></div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">发票内容</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.invoice_content} onChange={e => F('invoice_content', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">不含税金额</label>
                <input type="number" min="0" step="0.01" className="w-full border rounded px-3 py-1.5 text-sm" value={form.amount}
                  onChange={e => { const a = parseFloat(e.target.value) || 0; const tax = parseFloat((a * form.tax_rate).toFixed(2)); setForm(f => ({ ...f, amount: a, tax_amount: tax, total_amount: parseFloat((a + tax).toFixed(2)) })) }} />
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">税率</label>
                <select className="w-full border rounded px-3 py-1.5 text-sm" value={form.tax_rate}
                  onChange={e => { const r = parseFloat(e.target.value); const tax = parseFloat((form.amount * r).toFixed(2)); setForm(f => ({ ...f, tax_rate: r, tax_amount: tax, total_amount: parseFloat((f.amount + tax).toFixed(2)) })) }}>
                  {TAX_RATES.map(r => <option key={r} value={r}>{(r * 100).toFixed(0)}%</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">税额</label><input readOnly className="w-full border rounded px-3 py-1.5 text-sm bg-gray-50" value={form.tax_amount} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">价税合计</label><input readOnly className="w-full border rounded px-3 py-1.5 text-sm bg-gray-50 font-medium" value={form.total_amount} /></div>
              <div className="col-span-2 border-t pt-3 mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_certified} onChange={e => F('is_certified', e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm">已认证</span>
                </label>
              </div>
              {form.is_certified && (
                <>
                  <div><label className="block text-xs text-gray-500 mb-1">认证日期</label><input type="date" className="w-full border rounded px-3 py-1.5 text-sm" value={form.certified_date} onChange={e => F('certified_date', e.target.value)} /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">认证结果</label>
                    <select className="w-full border rounded px-3 py-1.5 text-sm" value={form.certification_result} onChange={e => F('certification_result', e.target.value)}>
                      <option value="">请选择</option>
                      <option>认证成功</option><option>认证失败</option><option>认证中</option>
                    </select>
                  </div>
                </>
              )}
              <div><label className="block text-xs text-gray-500 mb-1">抵扣到期日</label><input type="date" className="w-full border rounded px-3 py-1.5 text-sm" value={form.due_date} onChange={e => F('due_date', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">关联合同</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.related_contract} onChange={e => F('related_contract', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">收票人</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.receiver} onChange={e => F('receiver', e.target.value)} /></div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">备注</label><textarea rows={2} className="w-full border rounded px-3 py-1.5 text-sm" value={form.remark} onChange={e => F('remark', e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 btn-primary text-sm disabled:opacity-60">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 报销发票台账 Tab
// ─────────────────────────────────────────────────────────────

const emptyExpense = {
  invoice_no: '', invoice_date: '', invoice_type: '普通发票',
  seller_name: '', summary: '',
  amount: 0, tax_rate: 0.03, tax_amount: 0, reimbursement_amount: 0,
  reimbursement_date: '', reimburser: '', department: '',
  is_paid: false, remark: '',
}

function ExpenseInvoiceTab() {
  const { hasPermission, user } = useAuth()
  const canCreate = hasPermission('finance_expense_invoice:create')
  const canEdit = hasPermission('finance_expense_invoice:edit')
  const canDelete = hasPermission('finance_expense_invoice:delete')

  const [records, setRecords] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [filterPaid, setFilterPaid] = useState('')
  const [filterDup, setFilterDup] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [form, setForm] = useState(emptyExpense)
  const [saving, setSaving] = useState(false)
  const pageSize = 15

  const load = useCallback(() => {
    setLoading(true)
    const params: any = { page, page_size: pageSize, keyword, start_date: startDate, end_date: endDate }
    if (filterPaid !== '') params.is_paid = filterPaid === 'true'
    if (filterDup !== '') params.is_duplicate = filterDup === 'true'
    getExpenseInvoices(params)
      .then(r => { setRecords(r.data.items); setTotal(r.data.total) })
      .catch(console.error).finally(() => setLoading(false))
  }, [page, keyword, filterPaid, filterDup, startDate, endDate])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditRecord(null); setForm({ ...emptyExpense, reimbursement_date: todayStr(), reimburser: user?.name || '' }); setShowModal(true) }
  const openEdit = (r: any) => { setEditRecord(r); setForm({ ...emptyExpense, ...r }); setShowModal(true) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editRecord) { await updateExpenseInvoice(editRecord.id, form) }
      else { await createExpenseInvoice(form) }
      setShowModal(false); load()
    } catch { alert('保存失败') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除？')) return
    await deleteExpenseInvoice(id); load()
  }

  const handleExport = () => {
    getExpenseInvoices({ all: true, keyword, start_date: startDate, end_date: endDate })
      .then(r => exportToExcel('报销发票台账', r.data.items.map((x: any, i: number) => ({
        序号: i + 1, 报销日期: x.reimbursement_date, 发票号码: x.invoice_no,
        开票日期: x.invoice_date, 发票类型: x.invoice_type, 开票方: x.seller_name,
        摘要: x.summary, 不含税金额: x.amount, 税率: `${(x.tax_rate * 100).toFixed(0)}%`,
        税额: x.tax_amount, 报销金额: x.reimbursement_amount,
        报销人: x.reimburser, 部门: x.department,
        是否支付: x.is_paid ? '已支付' : '未支付',
        重复校验: x.is_duplicate ? '⚠️重复' : '正常', 备注: x.remark,
      }))))
  }

  const F = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="搜索发票号/开票方/摘要/报销人" value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1) }} />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterPaid} onChange={e => { setFilterPaid(e.target.value); setPage(1) }}>
          <option value="">支付状态</option>
          <option value="false">未支付</option>
          <option value="true">已支付</option>
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterDup} onChange={e => { setFilterDup(e.target.value); setPage(1) }}>
          <option value="">查重状态</option>
          <option value="true">重复发票</option>
          <option value="false">正常</option>
        </select>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} />
        <span className="self-center text-gray-400 text-sm">至</span>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} />
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"><Download size={15} />导出</button>
        {canCreate && <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 btn-primary text-sm"><Plus size={15} />新建报销</button>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left font-medium">报销日期</th>
              <th className="px-3 py-2 text-left font-medium">发票号码</th>
              <th className="px-3 py-2 text-left font-medium">开票方</th>
              <th className="px-3 py-2 text-left font-medium">摘要</th>
              <th className="px-3 py-2 text-right font-medium">报销金额</th>
              <th className="px-3 py-2 text-left font-medium">报销人</th>
              <th className="px-3 py-2 text-left font-medium">部门</th>
              <th className="px-3 py-2 text-left font-medium">支付</th>
              <th className="px-3 py-2 text-left font-medium">查重</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={10} className="text-center py-8 text-gray-400">加载中...</td></tr>
              : records.length === 0 ? <tr><td colSpan={10} className="text-center py-8 text-gray-400">暂无数据</td></tr>
              : records.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r.is_duplicate ? 'bg-red-50' : ''}`}>
                  <td className="px-3 py-2">{r.reimbursement_date}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.invoice_no}</td>
                  <td className="px-3 py-2">{r.seller_name}</td>
                  <td className="px-3 py-2 text-gray-600">{r.summary}</td>
                  <td className="px-3 py-2 text-right font-medium">¥{fmtMoney(r.reimbursement_amount)}</td>
                  <td className="px-3 py-2">{r.reimburser}</td>
                  <td className="px-3 py-2 text-gray-500">{r.department}</td>
                  <td className="px-3 py-2">
                    {r.is_paid
                      ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">已支付</span>
                      : <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">未支付</span>
                    }
                  </td>
                  <td className="px-3 py-2">
                    {r.is_duplicate
                      ? <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs"><AlertTriangle size={11} />重复</span>
                      : <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-xs">正常</span>
                    }
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {canEdit && <button onClick={() => openEdit(r)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>}
                      {canDelete && <button onClick={() => handleDelete(r.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>共 {total} 条</span>
          <div className="flex gap-1 items-center">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 disabled:opacity-40 hover:bg-gray-100 rounded"><ChevronLeft size={16} /></button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1 disabled:opacity-40 hover:bg-gray-100 rounded"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="font-medium text-base">{editRecord ? '编辑报销发票' : '新建报销发票'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">发票号码</label><input className="w-full border rounded px-3 py-1.5 text-sm font-mono" value={form.invoice_no} onChange={e => F('invoice_no', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">开票日期</label><input type="date" className="w-full border rounded px-3 py-1.5 text-sm" value={form.invoice_date} onChange={e => F('invoice_date', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">发票类型</label>
                <select className="w-full border rounded px-3 py-1.5 text-sm" value={form.invoice_type} onChange={e => F('invoice_type', e.target.value)}>
                  {INVOICE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">开票方名称</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.seller_name} onChange={e => F('seller_name', e.target.value)} /></div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">摘要/用途</label><input className="w-full border rounded px-3 py-1.5 text-sm" placeholder="如：购办公用品/差旅费" value={form.summary} onChange={e => F('summary', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">不含税金额</label>
                <input type="number" min="0" step="0.01" className="w-full border rounded px-3 py-1.5 text-sm" value={form.amount}
                  onChange={e => { const a = parseFloat(e.target.value) || 0; const tax = parseFloat((a * form.tax_rate).toFixed(2)); setForm(f => ({ ...f, amount: a, tax_amount: tax, reimbursement_amount: parseFloat((a + tax).toFixed(2)) })) }} />
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">税率</label>
                <select className="w-full border rounded px-3 py-1.5 text-sm" value={form.tax_rate}
                  onChange={e => { const r = parseFloat(e.target.value); const tax = parseFloat((form.amount * r).toFixed(2)); setForm(f => ({ ...f, tax_rate: r, tax_amount: tax, reimbursement_amount: parseFloat((f.amount + tax).toFixed(2)) })) }}>
                  {TAX_RATES.map(r => <option key={r} value={r}>{(r * 100).toFixed(0)}%</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">税额</label><input readOnly className="w-full border rounded px-3 py-1.5 text-sm bg-gray-50" value={form.tax_amount} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">报销金额（价税合计）</label><input readOnly className="w-full border rounded px-3 py-1.5 text-sm bg-gray-50 font-medium" value={form.reimbursement_amount} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">报销日期</label><input type="date" className="w-full border rounded px-3 py-1.5 text-sm" value={form.reimbursement_date} onChange={e => F('reimbursement_date', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">报销人</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.reimburser} onChange={e => F('reimburser', e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">报销部门</label><input className="w-full border rounded px-3 py-1.5 text-sm" value={form.department} onChange={e => F('department', e.target.value)} /></div>
              <div className="flex items-center gap-2 pt-4">
                <input type="checkbox" id="isPaid" checked={form.is_paid} onChange={e => F('is_paid', e.target.checked)} className="w-4 h-4" />
                <label htmlFor="isPaid" className="text-sm cursor-pointer">已支付</label>
              </div>
              <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">备注</label><textarea rows={2} className="w-full border rounded px-3 py-1.5 text-sm" value={form.remark} onChange={e => F('remark', e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 btn-primary text-sm disabled:opacity-60">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 主页面
// ─────────────────────────────────────────────────────────────

const TABS = [
  { key: 'request', label: '客户开票申请', icon: FileText, color: 'text-blue-600', perm: 'finance_invoice_request:view' },
  { key: 'sales', label: '销项发票台账', icon: TrendingUp, color: 'text-green-600', perm: 'finance_sales_invoice:view' },
  { key: 'purchase', label: '进项发票台账', icon: TrendingDown, color: 'text-amber-600', perm: 'finance_purchase_invoice:view' },
  { key: 'expense', label: '报销发票台账', icon: Receipt, color: 'text-purple-600', perm: 'finance_expense_invoice:view' },
]

export default function FinancePage() {
  const { hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('request')
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    getFinanceStats().then(r => setStats(r.data)).catch(() => {})
    // 选第一个有权限的 tab
    const firstPerm = TABS.find(t => hasPermission(t.perm))
    if (firstPerm) setActiveTab(firstPerm.key)
  }, [])

  const visibleTabs = TABS.filter(t => hasPermission(t.perm))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-xl font-medium text-gray-900">财务管理</h1>
        <p className="text-sm text-gray-500 mt-0.5">发票台账管理 — 电商客户开票 & 公司内部发票</p>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-blue-600 mb-1">待处理开票申请</p>
            <p className="text-2xl font-medium text-blue-700">{stats.invoice_requests?.pending ?? 0}</p>
            <p className="text-xs text-blue-500 mt-0.5">共 {stats.invoice_requests?.total ?? 0} 条</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-xs text-green-600 mb-1">销项发票总金额</p>
            <p className="text-xl font-medium text-green-700">¥{fmtMoney(stats.sales_invoices?.total_amount)}</p>
            <p className="text-xs text-green-500 mt-0.5">共 {stats.sales_invoices?.count ?? 0} 张</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4">
            <p className="text-xs text-amber-600 mb-1">未认证进项发票</p>
            <p className="text-2xl font-medium text-amber-700">{stats.purchase_invoices?.uncertified ?? 0}</p>
            <p className="text-xs text-amber-500 mt-0.5">共 {stats.purchase_invoices?.total ?? 0} 张</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-xs text-red-600 mb-1">重复报销预警</p>
            <p className="text-2xl font-medium text-red-700">{stats.expense_invoices?.duplicate ?? 0}</p>
            <p className="text-xs text-red-500 mt-0.5">共 {stats.expense_invoices?.total ?? 0} 条</p>
          </div>
        </div>
      )}

      {/* Tab 导航 */}
      <div className="border-b mb-4">
        <div className="flex gap-0">
          {visibleTabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${activeTab === tab.key ? `border-current ${tab.color} font-medium` : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <Icon size={15} />{tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="bg-white rounded-xl border p-4">
        {activeTab === 'request' && hasPermission('finance_invoice_request:view') && <InvoiceRequestTab />}
        {activeTab === 'sales' && hasPermission('finance_sales_invoice:view') && <SalesInvoiceTab />}
        {activeTab === 'purchase' && hasPermission('finance_purchase_invoice:view') && <PurchaseInvoiceTab />}
        {activeTab === 'expense' && hasPermission('finance_expense_invoice:view') && <ExpenseInvoiceTab />}
        {visibleTabs.length === 0 && <div className="text-center py-16 text-gray-400">暂无权限访问财务模块</div>}
      </div>
    </div>
  )
}
