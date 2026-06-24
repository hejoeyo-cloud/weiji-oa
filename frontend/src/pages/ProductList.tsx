import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Laptop, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getProductList, createProduct, updateProduct, deleteProduct } from '../api/products'
import type { ProductCreateData } from '../api/products'
import type { Product } from '../types'
import ImageUpload from '../components/ImageUpload'

const PAGE_SIZE = 12

function imgUrl(url: string): string {
  const token = localStorage.getItem('token')
  if (!token || url.startsWith('http')) return url
  return url + (url.includes('?') ? '&' : '?') + 'token=' + token
}

const emptyForm: ProductCreateData = {
  name: '', model_number: '',
  images: [], cpu: '', ram: '', ram_freq: '', storage: '', display: '',
  gpu: '', ports: [], battery: '', weight: '',
  description: '', status: '在售',
}

export default function ProductList() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<ProductCreateData>({ ...emptyForm })
  const [portInput, setPortInput] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getProductList({ page, page_size: PAGE_SIZE, search })
      .then(data => { setProducts(data.items); setTotal(data.total) })
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const openCreate = () => {
    setEditId(null)
    setForm({ ...emptyForm })
    setPortInput('')
    setShowModal(true)
  }

  const openEdit = (e: React.MouseEvent, p: Product) => {
    e.stopPropagation()
    setEditId(p.id)
    setForm({
      name: p.name, model_number: p.model_number,
      images: [...p.images], cpu: p.cpu,
      ram: p.ram, ram_freq: p.ram_freq, storage: p.storage, display: p.display, gpu: p.gpu,
      ports: [...p.ports], battery: p.battery, weight: p.weight,
      description: p.description, status: p.status,
    })
    setPortInput('')
    setShowModal(true)
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('确定删除此产品？')) return
    await deleteProduct(id)
    load()
  }

  const handleSave = async () => {
    if (!form.name.trim()) return alert('请输入产品名称')
    setSaving(true)
    try {
      if (editId) {
        await updateProduct(editId, form)
      } else {
        await createProduct(form)
      }
      setShowModal(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const addPort = () => {
    const val = portInput.trim()
    if (val && !form.ports?.includes(val)) {
      setForm({ ...form, ports: [...(form.ports || []), val] })
      setPortInput('')
    }
  }

  const removePort = (idx: number) => {
    setForm({ ...form, ports: form.ports?.filter((_: string, i: number) => i !== idx) })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1f1f1f' }}>产品概览</h1>
          <p className="text-sm mt-1" style={{ color: '#a3a3a3' }}>查看公司笔记本电脑产品信息</p>
        </div>
        {hasPermission('products:create') && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{ background: '#404040', color: 'white' }}
            onMouseEnter={e => e.currentTarget.style.background = '#262626'}
            onMouseLeave={e => e.currentTarget.style.background = '#404040'}>
            <Plus className="w-4 h-4" /> 新增产品
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#a3a3a3' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="搜索产品名称/型号..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none transition-colors"
            style={{ borderColor: '#e5e5e5' }}
            onFocus={e => e.currentTarget.style.borderColor = '#404040'}
            onBlur={e => e.currentTarget.style.borderColor = '#e5e5e5'}
          />
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="text-center py-20" style={{ color: '#a3a3a3' }}>加载中...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <Laptop className="w-12 h-12 mx-auto mb-3" style={{ color: '#d4d4d4' }} />
          <p style={{ color: '#a3a3a3' }}>{search ? '没有找到匹配的产品' : '暂无产品，点击右上角新增'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/products/${p.id}`)}
              className="bg-white rounded-xl border cursor-pointer transition-all hover:shadow-md group"
              style={{ borderColor: '#f0f0f0' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#d4d4d4'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#f0f0f0'}
            >
              {/* Image */}
              <div className="aspect-[16/10] rounded-t-xl overflow-hidden bg-gray-50 flex items-center justify-center">
                {p.images && p.images.length > 0 ? (
                  <img src={imgUrl(p.images[0])} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Laptop className="w-10 h-10" style={{ color: '#d4d4d4' }} />
                )}
              </div>
              {/* Info */}
              <div className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold truncate" style={{ color: '#1f1f1f' }}>{p.name}</h3>
                    {p.model_number && (
                      <p className="text-xs mt-0.5" style={{ color: '#a3a3a3' }}>{p.model_number}</p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    p.status === '在售' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>{p.status}</span>
                </div>
                {/* Key specs */}
                <div className="mt-3 space-y-1">
                  {p.cpu && (
                    <p className="text-xs truncate" style={{ color: '#737373' }}>
                      <span className="font-medium" style={{ color: '#525252' }}>CPU</span> {p.cpu}
                    </p>
                  )}
                  {p.ram && (
                    <p className="text-xs truncate" style={{ color: '#737373' }}>
                      <span className="font-medium" style={{ color: '#525252' }}>内存</span> {p.ram}
                    </p>
                  )}
                  {p.storage && (
                    <p className="text-xs truncate" style={{ color: '#737373' }}>
                      <span className="font-medium" style={{ color: '#525252' }}>存储</span> {p.storage}
                    </p>
                  )}
                </div>
                {/* Actions */}
                <div className="mt-3 pt-2 border-t flex items-center justify-end gap-1" style={{ borderColor: '#f5f5f5' }}>
                  {hasPermission('products:edit') && (
                    <button
                      onClick={e => openEdit(e, p)}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{ color: '#737373' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; e.stopPropagation() }}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >编辑</button>
                  )}
                  {hasPermission('products:delete') && (
                    <button
                      onClick={e => handleDelete(e, p.id)}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{ color: '#ef4444' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.stopPropagation() }}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >删除</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg border transition-colors disabled:opacity-30"
            style={{ borderColor: '#e5e5e5' }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm px-3" style={{ color: '#737373' }}>{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg border transition-colors disabled:opacity-30"
            style={{ borderColor: '#e5e5e5' }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 mb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#f0f0f0' }}>
              <h2 className="text-base font-semibold" style={{ color: '#1f1f1f' }}>
                {editId ? '编辑产品' : '新增产品'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" style={{ color: '#a3a3a3' }} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>产品名称 *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}
                    placeholder="如 ThinkPad X1 Carbon 2025" />
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

              {/* Images */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>产品图片</label>
                <ImageUpload images={form.images || []} onChange={imgs => setForm({ ...form, images: imgs })} />
              </div>

              {/* Specs */}
              <p className="text-xs font-semibold pt-2" style={{ color: '#737373' }}>硬件参数</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>处理器 (CPU)</label>
                  <input value={form.cpu} onChange={e => setForm({ ...form, cpu: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}
                    placeholder="如 Intel Core Ultra 7 258V" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>显卡 (GPU)</label>
                  <input value={form.gpu} onChange={e => setForm({ ...form, gpu: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}
                    placeholder="如 Intel Arc Graphics" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>内存 (RAM)</label>
                  <input value={form.ram} onChange={e => setForm({ ...form, ram: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}
                    placeholder="如 32GB LPDDR5x" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>内存频率</label>
                  <input value={form.ram_freq} onChange={e => setForm({ ...form, ram_freq: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}
                    placeholder="如 7467MHz" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>存储</label>
                  <input value={form.storage} onChange={e => setForm({ ...form, storage: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}
                    placeholder="如 1TB PCIe Gen4 SSD" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>屏幕</label>
                  <input value={form.display} onChange={e => setForm({ ...form, display: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}
                    placeholder="如 14英寸 2.8K OLED 120Hz" />
                </div>
              </div>

              {/* Other specs */}
              <p className="text-xs font-semibold pt-2" style={{ color: '#737373' }}>其他参数</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>电池</label>
                  <input value={form.battery} onChange={e => setForm({ ...form, battery: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}
                    placeholder="如 57Wh" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>重量</label>
                  <input value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}
                    placeholder="如 1.24kg" />
                </div>
              </div>

              {/* Ports */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>接口/端口</label>
                <div className="flex gap-2">
                  <input
                    value={portInput}
                    onChange={e => setPortInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPort() } }}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: '#e5e5e5' }}
                    placeholder="输入接口名称，按回车添加"
                  />
                  <button onClick={addPort}
                    className="px-3 py-2 text-sm rounded-lg border transition-colors"
                    style={{ borderColor: '#e5e5e5', color: '#525252' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >添加</button>
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

              {/* Description */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: '#525252' }}>补充说明</label>
                <textarea
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none resize-none" style={{ borderColor: '#e5e5e5' }}
                  placeholder="其他需要备注的信息..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#f0f0f0' }}>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ color: '#737373' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >取消</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ background: '#404040', color: 'white' }}
                onMouseEnter={e => e.currentTarget.style.background = '#262626'}
                onMouseLeave={e => e.currentTarget.style.background = '#404040'}
              >{saving ? '保存中...' : (editId ? '保存修改' : '创建产品')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
