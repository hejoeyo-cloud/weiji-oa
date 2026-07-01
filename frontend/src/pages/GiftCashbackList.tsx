import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, X, Download, Wand2, Eye, CheckCircle, Clock } from 'lucide-react'
import Pagination from '../components/Pagination'
import EmptyState from '../components/EmptyState'
import { getGiftCashbackList, getGiftCashbackDetail, createGiftCashback, updateGiftCashback, deleteGiftCashback } from '../api/giftCashback'
import { lookupOrder } from '../api/gifts'
import { useAuth } from '../hooks/useAuth'
import ShopSelect from '../components/ShopSelect'
import FieldSelect from '../components/FieldSelect'
import ImageUpload from '../components/ImageUpload'
import { GiftCashback } from '../types'
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

const PAYMENT_METHODS = ['支付宝', '微信', '银行卡', '原返', '其他']

function fileUrlWithToken(url: string): string {
  if (!url) return url
  const token = localStorage.getItem('token')
  if (!token) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}token=${token}`
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: '待返现', color: 'bg-amber-50 text-amber-600', icon: Clock },
  completed: { label: '已返现', color: 'bg-green-50 text-green-600', icon: CheckCircle },
}

const emptyForm = {
  shop_name: '', order_no: '', cashback_amount: 0, reason: '', remark: '',
  applicant: '', payment_method: '', payment_account: '', payment_qr_code: '', payee: '', status: 'pending',
}

export default function GiftCashbackList() {
  const { user, hasPermission } = useAuth()
  const canCreate = hasPermission('gift_cashback:create')
  const canEdit = hasPermission('gift_cashback:edit')
  const canDelete = hasPermission('gift_cashback:delete')

  const [records, setRecords] = useState<GiftCashback[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [shopFilter, setShopFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [detailRecord, setDetailRecord] = useState<GiftCashback | null>(null)
  const [editRecord, setEditRecord] = useState<GiftCashback | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [showQrUpload, setShowQrUpload] = useState(false)
  const [previewImg, setPreviewImg] = useState<string | null>(null)
  const pageSize = 15

  const load = useCallback(() => {
    setLoading(true)
    getGiftCashbackList({ page, page_size: pageSize, search, status: statusFilter, shop_name: shopFilter, start_date: startDate, end_date: endDate })
      .then(data => { setRecords(data.items); setTotal(data.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search, statusFilter, shopFilter, startDate, endDate])

  useEffect(() => { load() }, [load])

  const handleExport = () => {
    getGiftCashbackList({ page: 1, page_size: 100000, search, status: statusFilter, shop_name: shopFilter, start_date: startDate, end_date: endDate })
      .then(data => {
        const rows = data.items.map((r: GiftCashback, idx: number) => ({
          '序号': idx + 1,
          '店铺名称': r.shop_name || '',
          '订单编号': r.order_no || '',
          '返现金额': r.cashback_amount || 0,
          '返现原因': r.reason || '',
          '收款方式': r.payment_method || '',
          '收款账户': r.payment_account || '',
          '状态': STATUS_CONFIG[r.status]?.label || '待返现',
          '备注': r.remark || '',
          '登记人': r.creator_name || '',
          '登记时间': r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '',
        }))
        exportToExcel('返现登记', rows)
      })
      .catch(console.error)
  }

  // 输入订单号自动填充店铺名称
  const handleAutoFill = async () => {
    if (!form.order_no.trim()) { alert('请先输入订单编号'); return }
    setLookingUp(true)
    try {
      const result = await lookupOrder(form.order_no.trim())
      if (!result.found) { alert('未找到匹配的发货记录'); return }
      setForm(prev => ({
        ...prev,
        ...(result.shop_name && { shop_name: result.shop_name }),
      }))
    } catch { alert('查询失败，请重试') }
    finally { setLookingUp(false) }
  }

  const openCreate = () => {
    setEditRecord(null)
    setForm(emptyForm)
    setShowQrUpload(false)
    setShowModal(true)
  }
  const openEdit = (r: GiftCashback) => {
    setEditRecord(r)
    setForm({
      shop_name: r.shop_name,
      order_no: r.order_no,
      cashback_amount: r.cashback_amount,
      reason: r.reason,
      remark: r.remark,
      applicant: r.applicant,
      payment_method: r.payment_method || '',
      payment_account: r.payment_account || '',
      payment_qr_code: r.payment_qr_code || '',
      payee: r.payee || '',
      status: r.status || 'pending',
    })
    setShowQrUpload(!!r.payment_qr_code)
    setShowModal(true)
  }
  const openDetail = async (r: GiftCashback) => {
    try {
      const fresh = await getGiftCashbackDetail(r.id)
      setDetailRecord(fresh)
    } catch {
      setDetailRecord(r)
    }
    setShowDetail(true)
  }

  const handleSave = () => {
    if (!form.order_no.trim()) { alert('请填写订单编号'); return }
    if (form.cashback_amount <= 0) { alert('请填写返现金额'); return }
    setSaving(true)
    const promise = editRecord ? updateGiftCashback(editRecord.id, form) : createGiftCashback(form)
    promise.then(() => {
      setShowModal(false)
      load()
    }).catch(console.error).finally(() => setSaving(false))
  }

  const handleStatusToggle = (r: GiftCashback) => {
    const newStatus = r.status === 'completed' ? 'pending' : 'completed'
    const label = STATUS_CONFIG[newStatus]?.label || newStatus
    if (!confirm(`确认将状态更改为「${label}」？`)) return
    updateGiftCashback(r.id, { status: newStatus }).then(() => {
      load()
      if (showDetail && detailRecord?.id === r.id) {
        setDetailRecord({ ...r, status: newStatus })
      }
    }).catch(console.error)
  }

  const handleDelete = (id: number) => {
    if (!confirm('确认删除这条返现记录？')) return
    deleteGiftCashback(id).then(load).catch(console.error)
  }

  const totalPages = Math.ceil(total / pageSize)

  // 判断是否需要显示收款账户（非原返、非空时）
  const showAccountField = form.payment_method && form.payment_method !== '原返'

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">返现登记</h2>
          <p className="text-sm text-gray-500 mt-0.5">活动返现记录管理，共 {total} 条</p>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-1.5 btn-primary">
            <Plus size={16} /> 新建返现
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 card p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">状态:</span>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="border rounded-lg px-3 py-1.5 text-sm">
            <option value="">全部</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <ShopSelect value={shopFilter} onChange={v => { setShopFilter(v); setPage(1) }} showGear={false} placeholder="全部店铺" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">日期:</span>
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }}
            className="border rounded-lg px-3 py-1.5 text-sm" />
          <span className="text-gray-400">-</span>
          <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }}
            className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="搜索订单号/店铺名称..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
          </div>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
          <Download size={16} /> 导出
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">店铺名称</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">订单编号</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">返现金额</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">返现原因</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">收款方式</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">登记时间</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={9}><EmptyState title="暂无返现记录" /></td></tr>
            ) : records.map((r, idx) => {
              const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending
              return (
                <tr key={r.id} className={`hover:bg-gray-50 ${(r.duplicate_count ?? 0) > 1 ? 'bg-orange-50 border-l-2 border-l-orange-400' : ''}`}>
                  <td className="px-4 py-3 text-gray-400">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-4 py-3">{r.shop_name || '-'}</td>
                  <td className="px-4 py-3 font-medium">{r.order_no}{(r.duplicate_count ?? 0) > 1 && <span className="ml-1 text-xs text-orange-600 font-medium">重复</span>}</td>
                  <td className="px-4 py-3 text-red-600 font-medium">¥{r.cashback_amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.reason || '-'}</td>
                  <td className="px-4 py-3">{r.payment_method || '-'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleStatusToggle(r)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${sc.color}`}>
                      <sc.icon className="w-3 h-3" />{sc.label}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openDetail(r)} className="text-blue-500 hover:text-blue-700" title="查看详情"><Eye size={14} /></button>
                      {canEdit && <button onClick={() => openEdit(r)} className="text-violet-600 hover:text-violet-800" title="编辑"><Edit2 size={14} /></button>}
                      {canDelete && <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700" title="删除"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">{editRecord ? '编辑返现' : '新建返现'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              {/* 订单号 + 自动识别 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  关联订单号 <span className="text-red-500">*</span>
                  <button type="button" onClick={handleAutoFill} disabled={lookingUp}
                    className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50">
                    <Wand2 size={12} />{lookingUp ? '识别中...' : '自动识别'}
                  </button>
                </label>
                <input value={form.order_no} onChange={e => setForm({ ...form, order_no: e.target.value })}
                  placeholder="请输入关联的发货订单号"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>

              {/* 店铺名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">店铺名称</label>
                <ShopSelect value={form.shop_name} onChange={v => setForm({ ...form, shop_name: v })} showGear={hasPermission('field_options:manage')} />
              </div>

              {/* 返现金额 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">返现金额 <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" min="0" value={form.cashback_amount}
                  onChange={e => setForm({ ...form, cashback_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>

              {/* 返现原因 — 预设 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">返现原因</label>
                <FieldSelect fieldName="cashback_reason" label="返现原因"
                  value={form.reason} onChange={v => setForm({ ...form, reason: v })}
                  placeholder="请选择或输入返现原因"
                  showGear={hasPermission('field_options:manage')} />
              </div>

              {/* 收款人 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">收款人</label>
                <input value={form.payee} onChange={e => setForm({ ...form, payee: e.target.value })}
                  placeholder="请输入收款人姓名"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>

              {/* 收款方式 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">收款方式</label>
                <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value, payment_account: '', payment_qr_code: '' })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100">
                  <option value="">请选择收款方式</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* 收款账户 — 选择收款方式后显示（原返除外） */}
              {showAccountField && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">收款账户</label>
                  <input value={form.payment_account} onChange={e => setForm({ ...form, payment_account: e.target.value })}
                    placeholder={`请输入${form.payment_method}账户（如手机号、账号）`}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
                </div>
              )}

              {/* 收款码 — 可选添加 */}
              {showAccountField && (
                <div>
                  {!showQrUpload ? (
                    <button type="button" onClick={() => setShowQrUpload(true)}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                      + 添加收款码（可选）
                    </button>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">收款码</label>
                        <button type="button" onClick={() => { setShowQrUpload(false); setForm({ ...form, payment_qr_code: '' }) }}
                          className="text-xs text-gray-400 hover:text-gray-600">移除</button>
                      </div>
                      <ImageUpload images={form.payment_qr_code ? [form.payment_qr_code] : []}
                        onChange={imgs => setForm({ ...form, payment_qr_code: imgs[0] || '' })} />
                    </div>
                  )}
                </div>
              )}

              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })}
                  rows={2} placeholder="备注信息"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">取消</button>
              <button onClick={handleSave} disabled={saving}
                className="btn-primary disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {showDetail && detailRecord && (() => {
        const sc = STATUS_CONFIG[detailRecord.status] || STATUS_CONFIG.pending
        return (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold">返现详情 #{detailRecord.id}</h3>
                <button onClick={() => setShowDetail(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-4">
                {/* 状态 */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">状态：</span>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${sc.color}`}>
                    <sc.icon className="w-4 h-4" />{sc.label}
                  </span>
                  {detailRecord.status === 'pending' && (
                    <button onClick={() => handleStatusToggle(detailRecord)}
                      className="btn-success text-sm px-3 py-1 inline-flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> 标记已返现
                    </button>
                  )}
                  {detailRecord.status === 'completed' && (
                    <button onClick={() => handleStatusToggle(detailRecord)}
                      className="btn-ghost text-sm px-3 py-1 inline-flex items-center gap-1 text-amber-600 hover:bg-amber-50">
                      <Clock className="w-3.5 h-3.5" /> 撤回为待返现
                    </button>
                  )}
                </div>

                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">店铺名称：</span>{detailRecord.shop_name || '-'}</div>
                  <div><span className="text-gray-500">订单编号：</span>{detailRecord.order_no || '-'}</div>
                  <div><span className="text-gray-500">返现金额：</span><span className="text-red-600 font-medium">¥{detailRecord.cashback_amount.toFixed(2)}</span></div>
                  <div><span className="text-gray-500">返现原因：</span>{detailRecord.reason || '-'}</div>
                  <div><span className="text-gray-500">收款方式：</span>{detailRecord.payment_method || '-'}</div>
                  {detailRecord.payee && <div><span className="text-gray-500">收款人：</span>{detailRecord.payee}</div>}
                  {detailRecord.payment_account && <div><span className="text-gray-500">收款账户：</span>{detailRecord.payment_account}</div>}
                  <div><span className="text-gray-500">登记人：</span>{detailRecord.creator_name}</div>
                  <div><span className="text-gray-500">登记时间：</span>{detailRecord.created_at ? detailRecord.created_at.slice(0, 16).replace('T', ' ') : '-'}</div>
                  {detailRecord.remark && <div className="col-span-2"><span className="text-gray-500">备注：</span>{detailRecord.remark}</div>}
                </div>

                {/* 收款码 */}
                {detailRecord.payment_qr_code && (
                  <div>
                    <span className="text-sm text-gray-500">收款码：</span>
                    <img src={fileUrlWithToken(detailRecord.payment_qr_code)} alt="收款码" className="mt-2 w-40 h-40 rounded-lg object-cover border border-gray-200 cursor-pointer"
                      onClick={() => setPreviewImg(detailRecord.payment_qr_code)} />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button onClick={() => setShowDetail(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">关闭</button>
                {canEdit && (
                  <button onClick={() => { setShowDetail(false); openEdit(detailRecord) }}
                    className="btn-primary text-sm">编辑</button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 图片预览 */}
      {previewImg && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-8" onClick={() => setPreviewImg(null)}>
          <img src={fileUrlWithToken(previewImg)} alt="收款码预览" className="max-w-sm max-h-[60vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  )
}
