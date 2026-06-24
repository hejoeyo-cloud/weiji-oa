import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Edit2, Trash2, ChevronLeft, ChevronRight, Laptop, Wrench, RotateCcw, ExternalLink } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getProductDetail, updateProduct, deleteProduct, getProductStats } from '../api/products'
import type { ProductCreateData } from '../api/products'
import type { Product } from '../types'
import ImageUpload from '../components/ImageUpload'

function imgUrl(url: string): string {
  const token = localStorage.getItem('token')
  if (!token || url.startsWith('http')) return url
  return url + (url.includes('?') ? '&' : '?') + 'token=' + token
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState<ProductCreateData | null>(null)
  const [portInput, setPortInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<{ repair_count: number; return_count: number; exchange_count: number; recent_records: any[] } | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getProductDetail(Number(id))
      .then(setProduct)
      .catch(() => navigate('/products'))
      .finally(() => setLoading(false))
    getProductStats(Number(id)).then(setStats).catch(() => {})
  }, [id])

  const openEdit = () => {
    if (!product) return
    setForm({
      name: product.name, model_number: product.model_number,
      images: [...product.images], cpu: product.cpu,
      ram: product.ram, ram_freq: product.ram_freq, storage: product.storage, display: product.display,
      gpu: product.gpu, ports: [...product.ports], battery: product.battery,
      weight: product.weight, description: product.description,
      status: product.status,
    })
    setPortInput('')
    setShowEdit(true)
  }

  const handleSave = async () => {
    if (!form || !id) return
    if (!form.name.trim()) return alert('请输入产品名称')
    setSaving(true)
    try {
      const updated = await updateProduct(Number(id), form)
      setProduct(updated)
      setShowEdit(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id || !confirm('确定删除此产品？')) return
    await deleteProduct(Number(id))
    navigate('/products')
  }

  const addPort = () => {
    if (!form) return
    const val = portInput.trim()
    if (val && !form.ports?.includes(val)) {
      setForm({ ...form, ports: [...(form.ports || []), val] })
      setPortInput('')
    }
  }

  const removePort = (idx: number) => {
    if (!form) return
    setForm({ ...form, ports: form.ports?.filter((_: string, i: number) => i !== idx) })
  }

  if (loading) {
    return <div className="text-center py-20" style={{ color: '#a3a3a3' }}>加载中...</div>
  }

  if (!product) {
    return <div className="text-center py-20" style={{ color: '#a3a3a3' }}>产品不存在</div>
  }

  const specItems = [
    { label: '型号', value: product.model_number },
    { label: '处理器', value: product.cpu },
    { label: '显卡', value: product.gpu },
    { label: '内存', value: product.ram },
    { label: '内存频率', value: product.ram_freq },
    { label: '存储', value: product.storage },
    { label: '屏幕', value: product.display },
    { label: '电池', value: product.battery },
    { label: '重量', value: product.weight },
  ].filter(s => s.value)

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/products')}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#737373' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#1f1f1f' }}>{product.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#a3a3a3' }}>
              {product.model_number && <span>{product.model_number}</span>}
              <span className={`ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                product.status === '在售' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
              }`}>{product.status}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('products:edit') && (
            <button onClick={openEdit}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors"
              style={{ borderColor: '#e5e5e5', color: '#525252' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Edit2 className="w-3.5 h-3.5" /> 编辑
            </button>
          )}
          {hasPermission('products:delete') && (
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors"
              style={{ borderColor: '#fecaca', color: '#ef4444' }}
              onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Trash2 className="w-3.5 h-3.5" /> 删除
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Images */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
            {product.images && product.images.length > 0 ? (
              <div>
                {/* Main image */}
                <div
                  className="aspect-[16/10] bg-gray-50 flex items-center justify-center cursor-pointer"
                  onClick={() => setPreviewIdx(0)}
                >
                  <img src={imgUrl(product.images[0])} alt={product.name} className="w-full h-full object-contain" />
                </div>
                {/* Thumbnails */}
                {product.images.length > 1 && (
                  <div className="flex gap-2 p-3 overflow-x-auto">
                    {product.images.map((url: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setPreviewIdx(idx)}
                        className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors"
                        style={{ borderColor: previewIdx === idx ? '#404040' : '#f0f0f0' }}
                      >
                        <img src={imgUrl(url)} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-[16/10] flex items-center justify-center">
                <Laptop className="w-16 h-16" style={{ color: '#d4d4d4' }} />
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="bg-white rounded-xl border p-5 mt-4" style={{ borderColor: '#f0f0f0' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#1f1f1f' }}>补充说明</h3>
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#525252' }}>{product.description}</p>
            </div>
          )}
        </div>

        {/* Right: Specs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Spec card */}
          <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#f0f0f0' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#1f1f1f' }}>产品参数</h3>
            <div className="space-y-3">
              {specItems.map(s => (
                <div key={s.label} className="flex">
                  <span className="text-xs w-14 flex-shrink-0" style={{ color: '#a3a3a3' }}>{s.label}</span>
                  <span className="text-sm flex-1" style={{ color: '#1f1f1f' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ports card */}
          {product.ports && product.ports.length > 0 && (
            <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#f0f0f0' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#1f1f1f' }}>接口/端口</h3>
              <div className="flex flex-wrap gap-2">
                {product.ports.map((port: string, idx: number) => (
                  <span key={idx} className="inline-block px-3 py-1.5 text-xs rounded-lg border font-medium"
                    style={{ borderColor: '#e5e5e5', color: '#404040', background: '#fafaf9' }}>
                    {port}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#f0f0f0' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#1f1f1f' }}>录入信息</h3>
            <div className="space-y-2">
              {product.creator_name && (
                <div className="flex">
                  <span className="text-xs w-14 flex-shrink-0" style={{ color: '#a3a3a3' }}>创建人</span>
                  <span className="text-sm" style={{ color: '#525252' }}>{product.creator_name}</span>
                </div>
              )}
              {product.created_at && (
                <div className="flex">
                  <span className="text-xs w-14 flex-shrink-0" style={{ color: '#a3a3a3' }}>创建时间</span>
                  <span className="text-sm" style={{ color: '#525252' }}>{product.created_at.replace('T', ' ').slice(0, 16)}</span>
                </div>
              )}
              {product.updated_at && (
                <div className="flex">
                  <span className="text-xs w-14 flex-shrink-0" style={{ color: '#a3a3a3' }}>更新时间</span>
                  <span className="text-sm" style={{ color: '#525252' }}>{product.updated_at.replace('T', ' ').slice(0, 16)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* After-sales records */}
      {stats && (stats.repair_count > 0 || stats.return_count > 0 || stats.exchange_count > 0) && (
        <div className="mt-6 bg-white rounded-xl border p-5" style={{ borderColor: '#f0f0f0' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#1f1f1f' }}>售后记录</h3>
          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="text-center p-3 rounded-lg" style={{ background: '#fafaf9' }}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Wrench className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                <span className="text-2xl font-bold" style={{ color: '#8b5cf6' }}>{stats.repair_count}</span>
              </div>
              <p className="text-xs" style={{ color: '#a3a3a3' }}>维修</p>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: '#fafaf9' }}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <RotateCcw className="w-4 h-4" style={{ color: '#ef4444' }} />
                <span className="text-2xl font-bold" style={{ color: '#ef4444' }}>{stats.return_count}</span>
              </div>
              <p className="text-xs" style={{ color: '#a3a3a3' }}>退货</p>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: '#fafaf9' }}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <RotateCcw className="w-4 h-4" style={{ color: '#2563eb' }} />
                <span className="text-2xl font-bold" style={{ color: '#2563eb' }}>{stats.exchange_count}</span>
              </div>
              <p className="text-xs" style={{ color: '#a3a3a3' }}>换货</p>
            </div>
          </div>

          {/* Recent records */}
          {stats.recent_records.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#fafaf9' }}>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#737373' }}>类型</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#737373' }}>日期</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#737373' }}>型号</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#737373' }}>故障/原因</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#737373' }}>状态</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#737373' }}></th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#f0f0f0' }}>
                  {stats.recent_records.map((r: any, i: number) => {
                    const statusMap: Record<string, { label: string; color: string }> = {
                      pending_repair: { label: '待维修', color: '#f59e0b' },
                      processing_repair: { label: '维修中', color: '#2563eb' },
                      completed_repair: { label: '已完成', color: '#16a34a' },
                      pending: { label: '待处理', color: '#f59e0b' },
                      processing: { label: '处理中', color: '#2563eb' },
                      completed: { label: '已完成', color: '#16a34a' },
                    }
                    const s = statusMap[r.status] || { label: r.status, color: '#737373' }
                    const detailPath = r.type === '维修' ? `/repair` : `/return-exchange`
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <span className="inline-block px-2 py-0.5 text-xs rounded-full font-medium"
                            style={{ background: r.type === '维修' ? '#f3e8ff' : '#fef2f2', color: r.type === '维修' ? '#7c3aed' : '#dc2626' }}>
                            {r.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs" style={{ color: '#525252' }}>{r.date}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: '#525252' }}>{r.model}</td>
                        <td className="px-3 py-2 text-xs max-w-40 truncate" style={{ color: '#737373' }}>{r.reason || '-'}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-medium" style={{ color: s.color }}>{s.label}</span>
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => navigate(detailPath)}
                            className="p-1 rounded hover:bg-gray-100" title="查看详情">
                            <ExternalLink className="w-3.5 h-3.5" style={{ color: '#a3a3a3' }} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Image preview modal */}
      {previewIdx !== null && product.images[previewIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
          onClick={() => setPreviewIdx(null)}
        >
          <div className="relative max-w-5xl max-h-full flex items-center gap-4">
            {product.images.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); setPreviewIdx(i => i !== null ? (i - 1 + product.images.length) % product.images.length : 0) }}
                className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:bg-white flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
            )}
            <img
              src={imgUrl(product.images[previewIdx])}
              alt=""
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            {product.images.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); setPreviewIdx(i => i !== null ? (i + 1) % product.images.length : 0) }}
                className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:bg-white flex-shrink-0"
              >
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>
            )}
            <button
              onClick={() => setPreviewIdx(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-100"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 mb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#f0f0f0' }}>
              <h2 className="text-base font-semibold" style={{ color: '#1f1f1f' }}>编辑产品</h2>
              <button onClick={() => setShowEdit(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" style={{ color: '#a3a3a3' }} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>产品名称 *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>型号</label>
                  <input value={form.model_number} onChange={e => setForm({ ...form, model_number: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>状态</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}>
                    <option value="在售">在售</option>
                    <option value="停产">停产</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>产品图片</label>
                <ImageUpload images={form.images || []} onChange={imgs => setForm({ ...form, images: imgs })} />
              </div>

              <p className="text-xs font-semibold pt-2" style={{ color: '#737373' }}>硬件参数</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>处理器 (CPU)</label>
                  <input value={form.cpu} onChange={e => setForm({ ...form, cpu: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>显卡 (GPU)</label>
                  <input value={form.gpu} onChange={e => setForm({ ...form, gpu: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>内存 (RAM)</label>
                  <input value={form.ram} onChange={e => setForm({ ...form, ram: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>内存频率</label>
                  <input value={form.ram_freq} onChange={e => setForm({ ...form, ram_freq: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>存储</label>
                  <input value={form.storage} onChange={e => setForm({ ...form, storage: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>屏幕</label>
                  <input value={form.display} onChange={e => setForm({ ...form, display: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
                </div>
              </div>

              <p className="text-xs font-semibold pt-2" style={{ color: '#737373' }}>其他参数</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>电池</label>
                  <input value={form.battery} onChange={e => setForm({ ...form, battery: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>重量</label>
                  <input value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>接口/端口</label>
                <div className="flex gap-2">
                  <input value={portInput} onChange={e => setPortInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPort() } }}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}
                    placeholder="输入接口名称，按回车添加" />
                  <button onClick={addPort}
                    className="px-3 py-2 text-sm rounded-lg border" style={{ borderColor: '#e5e5e5', color: '#525252' }}>添加</button>
                </div>
                {form.ports && form.ports.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.ports.map((port: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border"
                        style={{ borderColor: '#e5e5e5', color: '#525252', background: '#fafaf9' }}>
                        {port}
                        <button onClick={() => removePort(idx)} className="ml-0.5 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>补充说明</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3} className="w-full px-3 py-2 text-sm border rounded-lg outline-none resize-none" style={{ borderColor: '#e5e5e5' }} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#f0f0f0' }}>
              <button onClick={() => setShowEdit(false)}
                className="px-4 py-2 text-sm rounded-lg" style={{ color: '#737373' }}>取消</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 text-sm font-medium rounded-lg disabled:opacity-50"
                style={{ background: '#404040', color: 'white' }}>
                {saving ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
