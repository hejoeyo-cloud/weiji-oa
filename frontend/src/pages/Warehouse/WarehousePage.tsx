import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight,
  Package, TrendingUp, TrendingDown, AlertTriangle, Boxes,
  Download, RefreshCw, Eye, Send, RotateCcw
} from 'lucide-react'
import {
  getProductList, createProduct, updateProduct, deleteProduct,
  getInboundList, createInbound, deleteInbound,
  getOutboundList, createOutbound, deleteOutbound,
  getWarehouseStats,
  getInboundFeedbacks, addInboundFeedback,
  getOutboundFeedbacks, addOutboundFeedback,
  getReturnToFactoryList, createReturnToFactory, updateReturnToFactory, deleteReturnToFactory,
  getReturnToFactoryFeedbacks, addReturnToFactoryFeedback,
  type ProductCreateData, type InboundCreateData, type OutboundCreateData, type ReturnToFactoryCreateData
} from '../../api/warehouse'
import type { WarehouseProduct, WarehouseInbound, WarehouseOutbound, WarehouseStats, WarehouseInboundFeedback, WarehouseOutboundFeedback, WarehouseReturnToFactory, WarehouseReturnToFactoryFeedback } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import * as XLSX from 'xlsx'

// ── 工具函数 ──────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function exportToExcel(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) { alert('暂无数据可导出'); return }
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, filename)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `${filename}_${todayStr()}.xlsx`,
  })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

