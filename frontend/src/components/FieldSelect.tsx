import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Check, Settings, ChevronDown } from 'lucide-react'
import api from '../api/client'

interface FieldOption {
  id: number
  field_name: string
  value: string
}

interface FieldSelectProps {
  fieldName: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  showGear?: boolean
}

export default function FieldSelect({
  fieldName,
  label,
  value,
  onChange,
  placeholder = '',
  className = '',
  showGear = true
}: FieldSelectProps) {
  const [options, setOptions] = useState<FieldOption[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadOptions = () => {
    api.get(`/field-options/${fieldName}`)
      .then(res => {
        const data = res.data
        setOptions(Array.isArray(data) ? data : [])
      })
      .catch(() => setOptions([]))
  }

  useEffect(() => { loadOptions() }, [fieldName])

  useEffect(() => {
    if (showModal && inputRef.current) inputRef.current.focus()
  }, [showModal])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    setLoading(true)
    try {
      const res = await api.post('/field-options/', { field_name: fieldName, value: name })
      setOptions(prev => [...prev, res.data].sort((a, b) => a.value.localeCompare(b.value)))
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
      await api.delete(`/field-options/${id}`)
      const res = await api.post('/field-options/', { field_name: fieldName, value: name })
      setOptions(prev => prev.filter(o => o.id !== id).concat(res.data).sort((a, b) => a.value.localeCompare(b.value)))
      if (value === options.find(o => o.id === id)?.value) {
        onChange(name)
      }
      setEditId(null)
      setEditName('')
    } catch {
      // error
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定删除「${name}」吗？`)) return
    setLoading(true)
    try {
      await api.delete(`/field-options/${id}`)
      setOptions(prev => prev.filter(o => o.id !== id))
      if (value === name) onChange('')
    } catch {
      // error
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setShowDropdown(false)
  }

  const inputCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${className}`

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <div className="relative flex-1" ref={dropdownRef}>
          <input
            type="text"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || `请输入${label}`}
            className={inputCls + ' pr-8'}
          />
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded text-gray-400"
          >
            <ChevronDown size={16} />
          </button>

          {/* 下拉选项列表 */}
          {showDropdown && options.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
              {options.map(o => (
                <div
                  key={o.id}
                  onClick={() => handleSelect(o.value)}
                  className="px-3 py-2 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 cursor-pointer"
                >
                  {o.value}
                </div>
              ))}
            </div>
          )}
        </div>
        {showGear && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-violet-500 flex-shrink-0 transition-colors"
            title={`管理${label}`}
          >
            <Settings size={12} />
          </button>
        )}
      </div>

      {/* 选项管理弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-base font-semibold text-gray-800">管理{label}</h3>
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
                  placeholder={`输入新${label}`}
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

            {/* 选项列表 */}
            <div className="px-5 pb-5 max-h-60 overflow-y-auto">
              {options.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-4">暂无{label}，请添加</p>
              ) : (
                <div className="space-y-1.5">
                  {options.map(o => (
                    <div key={o.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-gray-50 group">
                      {editId === o.id ? (
                        <>
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleUpdate(o.id) } if (e.key === 'Escape') { setEditId(null) } }}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            autoFocus
                          />
                          <button onClick={() => handleUpdate(o.id)} disabled={loading} className="p-1 hover:bg-green-50 rounded text-green-600">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditId(null)} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-gray-700">{o.value}</span>
                          <button
                            onClick={() => { setEditId(o.id); setEditName(o.value) }}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(o.id, o.value)}
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
