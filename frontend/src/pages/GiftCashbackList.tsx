import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight, Eye, Gift, Download } from 'lucide-react'
import { getGiftCashbackList, createGiftCashback, updateGiftCashback, deleteGiftCashback } from '../api/giftCashback'
import { useAuth } from '../hooks/useAuth'
import ShopSelect from '../components/ShopSelect'
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

const emptyForm = {
  order_no: '', cashback_amount: 0, reason: '', remark: '', applicant: '',
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
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editRecord, setEditRecord] = useState<GiftCashback | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const pageSize = 15

  const load = useCallback(() => {
    setLoading(true)
    getGiftCashbackList({ page, page_size: pageSize, search, shop_name: shopFilter, start_date: startDate, end_date: endDate })
      .then(data => { setRecords(data.items); setTotal(data.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search, shopFilter, startDate, endDate])

  useEffect(() => { load() }, [load])

  const handleExport = () => {
    getGiftCashbackList({ page: 1, page_size: 100000, search, shop_name: shopFilter, start_date: startDate, end_date: endDate })
      .then(data => {
        const rows = data.items.map((r: GiftCashback, idx: number) => ({
          '序号': idx + 1,
          '订单编号': r.order_no || '',
          '返现金额': r.cashback_amount || 0,
          '返现原因': r.reason || '',
          '申请人': r.applicant || '',
          '备注': r.remark || '',
          '登记人': r.creator_name || '',
          '登记时间': r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '',
        }))
        exportToExcel('返现登记', rows)
      })
      .catch(console.error)
  }

  const openCreate = () => {
    setEditRecord(null)
    setForm({ ...emptyForm, applicant: user?.name || '' })
    setShowModal(true)
  }
  const openEdit = (r: GiftCashback) => {
    setEditRecord(r)
    setForm({
      order_no: r.order_no,
      cashback_amount: r.cashback_amount,
      reason: r.reason,
      remark: r.remark,
      applicant: r.applicant,
    })
    setShowModal(true)
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

  const handleDelete = (id: number) => {
    if (!confirm('确认删除这条返现记录？')) return
    deleteGiftCashback(id).then(load).catch(console.error)
  }

  const totalPages = Math.ceil(total / pageSize)

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
        <div className="flex items-center gap-2 flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="搜索订单号/申请人..."
            className="flex-1 outline-none text-sm"
          />
        </div>
        <div className="min-w-[140px]">
          <ShopSelect value={shopFilter} onChange={v => { setShopFilter(v); setPage(1) }} showGear={false} placeholder="全部店铺" />
        </div>
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

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">订单编号</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">返现金额</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">返现原因</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">申请人</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">登记人</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">登记时间</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">暂无数据</td></tr>
            ) : records.map((r, idx) => (
              <tr key={r.id} className={`hover:bg-gray-50 ${(r.duplicate_count ?? 0) > 1 ? 'bg-orange-50 border-l-2 border-l-orange-400' : ''}`}>
                <td className="px-4 py-3 text-gray-400">{(page - 1) * pageSize + idx + 1}</td>
                <td className="px-4 py-3 font-medium">{r.order_no}{(r.duplicate_count ?? 0) > 1 && <span className="ml-1 text-xs text-orange-600 font-medium">重复</span>}</td>
                <td className="px-4 py-3 text-red-600 font-medium">¥{r.cashback_amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.reason || '-'}</td>
                <td className="px-4 py-3">{r.applicant || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{r.creator_name}</td>
                <td className="px-4 py-3 text-gray-500">{r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {canEdit && <button onClick={() => openEdit(r)} className="text-violet-600 hover:text-violet-800"><Edit2 size={14} /></button>}
                    {canDelete && <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>}
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">{editRecord ? '编辑返现' : '新建返现'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关联订单号 <span className="text-red-500">*</span></label>
                <input value={form.order_no}
                  onChange={e => setForm({ ...form, order_no: e.target.value })}
                  placeholder="请输入关联的发货订单号"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">返现金额 <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" min="0"
                  value={form.cashback_amount}
                  onChange={e => setForm({ ...form, cashback_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">返现原因</label>
                <textarea value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  rows={2}
                  placeholder="请输入返现原因"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">申请人</label>
                <input value={form.applicant}
                  onChange={e => setForm({ ...form, applicant: e.target.value })}
                  placeholder="请输入申请人姓名"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea value={form.remark}
                  onChange={e => setForm({ ...form, remark: e.target.value })}
                  rows={2}
                  placeholder="备注信息"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">
                取消
              </button>
              <button onClick={handleSave} disabled={saving}
                className="btn-primary disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
