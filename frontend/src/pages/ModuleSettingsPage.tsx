import { useEffect, useState, useRef } from 'react'
import { Save, Upload, Store, Edit2, Check, X } from 'lucide-react'
import { getModuleConfigs, updateModuleConfigs, getFieldLabels, setFieldLabel, deleteFieldLabel } from '../api/moduleConfig'
import type { ModuleConfigItem, FieldLabel } from '../types'
import client from '../api/client'

const MODULE_FIELDS: Record<string, string[]> = {
  return_exchange: ['model', 'config', 'size', 'computer_price', 'accessories', 'accessories_price', 'return_tracking', 'send_tracking', 'shipping_fee', 'record_type'],
  repair: ['model', 'config', 'computer_price', 'accessories', 'return_tracking', 'send_tracking', 'shipping_fee'],
  gift: ['model', 'config', 'color', 'size', 'cost', 'order_amount', 'send_tracking', 'shipping_fee', 'ship_date'],
  gift_cashback: ['cashback_amount', 'reason', 'applicant'],
  gift_resend: ['shop_name', 'type', 'gift_detail', 'express_company', 'tracking_no'],
}

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
  const [renameMap, setRenameMap] = useState<Record<string, string>>({})
  const [brandName, setBrandName] = useState('')
  const [logoPreview, setLogoPreview] = useState('')
  const logoRef = useRef<HTMLInputElement>(null)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [tempName, setTempName] = useState('')

  const load = async () => {
    const mods = await getModuleConfigs()
    setModules(mods)
    setRenameMap(Object.fromEntries(mods.map(m => [m.module_key, m.display_name || ''])))
    if (!mods.find(m => m.module_key === activeModule)) {
      setActiveModule(mods[0]?.module_key || 'return_exchange')
    }
    // Load branding
    try {
      const b = await client.get('/company/branding')
      setBrandName(b.data.display_name || '')
      setLogoPreview(b.data.logo_url || '')
    } catch {}
  }

  const handleLogoUpload = async () => {
    const file = logoRef.current?.files?.[0]
    if (!file || file.size > 5*1024*1024) { alert('LOGO不能超过5MB'); return }
    const form = new FormData(); form.append('file', file)
    try {
      const r = await client.post('/company/logo', form)
      setLogoPreview(r.data.logo_url)
    } catch { alert('上传失败') }
  }

  const handleSaveBrand = async () => {
    await client.put('/company/branding', null, { params: { display_name: brandName } })
    setMsg('品牌信息已保存')
    setTimeout(() => setMsg(''), 2000)
  }

  const loadLabels = async (key: string) => {
    const lbs = await getFieldLabels(key)
    setLabels(lbs)
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
    await updateModuleConfigs(updated.map(m => ({ module_key: m.module_key, enabled: m.enabled, display_name: renameMap[m.module_key] })))
  }

  const startRename = (mod: ModuleConfigItem) => {
    setEditingName(mod.module_key)
    setTempName(renameMap[mod.module_key] || MODULE_LABELS[mod.module_key] || '')
  }
  const confirmRename = async (mod: ModuleConfigItem) => {
    const name = tempName.trim()
    setRenameMap({ ...renameMap, [mod.module_key]: name })
    await updateModuleConfigs([{ module_key: mod.module_key, display_name: name }])
    setEditingName(null)
  }
  const cancelRename = () => { setEditingName(null) }

  const handleSaveLabels = async () => {
    setSaving(true); setMsg('')
    for (const [fieldName, label] of Object.entries(editMap)) {
      if (label) await setFieldLabel({ module_key: activeModule, field_name: fieldName, label })
    }
    setSaving(false); setMsg('保存成功')
    setTimeout(() => setMsg(''), 2000)
    loadLabels(activeModule)
  }

  const handleClearLabel = async (id: number) => { await deleteFieldLabel(id); loadLabels(activeModule) }

  const currentFields = MODULE_FIELDS[activeModule] || []
  const activeConfig = modules.find(m => m.module_key === activeModule)

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h2 className="text-lg font-semibold text-gray-800">模块配置</h2>

      {/* 公司品牌 */}
      <div className="bg-white border rounded-lg p-4 flex items-center gap-4" style={{ borderColor: '#f0f0f0' }}>
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0" style={{ background: '#f5f5f5' }}>
          {logoPreview ? (
            <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
          ) : (
            <Store className="w-6 h-6 text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">公司名称</label>
          <input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="默认公司"
            className="w-full border rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-100" style={{ borderColor: '#e5e5e5' }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="px-3 py-1.5 border rounded text-xs cursor-pointer hover:bg-gray-50 flex items-center gap-1">
            <Upload size={12} /> 上传LOGO
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
          </label>
          <button onClick={handleSaveBrand}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded">保存</button>
        </div>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4 items-start">
        {/* 左侧：模块列表 */}
        <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
          {modules.map(mod => (
            <div
              key={mod.module_key}
              onClick={() => setActiveModule(mod.module_key)}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b last:border-b-0 ${
                activeModule === mod.module_key ? 'bg-blue-50/50' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {editingName === mod.module_key ? (
                  <>
                    <input
                      value={tempName}
                      onChange={e => setTempName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') confirmRename(mod); if (e.key === 'Escape') cancelRename() }}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                      className="flex-1 border rounded px-2 py-0.5 text-sm outline-none focus:ring-1 focus:ring-blue-200"
                      style={{ borderColor: '#d1d5db' }}
                    />
                    <button onClick={e => { e.stopPropagation(); confirmRename(mod) }}
                      className="p-0.5 hover:bg-green-50 rounded text-green-500"><Check size={14} /></button>
                    <button onClick={e => { e.stopPropagation(); cancelRename() }}
                      className="p-0.5 hover:bg-red-50 rounded text-red-400"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-700">
                      {renameMap[mod.module_key] || MODULE_LABELS[mod.module_key] || mod.module_key}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); startRename(mod) }}
                      className="p-0.5 hover:bg-gray-100 rounded text-gray-400"
                    ><Edit2 size={12} /></button>
                  </>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); toggleModule(mod) }}
                className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-3 ${mod.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${mod.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>

        {/* 右侧：字段别名 */}
        <div className="bg-white border rounded-xl p-4 space-y-3" style={{ borderColor: '#f0f0f0' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-600">
              {activeConfig?.display_name || MODULE_LABELS[activeModule]} 字段标签
            </h3>
            <div className="flex items-center gap-3">
              {msg && <span className="text-xs text-green-600">{msg}</span>}
              <button onClick={handleSaveLabels} disabled={saving}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg flex items-center gap-1 disabled:opacity-50">
                <Save size={12} /> {saving ? '保存中' : '保存'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {currentFields.map(fieldName => {
              const label = labels.find(l => l.field_name === fieldName)
              return (
                <div key={fieldName} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20 flex-shrink-0 truncate" title={fieldName}>
                    {fieldName}
                  </span>
                  <input
                    value={editMap[fieldName] || ''}
                    onChange={e => setEditMap({ ...editMap, [fieldName]: e.target.value })}
                    placeholder={FIELD_DEFAULTS[fieldName] || ''}
                    className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    style={{ borderColor: '#e5e5e5' }}
                  />
                  {label && (
                    <button onClick={() => handleClearLabel(label.id)} className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">
                      重置
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-xs text-gray-400">
            修改左侧模块名或右侧字段标签后点击保存。留空则使用默认名称。
          </p>
        </div>
      </div>
    </div>
  )
}
