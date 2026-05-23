import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Check } from 'lucide-react'
import { getModuleConfigs, updateModuleConfigs, getModuleFieldConfigs, createModuleField, updateModuleField, deleteModuleField } from '../api/moduleConfig'
import type { ModuleConfigItem, ModuleFieldConfig } from '../types'

const MODULE_LABELS: Record<string, string> = {
  return_exchange: '退换登记',
  repair: '维修登记',
  gift: '发货登记',
  gift_cashback: '返现登记',
  gift_resend: '礼品补发',
}

export default function ModuleSettingsPage() {
  const [modules, setModules] = useState<ModuleConfigItem[]>([])
  const [fields, setFields] = useState<Record<string, ModuleFieldConfig[]>>({})
  const [activeModule, setActiveModule] = useState('return_exchange')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // New field form
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState('text')
  const [newOptions, setNewOptions] = useState('')
  const [newRequired, setNewRequired] = useState(false)

  const load = async () => {
    const mods = await getModuleConfigs()
    setModules(mods)
    if (!mods.find(m => m.module_key === activeModule)) {
      setActiveModule(mods[0]?.module_key || 'return_exchange')
    }
  }

  const loadFields = async (key: string) => {
    const f = await getModuleFieldConfigs(key)
    setFields(prev => ({ ...prev, [key]: f }))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (activeModule) loadFields(activeModule) }, [activeModule])

  const toggleModule = async (mod: ModuleConfigItem) => {
    const updated = modules.map(m => m.module_key === mod.module_key ? { ...m, enabled: !m.enabled } : m)
    setModules(updated)
    await updateModuleConfigs(updated.map(m => ({ module_key: m.module_key, enabled: m.enabled, display_name: m.display_name })))
  }

  const handleAddField = async () => {
    if (!newLabel.trim()) return
    await createModuleField({
      module_key: activeModule,
      field_label: newLabel,
      field_type: newType,
      field_options: newType === 'select' ? JSON.stringify(newOptions.split(',').map(s => s.trim()).filter(Boolean)) : '[]',
      required: newRequired,
    })
    setNewLabel(''); setNewType('text'); setNewOptions(''); setNewRequired(false)
    loadFields(activeModule)
    setMsg('字段已添加')
    setTimeout(() => setMsg(''), 2000)
  }

  const handleDeleteField = async (id: number) => {
    if (!confirm('删除此字段？已有数据不会丢失，只是不再显示。')) return
    await deleteModuleField(id)
    loadFields(activeModule)
  }

  const currentFields = fields[activeModule] || []
  const activeConfig = modules.find(m => m.module_key === activeModule)

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <h2 className="text-xl font-semibold text-gray-800">模块配置</h2>
      <p className="text-sm text-gray-500 -mt-3">管理各业务模块的开关、名称和自定义字段</p>

      {/* 模块开关列表 */}
      <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
        <div className="divide-y">
          {modules.map(mod => (
            <div
              key={mod.module_key}
              onClick={() => setActiveModule(mod.module_key)}
              className={`flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                activeModule === mod.module_key ? 'bg-blue-50/50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${mod.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm font-medium text-gray-700">
                  {mod.display_name || MODULE_LABELS[mod.module_key] || mod.module_key}
                </span>
                <span className="text-xs text-gray-400">({mod.module_key})</span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); toggleModule(mod) }}
                className={`w-11 h-6 rounded-full transition-colors ${mod.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${mod.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 字段配置 */}
      {activeModule && (
        <div className="bg-white border rounded-xl p-5 space-y-4" style={{ borderColor: '#f0f0f0' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {activeConfig?.display_name || MODULE_LABELS[activeModule]} — 自定义字段
            </h3>
            {msg && <span className="text-xs text-green-600">{msg}</span>}
          </div>

          {/* 已有字段列表 */}
          {currentFields.length > 0 ? (
            <div className="divide-y border rounded-lg" style={{ borderColor: '#f0f0f0' }}>
              {currentFields.map(f => (
                <div key={f.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-700">{f.field_label}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{f.field_type}</span>
                    {f.required && <span className="text-xs text-red-400">必填</span>}
                  </div>
                  <button onClick={() => handleDeleteField(f.id)} className="p-1 hover:bg-red-50 rounded text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">暂无自定义字段，在下方添加</p>
          )}

          {/* 添加字段 */}
          <div className="flex items-end gap-3 pt-2 border-t" style={{ borderColor: '#f0f0f0' }}>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">字段名</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="如：型号"
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" style={{ borderColor: '#e5e5e5' }} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">类型</label>
              <select value={newType} onChange={e => setNewType(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: '#e5e5e5' }}>
                <option value="text">文本</option>
                <option value="number">数字</option>
                <option value="date">日期</option>
                <option value="select">下拉</option>
              </select>
            </div>
            {newType === 'select' && (
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">选项（逗号分隔）</label>
                <input value={newOptions} onChange={e => setNewOptions(e.target.value)} placeholder="选项1,选项2"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: '#e5e5e5' }} />
              </div>
            )}
            <label className="flex items-center gap-1 pb-2">
              <input type="checkbox" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} />
              <span className="text-xs text-gray-500">必填</span>
            </label>
            <button onClick={handleAddField} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1 whitespace-nowrap">
              <Plus size={14} /> 添加
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
