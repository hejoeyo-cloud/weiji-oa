import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Check, Settings } from 'lucide-react'
import { getShops, createShop, updateShop, deleteShop } from '../api/shops'
import type { Shop } from '../types'

interface ShopSelectProps {
  value: string
  onChange: (name: string) => void
  className?: string
  showGear?: boolean
  placeholder?: string
}

export default function ShopSelect({ value, onChange, className = '', showGear = true, placeholder = '请选择店铺' }: ShopSelectProps) {
  const [shops, setShops] = useState<Shop[]>([])
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadShops = () => getShops().then(setShops).catch(() => {})
  useEffect(() => { loadShops() }, [])

  useEffect(() => {
    if (showModal && inputRef.current) inputRef.current.focus()
  }, [showModal])

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    setLoading(true)
    try {
      const shop = await createShop({ name })
      setShops(prev => [...prev, shop].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
    } catch {
      // duplicate or error
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (id: number) => {
    const name = editName.trim()
    if (!name) return
    setLoading(true)
    try {
      const shop = await updateShop(id, { name })
      setShops(prev => prev.map(s => s.id === id ? shop : s).sort((a, b) => a.name.localeCompare(b.name)))
      if (value === shops.find(s => s.id === id)?.name) {
        onChange(shop.name)
      }
      setEditId(null)
      setEditName('')
    } catch {
      // duplicate or error
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定删除店铺「${name}」吗？`)) return
    setLoading(true)
    try {
      await deleteShop(id)
      setShops(prev => prev.filter(s => s.id !== id))
      if (value === name) onChange('')
    } catch {
      // error
    } finally {
      setLoading(false)
    }
  }

  const selectCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${className}`
  const allOptions = value && !shops.some(s => s.name === value)
    ? [{ id: -1, name: value, address: '', contact: '', created_by: 0 }, ...shops]
    : shops

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <select
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className={selectCls + ' flex-1'}
        >
          <option value="">{placeholder}</option>
          {allOptions.map(s => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
        {showGear && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-violet-500 flex-shrink-0 transition-colors"
            title="管理店铺"
          >
            <Settings size={12} />
          </button>
        )}
      </div>

      {/* 店铺管理弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-base font-semibold text-gray-800">管理店铺</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* 新增输入 */}
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
                  placeholder="输入新店铺名称"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  onClick={handleAdd}
                  disabled={loading || !newName.trim()}
                  className="px-3 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-40 flex items-center gap-1"
                >
                  <Plus size={14} /> 添加
                </button>
              </div>
            </div>

            {/* 店铺列表 */}
            <div className="px-5 pb-5 max-h-60 overflow-y-auto">
              {shops.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-4">暂无店铺，请添加</p>
              ) : (
                <div className="space-y-1.5">
                  {shops.map(s => (
                    <div key={s.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-gray-50 group">
                      {editId === s.id ? (
                        <>
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleUpdate(s.id) } if (e.key === 'Escape') { setEditId(null) } }}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            autoFocus
                          />
                          <button onClick={() => handleUpdate(s.id)} disabled={loading} className="p-1 hover:bg-green-50 rounded text-green-600">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditId(null)} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-gray-700">{s.name}</span>
                          <button
                            onClick={() => { setEditId(s.id); setEditName(s.name) }}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.name)}
                            className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