// ── 通用弹窗包装 ──────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm px-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#f0f0f0' }}>
          <h3 className="text-base font-semibold" style={{ color: '#1f1f1f' }}>{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-gray-100">
            <X className="w-4 h-4" style={{ color: '#737373' }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── 标签页类型 ────────────────────────────────────────────────────────

type Tab = 'overview' | 'products' | 'inbound' | 'outbound' | 'returnToFactory'

// ── 主组件 ────────────────────────────────────────────────────────────

export default function WarehousePage() {
  const { hasPermission } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<WarehouseStats | null>(null)

  const canViewProducts = hasPermission('warehouse_products:view')
  const canCreateProduct = hasPermission('warehouse_products:create')
  const canEditProduct = hasPermission('warehouse_products:edit')
  const canDeleteProduct = hasPermission('warehouse_products:delete')
  const canViewInbound = hasPermission('warehouse_inbound:view')
  const canCreateInbound = hasPermission('warehouse_inbound:create')
  const canDeleteInbound = hasPermission('warehouse_inbound:delete')
  const canViewOutbound = hasPermission('warehouse_outbound:view')
  const canCreateOutbound = hasPermission('warehouse_outbound:create')
  const canDeleteOutbound = hasPermission('warehouse_outbound:delete')
  const canViewReturnToFactory = hasPermission('warehouse_return_to_factory:view')
  const canCreateReturnToFactory = hasPermission('warehouse_return_to_factory:create')
  const canDeleteReturnToFactory = hasPermission('warehouse_return_to_factory:delete')

  const loadStats = useCallback(async () => {
    try {
      const data = await getWarehouseStats()
      setStats(data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const tabs: { key: Tab; label: string; icon: React.ElementType; permission?: boolean }[] = [
    { key: 'overview', label: '库存概览', icon: Boxes },
    { key: 'products', label: '货品管理', icon: Package, permission: canViewProducts },
    { key: 'inbound', label: '入库记录', icon: TrendingUp, permission: canViewInbound },
    { key: 'outbound', label: '出库记录', icon: TrendingDown, permission: canViewOutbound },
    { key: 'returnToFactory', label: '返厂出库', icon: RotateCcw, permission: canViewReturnToFactory },
  ]

  return (
    <div className="space-y-4">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#1f1f1f' }}>仓储管理</h1>
          <p className="text-sm mt-0.5" style={{ color: '#737373' }}>货品入库、出库及库存查看</p>
        </div>
        <button
          onClick={loadStats}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors hover:bg-gray-50"
          style={{ color: '#737373', borderColor: '#e5e5e5' }}
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* 标签栏 */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f5f5f5' }}>
        {tabs.filter(t => t.permission === undefined || t.permission).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white shadow-sm' : ''
            }`}
            style={tab === t.key ? { color: '#1f1f1f' } : { color: '#737373' }}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      {tab === 'overview' && (
        <OverviewTab
          stats={stats}
          canViewInbound={canViewInbound}
          canViewOutbound={canViewOutbound}
          onSwitchTab={setTab}
        />
      )}
      {tab === 'products' && canViewProducts && (
        <ProductsTab
          canCreate={canCreateProduct}
          canEdit={canEditProduct}
          canDelete={canDeleteProduct}
          onStatsRefresh={loadStats}
        />
      )}
      {tab === 'inbound' && canViewInbound && (
        <InboundTab
          canCreate={canCreateInbound}
          canDelete={canDeleteInbound}
          onStatsRefresh={loadStats}
        />
      )}
      {tab === 'outbound' && canViewOutbound && (
        <OutboundTab
          canCreate={canCreateOutbound}
          canDelete={canDeleteOutbound}
          onStatsRefresh={loadStats}
        />
      )}
      {tab === 'returnToFactory' && canViewReturnToFactory && (
        <ReturnToFactoryTab
          canCreate={canCreateReturnToFactory}
          canDelete={canDeleteReturnToFactory}
          onStatsRefresh={loadStats}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 库存概览 Tab
// ══════════════════════════════════════════════════════════════════════

function OverviewTab({
  stats, canViewInbound, canViewOutbound, onSwitchTab
}: {
  stats: WarehouseStats | null
  canViewInbound: boolean
  canViewOutbound: boolean
  onSwitchTab: (tab: Tab) => void
}) {
  if (!stats) return (
    <div className="text-center py-12 text-sm" style={{ color: '#a3a3a3' }}>加载中...</div>
  )

  const cards = [
    {
      label: '货品种类',
      value: stats.total_products,
      unit: '种',
      icon: Package,
      color: '#6366f1',
      bg: '#eef2ff',
    },
    {
      label: '累计入库',
      value: stats.total_inbound,
      unit: '件',
      icon: TrendingUp,
      color: '#22c55e',
      bg: '#f0fdf4',
      clickable: canViewInbound,
      tab: 'inbound' as Tab,
    },
    {
      label: '累计出库',
      value: stats.total_outbound,
      unit: '件',
      icon: TrendingDown,
      color: '#f97316',
      bg: '#fff7ed',
      clickable: canViewOutbound,
      tab: 'outbound' as Tab,
    },
    {
      label: '当前库存',
      value: stats.current_qty,
      unit: '件',
      icon: Boxes,
      color: '#3b82f6',
      bg: '#eff6ff',
    },
  ]

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div
            key={c.label}
            onClick={() => c.clickable && onSwitchTab(c.tab!)}
            className={`bg-white rounded-xl border p-5 space-y-3 ${c.clickable ? 'cursor-pointer hover:shadow-md' : ''} transition-shadow`}
            style={{ borderColor: '#f0f0f0' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: '#737373' }}>{c.label}</span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
                <c.icon className="w-4 h-4" style={{ color: c.color }} />
              </div>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold" style={{ color: '#1f1f1f' }}>{c.value}</span>
              <span className="text-sm mb-0.5" style={{ color: '#a3a3a3' }}>{c.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 低库存预警 */}
      {stats.low_stock_count > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: '#f0f0f0', background: '#fef2f2' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: '#dc2626' }} />
            <span className="text-base font-bold" style={{ color: '#dc2626' }}>
              低库存预警（{stats.low_stock_count} 种货品库存 ≤ 20）
            </span>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...stats.low_stock_items]
              .sort((a, b) => a.current_qty - b.current_qty)
              .map(item => (
                <div
                  key={item.id}
                  className="rounded-xl p-4 border-2 transition-all hover:scale-105"
                  style={{
                    borderColor: item.current_qty === 0 ? '#dc2626' : '#f59e0b',
                    background: item.current_qty === 0
                      ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                      : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                  }}
                >
                  <div className="text-base font-semibold mb-2 truncate" style={{ color: '#1f2937' }}>
                    {item.name}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-3xl font-bold"
                      style={{ color: item.current_qty === 0 ? '#dc2626' : '#d97706' }}
                    >
                      {item.current_qty}
                    </span>
                    <span className="text-sm" style={{ color: '#6b7280' }}>{item.unit}</span>
                  </div>
                  {item.current_qty === 0 && (
                    <div className="mt-2 text-xs font-semibold px-2 py-1 rounded-full inline-block"
                      style={{ background: '#dc2626', color: '#ffffff' }}>
                      缺货
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {stats.low_stock_count === 0 && (
        <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor: '#f0f0f0' }}>
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#f0fdf4' }}>
            <Boxes className="w-6 h-6" style={{ color: '#22c55e' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#1f1f1f' }}>库存状态良好</p>
          <p className="text-xs mt-1" style={{ color: '#a3a3a3' }}>所有货品库存充足，无预警</p>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 货品管理 Tab
// ══════════════════════════════════════════════════════════════════════

const emptyProductForm: ProductCreateData = {
  code: '', category: '', name: '', spec: '', location: '', initial_qty: 0, unit: '个', remark: ''
}

function ProductsTab({
  canCreate, canEdit, canDelete, onStatsRefresh
}: {
  canCreate: boolean; canEdit: boolean; canDelete: boolean; onStatsRefresh: () => void
}) {
  const [items, setItems] = useState<WarehouseProduct[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<WarehouseProduct | null>(null)
  const [form, setForm] = useState<ProductCreateData>(emptyProductForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getProductList({ page, page_size: pageSize, search })
      setItems(data.items)
      setTotal(data.total)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [page, pageSize, search])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditItem(null)
    setForm(emptyProductForm)
    setShowModal(true)
  }

  const openEdit = (item: WarehouseProduct) => {
    setEditItem(item)
    setForm({
      code: item.code, category: item.category, name: item.name,
      spec: item.spec, location: item.location, initial_qty: item.initial_qty,
      unit: item.unit, remark: item.remark,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.code.trim()) { alert('请填写产品编码'); return }
    if (!form.name.trim()) { alert('请填写产品名称'); return }
    setSaving(true)
    try {
      if (editItem) {
        await updateProduct(editItem.id, form)
      } else {
        await createProduct(form)
      }
      setShowModal(false)
      load()
      onStatsRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail || '保存失败')
    } finally { setSaving(false) }
  }

  const handleDelete = async (item: WarehouseProduct) => {
    if (!confirm(`确认删除货品「${item.name}」？此操作不可撤销。`)) return
    try {
      await deleteProduct(item.id)
      load()
      onStatsRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail || '删除失败')
    }
  }

  const handleExport = async () => {
    const data = await getProductList({ all: true, search })
    exportToExcel('货品列表', data.items.map(p => ({
      '产品编码': p.code, '类别': p.category, '产品名称': p.name,
      '规格': p.spec, '位置': p.location, '期初库存': p.initial_qty,
      '当前库存': p.current_qty, '单位': p.unit, '备注': p.remark,
    })))
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-3">
      {/* 操作栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#a3a3a3' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="搜索编码/名称/类别..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none"
            style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }}
          />
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors hover:bg-gray-50"
          style={{ color: '#737373', borderColor: '#e5e5e5' }}
        >
          <Download className="w-4 h-4" />导出
        </button>
        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors"
            style={{ background: '#404040' }}
          >
            <Plus className="w-4 h-4" />新增货品
          </button>
        )}
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#fafaf9', borderBottom: '1px solid #f0f0f0' }}>
                {['产品编码', '类别', '产品名称', '规格', '位置', '期初库存', '当前库存', '单位', '操作'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#737373' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#f9f9f9' }}>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-sm" style={{ color: '#a3a3a3' }}>加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-sm" style={{ color: '#a3a3a3' }}>暂无数据</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#404040' }}>{item.code}</td>
                  <td className="px-4 py-3" style={{ color: '#737373' }}>{item.category || '-'}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#1f1f1f' }}>{item.name}</td>
                  <td className="px-4 py-3 max-w-[120px] truncate" style={{ color: '#737373' }} title={item.spec}>{item.spec || '-'}</td>
                  <td className="px-4 py-3" style={{ color: '#737373' }}>{item.location || '-'}</td>
                  <td className="px-4 py-3" style={{ color: '#737373' }}>{item.initial_qty}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${item.current_qty <= 5 ? 'text-red-500' : item.current_qty <= 20 ? 'text-amber-500' : 'text-green-600'}`}>
                      {item.current_qty}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: '#737373' }}>{item.unit}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" style={{ color: '#404040' }} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#f0f0f0' }}>
            <span className="text-xs" style={{ color: '#a3a3a3' }}>共 {total} 条</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors">
                <ChevronLeft className="w-4 h-4" style={{ color: '#737373' }} />
              </button>
              <span className="text-xs px-2" style={{ color: '#737373' }}>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors">
                <ChevronRight className="w-4 h-4" style={{ color: '#737373' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 新增/编辑弹窗 */}
      {showModal && (
        <Modal title={editItem ? '编辑货品' : '新增货品'} onClose={() => setShowModal(false)} wide>
          <div className="p-6 grid grid-cols-2 gap-4">
            {[
              { label: '产品编码 *', key: 'code', type: 'text', placeholder: '如 SSD-001' },
              { label: '类别', key: 'category', type: 'text', placeholder: '如 硬盘、内存' },
              { label: '产品名称 *', key: 'name', type: 'text', placeholder: '产品名称' },
              { label: '规格', key: 'spec', type: 'text', placeholder: '如 256GB' },
              { label: '位置/货架', key: 'location', type: 'text', placeholder: 'A区-1排' },
              { label: '期初库存', key: 'initial_qty', type: 'number', placeholder: '0' },
              { label: '单位', key: 'unit', type: 'text', placeholder: '个' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#404040' }}>{f.label}</label>
                <input
                  type={f.type}
                  value={String((form as any)[f.key] ?? '')}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-black/10"
                  style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }}
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#404040' }}>备注</label>
              <textarea
                value={form.remark}
                onChange={e => setForm(prev => ({ ...prev, remark: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-black/10 resize-none"
                style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 pb-6">
            <button onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-gray-50"
              style={{ borderColor: '#e5e5e5', color: '#737373' }}>取消</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 transition-colors"
              style={{ background: '#404040' }}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 入库记录 Tab
// ══════════════════════════════════════════════════════════════════════

function InboundTab({
  canCreate, canDelete, onStatsRefresh
}: {
  canCreate: boolean; canDelete: boolean; onStatsRefresh: () => void
}) {
  const [items, setItems] = useState<WarehouseInbound[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [products, setProducts] = useState<WarehouseProduct[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [form, setForm] = useState<InboundCreateData>({ date: todayStr(), product_id: 0, quantity: 1, operator: '', remark: '' })
  const [saving, setSaving] = useState(false)

  // 点击外部关闭货品下拉框
  const productRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showProductDropdown) return
    const handler = (e: MouseEvent) => {
      if (productRef.current && !productRef.current.contains(e.target as Node)) setShowProductDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showProductDropdown])

  // 详情弹窗状态
  const [detailRecord, setDetailRecord] = useState<WarehouseInbound | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [feedbacks, setFeedbacks] = useState<WarehouseInboundFeedback[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [addingFeedback, setAddingFeedback] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getInboundList({ page, page_size: pageSize, search, start_date: startDate, end_date: endDate })
      setItems(data.items)
      setTotal(data.total)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [page, pageSize, search, startDate, endDate])

  useEffect(() => { load() }, [load])

  const openCreate = async () => {
    try {
      const data = await getProductList({ all: true })
      setProducts(data.items)
    } catch (e) { console.error(e) }
    setForm({ date: todayStr(), product_id: 0, quantity: 1, operator: '', remark: '' })
    setProductSearch('')
    setShowProductDropdown(false)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.product_id) { alert('请选择货品'); return }
    if (!form.quantity || form.quantity <= 0) { alert('请输入正确的入库数量'); return }
    setSaving(true)
    try {
      await createInbound(form)
      setShowModal(false)
      load()
      onStatsRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail || '保存失败')
    } finally { setSaving(false) }
  }

  const handleDelete = async (item: WarehouseInbound) => {
    if (!confirm(`确认删除此入库记录？（${item.product_name} x${item.quantity}）`)) return
    try {
      await deleteInbound(item.id)
      load()
      onStatsRefresh()
    } catch (e: any) { alert(e?.response?.data?.detail || '删除失败') }
  }

  const handleExport = async () => {
    const data = await getInboundList({ all: true, search, start_date: startDate, end_date: endDate })
    exportToExcel('入库记录', data.items.map(r => ({
      '日期': r.date, '产品编码': r.product_code, '类别': r.category,
      '产品名称': r.product_name, '规格': r.spec, '位置': r.location,
      '入库数量': r.quantity, '入库人': r.operator, '备注': r.remark, '操作人': r.creator_name,
    })))
  }

  // 打开详情弹窗
  const openDetail = async (item: WarehouseInbound) => {
    setDetailRecord(item)
    setShowDetailModal(true)
    try {
      const data = await getInboundFeedbacks(item.id)
      setFeedbacks(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setFeedbacks([])
    }
  }

  // 添加处理记录
  const handleAddFeedback = async () => {
    if (!feedbackText.trim() || !detailRecord) return
    setAddingFeedback(true)
    try {
      const fb = await addInboundFeedback(detailRecord.id, feedbackText.trim())
      setFeedbacks(prev => Array.isArray(prev) ? [...prev, fb] : [fb])
      setFeedbackText('')
    } catch (e: any) {
      alert(e?.response?.data?.detail || '添加失败')
    } finally {
      setAddingFeedback(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#a3a3a3' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="搜索名称/编码/入库人..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none"
            style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }} />
        </div>
        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border rounded-lg outline-none"
          style={{ borderColor: '#e5e5e5', color: '#737373' }} />
        <span className="text-sm" style={{ color: '#a3a3a3' }}>~</span>
        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border rounded-lg outline-none"
          style={{ borderColor: '#e5e5e5', color: '#737373' }} />
        <button onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors hover:bg-gray-50"
          style={{ color: '#737373', borderColor: '#e5e5e5' }}>
          <Download className="w-4 h-4" />导出
        </button>
        {canCreate && (
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white"
            style={{ background: '#404040' }}>
            <Plus className="w-4 h-4" />新增入库
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#fafaf9', borderBottom: '1px solid #f0f0f0' }}>
                {['日期', '产品编码', '类别', '产品名称', '规格', '入库数量', '入库人', '备注', '操作人', '操作'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#737373' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#f9f9f9' }}>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10 text-sm" style={{ color: '#a3a3a3' }}>加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-sm" style={{ color: '#a3a3a3' }}>暂无入库记录</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs" style={{ color: '#737373' }}>{item.date || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#404040' }}>{item.product_code}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#737373' }}>{item.category || '-'}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#1f1f1f' }}>{item.product_name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#737373' }}>{item.spec || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-green-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#737373' }}>{item.operator || '-'}</td>
                  <td className="px-4 py-3 text-xs max-w-[120px] truncate" style={{ color: '#737373' }}>{item.remark || '-'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#a3a3a3' }}>{item.creator_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openDetail(item)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <Eye className="w-3.5 h-3.5" style={{ color: '#6366f1' }} />
                      </button>
                      {canDelete && (
                        <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#f0f0f0' }}>
            <span className="text-xs" style={{ color: '#a3a3a3' }}>共 {total} 条</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors">
                <ChevronLeft className="w-4 h-4" style={{ color: '#737373' }} />
              </button>
              <span className="text-xs px-2" style={{ color: '#737373' }}>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors">
                <ChevronRight className="w-4 h-4" style={{ color: '#737373' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="新增入库" onClose={() => setShowModal(false)}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#404040' }}>货品 *</label>
              <div className="relative" ref={productRef}>
                <input
                  type="text"
                  value={showProductDropdown ? productSearch : (products.find(p => p.id === form.product_id) ? `${products.find(p => p.id === form.product_id)!.name}（${products.find(p => p.id === form.product_id)!.code}）` : '')}
                  onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); setForm(prev => ({ ...prev, product_id: 0 })) }}
                  onFocus={() => { setShowProductDropdown(true); setProductSearch('') }}
                  placeholder="输入名称或货号搜索..."
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                  style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }}
                />
                {showProductDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto" style={{ borderColor: '#e5e5e5' }}>
                    {products.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase())).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">无匹配货品</div>
                    ) : (
                      products.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                        <div key={p.id}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                          onClick={() => { setForm(prev => ({ ...prev, product_id: p.id })); setProductSearch(''); setShowProductDropdown(false) }}
                        >
                          {p.name}（{p.code}）- 库存: {p.current_qty} {p.unit}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#404040' }}>入库日期</label>
                <input type="date" value={form.date}
                  onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                  style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#404040' }}>入库数量 *</label>
                <input type="number" min={1} value={form.quantity}
                  onChange={e => setForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                  style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#404040' }}>入库人</label>
              <input type="text" value={form.operator}
                onChange={e => setForm(prev => ({ ...prev, operator: e.target.value }))}
                placeholder="入库经手人"
                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#404040' }}>备注</label>
              <textarea value={form.remark} onChange={e => setForm(prev => ({ ...prev, remark: e.target.value }))}
                rows={2} className="w-full px-3 py-2 text-sm border rounded-lg outline-none resize-none"
                style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }} />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 pb-6">
            <button onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: '#e5e5e5', color: '#737373' }}>取消</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50"
              style={{ background: '#404040' }}>{saving ? '保存中...' : '确认入库'}</button>
          </div>
        </Modal>
      )}

      {/* 入库详情弹窗 */}
      {showDetailModal && detailRecord && (
        <Modal title="入库记录详情" onClose={() => { setShowDetailModal(false); setDetailRecord(null); setFeedbacks([]); setFeedbackText('') }} wide>
          <div className="p-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>日期</label>
                <p className="text-sm font-medium" style={{ color: '#1f1f1f' }}>{detailRecord.date || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>入库数量</label>
                <p className="text-sm font-semibold text-green-600">{detailRecord.quantity}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>产品名称</label>
                <p className="text-sm font-medium" style={{ color: '#1f1f1f' }}>{detailRecord.product_name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>产品编码</label>
                <p className="text-sm font-mono" style={{ color: '#404040' }}>{detailRecord.product_code}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>类别</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>{detailRecord.category || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>规格</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>{detailRecord.spec || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>位置</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>{detailRecord.location || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>入库人</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>{detailRecord.operator || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>操作人</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>{detailRecord.creator_name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>创建时间</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>
                  {detailRecord.created_at ? (() => {
                    try { return new Date(detailRecord.created_at).toLocaleString() }
                    catch { return '-' }
                  })() : '-'}
                </p>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>备注</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>{detailRecord.remark || '-'}</p>
              </div>
            </div>

            {/* 处理记录 */}
            <div className="border-t pt-5" style={{ borderColor: '#f0f0f0' }}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold" style={{ color: '#1f1f1f' }}>处理记录</h4>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f0f0f0', color: '#737373' }}>
                  {feedbacks.length} 条
                </span>
              </div>

              {/* 记录列表 */}
              {feedbacks.length === 0 ? (
                <div className="text-center py-6 text-sm" style={{ color: '#a3a3a3' }}>暂无处理记录</div>
              ) : (
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {feedbacks.map(fb => (
                    <div key={fb.id} className="flex gap-3 p-3 rounded-lg" style={{ background: '#fafaf9' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0" style={{ background: '#6366f1' }}>
                        {fb.user_name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium" style={{ color: '#1f1f1f' }}>{fb.user_name}</span>
                          <span className="text-xs" style={{ color: '#a3a3a3' }}>
                            {fb.created_at ? (() => {
                              try { return new Date(fb.created_at).toLocaleString() }
                              catch { return '' }
                            })() : ''}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: '#404040' }}>{fb.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 添加记录 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddFeedback()}
                  placeholder="输入处理记录，按回车添加..."
                  className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none"
                  style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }}
                />
                <button
                  onClick={handleAddFeedback}
                  disabled={addingFeedback || !feedbackText.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 flex items-center gap-1.5"
                  style={{ background: '#6366f1' }}
                >
                  <Send className="w-3.5 h-3.5" />
                  {addingFeedback ? '添加中...' : '添加'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 出库记录 Tab
// ══════════════════════════════════════════════════════════════════════

function OutboundTab({
  canCreate, canDelete, onStatsRefresh
}: {
  canCreate: boolean; canDelete: boolean; onStatsRefresh: () => void
}) {
  const [items, setItems] = useState<WarehouseOutbound[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [products, setProducts] = useState<WarehouseProduct[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [form, setForm] = useState<OutboundCreateData>({ date: todayStr(), product_id: 0, quantity: 1, operator: '', remark: '' })
  const [saving, setSaving] = useState(false)

  // 点击外部关闭货品下拉框
  const productRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showProductDropdown) return
    const handler = (e: MouseEvent) => {
      if (productRef.current && !productRef.current.contains(e.target as Node)) setShowProductDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showProductDropdown])

  // 详情弹窗状态
  const [detailRecord, setDetailRecord] = useState<WarehouseOutbound | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [feedbacks, setFeedbacks] = useState<WarehouseOutboundFeedback[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [addingFeedback, setAddingFeedback] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getOutboundList({ page, page_size: pageSize, search, start_date: startDate, end_date: endDate })
      setItems(data.items)
      setTotal(data.total)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [page, pageSize, search, startDate, endDate])

  useEffect(() => { load() }, [load])

  const openCreate = async () => {
    try {
      const data = await getProductList({ all: true })
      setProducts(data.items)
    } catch (e) { console.error(e) }
    setForm({ date: todayStr(), product_id: 0, quantity: 1, operator: '', remark: '' })
    setProductSearch('')
    setShowProductDropdown(false)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.product_id) { alert('请选择货品'); return }
    if (!form.quantity || form.quantity <= 0) { alert('请输入正确的出库数量'); return }
    setSaving(true)
    try {
      await createOutbound(form)
      setShowModal(false)
      load()
      onStatsRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail || '保存失败')
    } finally { setSaving(false) }
  }

  const handleDelete = async (item: WarehouseOutbound) => {
    if (!confirm(`确认删除此出库记录？（${item.product_name} x${item.quantity}）`)) return
    try {
      await deleteOutbound(item.id)
      load()
      onStatsRefresh()
    } catch (e: any) { alert(e?.response?.data?.detail || '删除失败') }
  }

  const handleExport = async () => {
    const data = await getOutboundList({ all: true, search, start_date: startDate, end_date: endDate })
    exportToExcel('出库记录', data.items.map(r => ({
      '日期': r.date, '产品编码': r.product_code, '类别': r.category,
      '产品名称': r.product_name, '规格': r.spec, '位置': r.location,
      '出库数量': r.quantity, '出库人': r.operator, '备注': r.remark, '操作人': r.creator_name,
    })))
  }

  // 打开详情弹窗
  const openDetail = async (item: WarehouseOutbound) => {
    setDetailRecord(item)
    setShowDetailModal(true)
    try {
      const data = await getOutboundFeedbacks(item.id)
      setFeedbacks(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setFeedbacks([])
    }
  }

  // 添加处理记录
  const handleAddFeedback = async () => {
    if (!feedbackText.trim() || !detailRecord) return
    setAddingFeedback(true)
    try {
      const fb = await addOutboundFeedback(detailRecord.id, feedbackText.trim())
      setFeedbacks(prev => Array.isArray(prev) ? [...prev, fb] : [fb])
      setFeedbackText('')
    } catch (e: any) {
      alert(e?.response?.data?.detail || '添加失败')
    } finally {
      setAddingFeedback(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#a3a3a3' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="搜索名称/编码/出库人..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none"
            style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }} />
        </div>
        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border rounded-lg outline-none"
          style={{ borderColor: '#e5e5e5', color: '#737373' }} />
        <span className="text-sm" style={{ color: '#a3a3a3' }}>~</span>
        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border rounded-lg outline-none"
          style={{ borderColor: '#e5e5e5', color: '#737373' }} />
        <button onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors hover:bg-gray-50"
          style={{ color: '#737373', borderColor: '#e5e5e5' }}>
          <Download className="w-4 h-4" />导出
        </button>
        {canCreate && (
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white"
            style={{ background: '#404040' }}>
            <Plus className="w-4 h-4" />新增出库
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#fafaf9', borderBottom: '1px solid #f0f0f0' }}>
                {['日期', '产品编码', '类别', '产品名称', '规格', '出库数量', '出库人', '备注', '操作人', '操作'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#737373' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#f9f9f9' }}>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10 text-sm" style={{ color: '#a3a3a3' }}>加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-sm" style={{ color: '#a3a3a3' }}>暂无出库记录</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs" style={{ color: '#737373' }}>{item.date || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#404040' }}>{item.product_code}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#737373' }}>{item.category || '-'}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#1f1f1f' }}>{item.product_name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#737373' }}>{item.spec || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-orange-500">{item.quantity}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#737373' }}>{item.operator || '-'}</td>
                  <td className="px-4 py-3 text-xs max-w-[120px] truncate" style={{ color: '#737373' }}>{item.remark || '-'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#a3a3a3' }}>{item.creator_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openDetail(item)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <Eye className="w-3.5 h-3.5" style={{ color: '#6366f1' }} />
                      </button>
                      {canDelete && (
                        <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#f0f0f0' }}>
            <span className="text-xs" style={{ color: '#a3a3a3' }}>共 {total} 条</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors">
                <ChevronLeft className="w-4 h-4" style={{ color: '#737373' }} />
              </button>
              <span className="text-xs px-2" style={{ color: '#737373' }}>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors">
                <ChevronRight className="w-4 h-4" style={{ color: '#737373' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="新增出库" onClose={() => setShowModal(false)}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#404040' }}>货品 *</label>
              <div className="relative" ref={productRef}>
                <input
                  type="text"
                  value={showProductDropdown ? productSearch : (products.find(p => p.id === form.product_id) ? `${products.find(p => p.id === form.product_id)!.name}（${products.find(p => p.id === form.product_id)!.code}）` : '')}
                  onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); setForm(prev => ({ ...prev, product_id: 0 })) }}
                  onFocus={() => { setShowProductDropdown(true); setProductSearch('') }}
                  placeholder="输入名称或货号搜索..."
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                  style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }}
                />
                {showProductDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto" style={{ borderColor: '#e5e5e5' }}>
                    {products.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase())).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">无匹配货品</div>
                    ) : (
                      products.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                        <div key={p.id}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                          onClick={() => { setForm(prev => ({ ...prev, product_id: p.id })); setProductSearch(''); setShowProductDropdown(false) }}
                        >
                          {p.name}（{p.code}）- 库存: {p.current_qty} {p.unit}
                          {p.current_qty === 0 ? ' ⚠️ 无库存' : p.current_qty <= 20 ? ' ⚠️ 低库存' : ''}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#404040' }}>出库日期</label>
                <input type="date" value={form.date}
                  onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                  style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#404040' }}>出库数量 *</label>
                <input type="number" min={1} value={form.quantity}
                  onChange={e => setForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                  style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#404040' }}>出库人</label>
              <input type="text" value={form.operator}
                onChange={e => setForm(prev => ({ ...prev, operator: e.target.value }))}
                placeholder="出库经手人"
                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#404040' }}>备注</label>
              <textarea value={form.remark} onChange={e => setForm(prev => ({ ...prev, remark: e.target.value }))}
                rows={2} className="w-full px-3 py-2 text-sm border rounded-lg outline-none resize-none"
                style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }} />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 pb-6">
            <button onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: '#e5e5e5', color: '#737373' }}>取消</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50"
              style={{ background: '#404040' }}>{saving ? '保存中...' : '确认出库'}</button>
          </div>
        </Modal>
      )}

      {/* 出库详情弹窗 */}
      {showDetailModal && detailRecord && (
        <Modal title="出库记录详情" onClose={() => { setShowDetailModal(false); setDetailRecord(null); setFeedbacks([]); setFeedbackText('') }} wide>
          <div className="p-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>日期</label>
                <p className="text-sm font-medium" style={{ color: '#1f1f1f' }}>{detailRecord.date || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>出库数量</label>
                <p className="text-sm font-semibold text-orange-500">{detailRecord.quantity}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>产品名称</label>
                <p className="text-sm font-medium" style={{ color: '#1f1f1f' }}>{detailRecord.product_name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>产品编码</label>
                <p className="text-sm font-mono" style={{ color: '#404040' }}>{detailRecord.product_code}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>类别</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>{detailRecord.category || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>规格</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>{detailRecord.spec || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>位置</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>{detailRecord.location || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>出库人</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>{detailRecord.operator || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>操作人</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>{detailRecord.creator_name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>创建时间</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>
                  {detailRecord.created_at ? (() => {
                    try { return new Date(detailRecord.created_at).toLocaleString() }
                    catch { return '-' }
                  })() : '-'}
                </p>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: '#737373' }}>备注</label>
                <p className="text-sm" style={{ color: '#1f1f1f' }}>{detailRecord.remark || '-'}</p>
              </div>
            </div>

            {/* 处理记录 */}
            <div className="border-t pt-5" style={{ borderColor: '#f0f0f0' }}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold" style={{ color: '#1f1f1f' }}>处理记录</h4>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f0f0f0', color: '#737373' }}>
                  {feedbacks.length} 条
                </span>
              </div>

              {/* 记录列表 */}
              {feedbacks.length === 0 ? (
                <div className="text-center py-6 text-sm" style={{ color: '#a3a3a3' }}>暂无处理记录</div>
              ) : (
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {feedbacks.map(fb => (
                    <div key={fb.id} className="flex gap-3 p-3 rounded-lg" style={{ background: '#fafaf9' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0" style={{ background: '#f97316' }}>
                        {fb.user_name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium" style={{ color: '#1f1f1f' }}>{fb.user_name}</span>
                          <span className="text-xs" style={{ color: '#a3a3a3' }}>
                            {fb.created_at ? (() => {
                              try { return new Date(fb.created_at).toLocaleString() }
                              catch { return '' }
                            })() : ''}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: '#404040' }}>{fb.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 添加记录 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddFeedback()}
                  placeholder="输入处理记录，按回车添加..."
                  className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none"
                  style={{ borderColor: '#e5e5e5', color: '#1f1f1f' }}
                />
                <button
                  onClick={handleAddFeedback}
                  disabled={addingFeedback || !feedbackText.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 flex items-center gap-1.5"
                  style={{ background: '#f97316' }}
                >
                  <Send className="w-3.5 h-3.5" />
                  {addingFeedback ? '添加中...' : '添加'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════
// 返厂出库 Tab
// ═══════════════════════════════════════════════════════════════════════

function ReturnToFactoryTab({ canCreate, canDelete, onStatsRefresh }: { canCreate: boolean; canDelete: boolean; onStatsRefresh: () => void }) {
  const { user } = useAuth()
  const [items, setItems] = useState<WarehouseReturnToFactory[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [products, setProducts] = useState<WarehouseProduct[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [form, setForm] = useState<ReturnToFactoryCreateData>({ date: todayStr(), product_id: 0, quantity: 1, reason: '', operator: user?.name || '', remark: '' })
  const [saving, setSaving] = useState(false)
  const [detailRecord, setDetailRecord] = useState<WarehouseReturnToFactory | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [feedbacks, setFeedbacks] = useState<WarehouseReturnToFactoryFeedback[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [addingFeedback, setAddingFeedback] = useState(false)
  const productRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showProductDropdown) return
    const handler = (e: MouseEvent) => { if (productRef.current && !productRef.current.contains(e.target as Node)) setShowProductDropdown(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showProductDropdown])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getReturnToFactoryList({ page, page_size: pageSize, search, status: statusFilter, start_date: startDate, end_date: endDate })
      setItems(data.items); setTotal(data.total)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [page, pageSize, search, statusFilter, startDate, endDate])
  useEffect(() => { load() }, [load])

  const openCreate = async () => {
    try { const data = await getProductList({ all: true }); setProducts(data.items) } catch (e) { console.error(e) }
    setForm({ date: todayStr(), product_id: 0, quantity: 1, reason: '', operator: user?.name || '', remark: '' })
    setProductSearch(''); setShowProductDropdown(false); setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.product_id || !form.quantity || !form.reason) { alert('请填写货品、数量和返厂原因'); return }
    setSaving(true)
    try {
      await createReturnToFactory(form)
      setShowModal(false); load(); onStatsRefresh()
    } catch (e: any) { alert(e.response?.data?.detail || '保存失败') } finally { setSaving(false) }
  }

  const handleDelete = async (item: WarehouseReturnToFactory) => {
    if (!confirm(`确定删除 ${item.product_name} x${item.quantity} 的返厂记录？`)) return
    try { await deleteReturnToFactory(item.id); load(); onStatsRefresh() } catch (e) { console.error(e) }
  }

  const handleRepair = async (item: WarehouseReturnToFactory) => {
    if (!confirm(`确认 ${item.product_name} x${item.quantity} 已维修完成返库？`)) return
    try { await updateReturnToFactory(item.id, { status: 'repaired' }); load(); onStatsRefresh() } catch (e: any) { alert(e.response?.data?.detail || '操作失败') }
  }

  const openDetail = async (item: WarehouseReturnToFactory) => {
    setDetailRecord(item); setShowDetailModal(true)
    try { const data = await getReturnToFactoryFeedbacks(item.id); setFeedbacks(data) } catch (e) { console.error(e) }
  }

  const handleAddFeedback = async () => {
    if (!feedbackText.trim() || !detailRecord) return
    setAddingFeedback(true)
    try {
      await addReturnToFactoryFeedback(detailRecord.id, feedbackText)
      setFeedbackText('')
      const data = await getReturnToFactoryFeedbacks(detailRecord.id); setFeedbacks(data)
    } catch (e) { console.error(e) } finally { setAddingFeedback(false) }
  }

  const handleExport = async () => {
    try {
      const data = await getReturnToFactoryList({ page: 1, page_size: 100000, search, status: statusFilter, start_date: startDate, end_date: endDate })
      const rows = data.items.map((r: WarehouseReturnToFactory, idx: number) => ({
        '序号': idx + 1, '日期': r.date, '货品名称': r.product_name, '货品编码': r.product_code,
        '数量': r.quantity, '返厂原因': r.reason, '状态': r.status === 'repaired' ? '已返库' : '维修中',
        '经手人': r.operator, '备注': r.remark, '登记人': r.creator_name,
        '登记时间': r.created_at?.slice(0, 16).replace('T', ' ') || '',
      }))
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, '返厂出库')
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `返厂出库_${todayStr()}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e) { alert('导出失败') }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="搜索货品名称/编码/经手人..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none focus:ring-1 focus:ring-gray-300"
            style={{ borderColor: '#e5e5e5' }} />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}>
          <option value="">全部状态</option>
          <option value="repairing">维修中</option>
          <option value="repaired">已返库</option>
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          className="px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
        <button onClick={handleExport} className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#e5e5e5' }}>
          <Download className="w-4 h-4" /> 导出
        </button>
        {canCreate && (
          <button onClick={openCreate} className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ background: '#404040' }}>
            <Plus className="w-4 h-4" /> 新增返厂
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e5e5e5' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: '#f0f0f0', background: '#fafafa' }}>
                <th className="px-4 py-3 text-left font-medium text-gray-600">日期</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">货品编码</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">货品名称</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">数量</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">返厂原因</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">状态</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">经手人</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">暂无数据</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="border-b hover:bg-gray-50" style={{ borderColor: '#f0f0f0' }}>
                  <td className="px-4 py-3 whitespace-nowrap">{item.date}</td>
                  <td className="px-4 py-3 text-gray-500">{item.product_code}</td>
                  <td className="px-4 py-3 font-medium">{item.product_name}</td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate text-gray-500">{item.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.status === 'repaired' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {item.status === 'repaired' ? '已返库' : '维修中'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.operator}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openDetail(item)} className="p-1 text-gray-400 hover:text-blue-500" title="详情"><Eye className="w-4 h-4" /></button>
                      {item.status === 'repairing' && (
                        <button onClick={() => handleRepair(item)} className="px-2 py-0.5 text-xs font-medium text-white bg-green-500 rounded hover:bg-green-600" title="维修完成返库">返库</button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(item)} className="p-1 text-gray-400 hover:text-red-500" title="删除"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#f0f0f0' }}>
            <span className="text-sm text-gray-500">共 {total} 条</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border disabled:opacity-30" style={{ borderColor: '#e5e5e5' }}><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-3 py-1 text-sm">{page} / {Math.ceil(total / pageSize)}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / pageSize)}
                className="p-1.5 rounded-lg border disabled:opacity-30" style={{ borderColor: '#e5e5e5' }}><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="新增返厂出库" onClose={() => setShowModal(false)}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">货品 *</label>
              <div className="relative" ref={productRef}>
                <input type="text"
                  value={showProductDropdown ? productSearch : (products.find(p => p.id === form.product_id) ? `${products.find(p => p.id === form.product_id)!.name}（${products.find(p => p.id === form.product_id)!.code}）` : '')}
                  onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); setForm(prev => ({ ...prev, product_id: 0 })) }}
                  onFocus={() => { setShowProductDropdown(true); setProductSearch('') }}
                  placeholder="输入名称或货号搜索..."
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
                {showProductDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto" style={{ borderColor: '#e5e5e5' }}>
                    {products.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase())).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">无匹配货品</div>
                    ) : products.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                      <div key={p.id} className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                        onClick={() => { setForm(prev => ({ ...prev, product_id: p.id })); setProductSearch(''); setShowProductDropdown(false) }}>
                        {p.name}（{p.code}）- 库存: {p.current_qty} {p.unit}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-gray-500 mb-1">日期</label>
                <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">数量 *</label>
                <input type="number" min="1" value={form.quantity} onChange={e => setForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} /></div>
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">返厂原因 *</label>
              <input value={form.reason} onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="如：配件故障需返厂维修"
                className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">经手人</label>
              <input value={form.operator} onChange={e => setForm(prev => ({ ...prev, operator: e.target.value }))}
                className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">备注</label>
              <textarea rows={2} value={form.remark} onChange={e => setForm(prev => ({ ...prev, remark: e.target.value }))}
                className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#e5e5e5' }}>取消</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ background: '#404040' }}>
                {saving ? '保存中...' : '确认返厂'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDetailModal && detailRecord && (
        <Modal title="返厂出库详情" onClose={() => setShowDetailModal(false)}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">日期：</span>{detailRecord.date}</div>
              <div><span className="text-gray-500">状态：</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${detailRecord.status === 'repaired' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {detailRecord.status === 'repaired' ? '已返库' : '维修中'}
                </span>
              </div>
              <div><span className="text-gray-500">货品：</span>{detailRecord.product_name}（{detailRecord.product_code}）</div>
              <div><span className="text-gray-500">数量：</span>{detailRecord.quantity}</div>
              <div className="col-span-2"><span className="text-gray-500">返厂原因：</span>{detailRecord.reason}</div>
              <div><span className="text-gray-500">经手人：</span>{detailRecord.operator}</div>
              <div><span className="text-gray-500">登记人：</span>{detailRecord.creator_name}</div>
              {detailRecord.repaired_at && <div className="col-span-2"><span className="text-gray-500">返库时间：</span>{detailRecord.repaired_at?.slice(0, 16).replace('T', ' ')}</div>}
              {detailRecord.remark && <div className="col-span-2"><span className="text-gray-500">备注：</span>{detailRecord.remark}</div>}
            </div>
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-800 mb-3">处理记录</h4>
              {feedbacks.length === 0 ? (
                <p className="text-sm text-gray-400">暂无处理记录</p>
              ) : (
                <div className="space-y-2">
                  {feedbacks.map(f => (
                    <div key={f.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{f.user_name}</span>
                        <span>{f.created_at?.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <div>{f.content}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <input value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddFeedback()}
                  placeholder="添加处理记录..."
                  className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
                <button onClick={handleAddFeedback} disabled={addingFeedback || !feedbackText.trim()}
                  className="px-3 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ background: '#404040' }}>
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
