import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { getModuleConfigs, updateModuleConfigs, getFieldLabels, setFieldLabel, deleteFieldLabel } from '../api/moduleConfig'
import type { ModuleConfigItem, FieldLabel } from '../types'

// 每个模块的已知数据库字段
const MODULE_FIELDS: Record<string, string[]> = {
  return_exchange: ['model', 'config', 'size', 'computer_price', 'accessories', 'accessories_price', 'return_tracking', 'send_tracking', 'shipping_fee', 'record_type'],
  repair: ['model', 'config', 'computer_price', 'accessories', 'return_tracking', 'send_tracking', 'shipping_fee'],
  gift: ['model', 'config', 'color', 'size', 'cost', 'order_amount', 'send_tracking', 'shipping_fee', 'ship_date'],
  gift_cashback: ['cashback_amount', 'reason', 'applicant'],
  gift_resend: ['shop_name', 'type', 'gift_detail', 'express_company', 'tracking_no'],
}

// 默认字段显示名
const FIELD_DEFAULTS: Record<string, string> = {
  model: '型号', config: '配置', size: '规格', computer_price: '电脑价格',
  accessories: '配件', accessories_price: '配件价格',
  return_tracking: '寄回单号', send_tracking: '寄出单号', shipping_fee: '运费',
  record_type: '类型', color: '颜色', cost: '成本', order_amount: '订单金额',
  ship_date: '出货日期', cashback_amount: '返现金额', reason: '原因',
  applicant: '申请人', shop_name: '店铺', type: '类型', gift_detail: '礼品明细',
  express_company: '快递公司', tracking_no: '快递单号',
}

const MODULE_LABELS: Record<string, string> = {
  return_exchange: '退换登记', repair: '维修登记', gift: '发货登记',
  gift_cashback: '返现登记', gift_resend: '礼品补发',
}

export default function ModuleSettingsPage() {
  const [modules, setModules] = useState<ModuleConfigItem[]>([])
  const [labels, setLabels] = useState<FieldLabel[]>([])
  const [activeModule, setActiveModule] = useState('return_exchange')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [editMap, setEditMap] = useState<Record<string, string>>({})

  const load = async () => {
    const mods = await getModuleConfigs()
    setModules(mods)
    if (!mods.find(m => m.module_key === activeModule)) {
      setActiveModule(mods[0]?.module_key || 'return_exchange')
    }
  }

  const loadLabels = async (key: string) => {
    const lbs = await getFieldLabels(key)
    setLabels(lbs)
    // Initialize edit map with current labels for this module's fields
    const map: Record<string, string> = {}
    for (const f of MODULE_FIELDS[key] || []) {
      const lab = lbs.find(l => l.field_name === f)
      map[f] = lab?.label || ''
    }
    setEditMap(map)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (activeModule) loadLabels(activeModule) }, [activeModule])

  const toggleModule = async (mod: ModuleConfigItem) => {
    const updated = modules.map(m => m.module_key === mod.module_key ? { ...m, enabled: !m.enabled } : m)
    setModules(updated)
    await updateModuleConfigs(updated.map(m => ({ module_key: m.module_key, enabled: m.enabled, display_name: m.display_name })))
  }

  const handleSaveLabels = async () => {
    setSaving(true)
    setMsg('')
    for (const [fieldName, label] of Object.entries(editMap)) {
      if (label) {
        await setFieldLabel({ module_key: activeModule, field_name: fieldName, label })
      }
    }
    setSaving(false)
    setMsg('保存成功')
    setTimeout(() => setMsg(''), 2000)
    loadLabels(activeModule)
  }

  const handleClearLabel = async (id: number) => {
    await deleteFieldLabel(id)
    loadLabels(activeModule)
  }

  const currentFields = MODULE_FIELDS[activeModule] || []
  const activeConfig = modules.find(m => m.module_key === activeModule)

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <h2 className="text-xl font-semibold text-gray-800">模块配置</h2>
      <p className="text-sm text-gray-500 -mt-3">管理业务模块的开关、名称和字段显示标签</p>

      {/* 模块开关 */}
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

      {/* 字段别名编辑 */}
      {activeModule && (
        <div className="bg-white border rounded-xl p-5 space-y-4" style={{ borderColor: '#f0f0f0' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {activeConfig?.display_name || MODULE_LABELS[activeModule]} — 字段显示名
            </h3>
            {msg && <span className="text-xs text-green-600">{msg}</span>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {currentFields.map(fieldName => {
              const label = labels.find(l => l.field_name === fieldName)
              return (
                <div key={fieldName} className="flex items-center gap-3">
                  <span className="w-28 text-xs text-gray-500 truncate">{fieldName}</span>
                  <span className="text-xs text-gray-300">→</span>
                  <input
                    value={editMap[fieldName] || ''}
                    onChange={e => setEditMap({ ...editMap, [fieldName]: e.target.value })}
                    placeholder={FIELD_DEFAULTS[fieldName] || fieldName}
                    className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    style={{ borderColor: '#e5e5e5' }}
                  />
                  {label && (
                    <button onClick={() => handleClearLabel(label.id)} className="text-xs text-red-400 hover:text-red-600">
                      重置
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <button
            onClick={handleSaveLabels}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? '保存中...' : '保存字段别名'}
          </button>
        </div>
      )}
    </div>
  )
}
