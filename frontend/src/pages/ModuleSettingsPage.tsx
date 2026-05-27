import { useEffect, useRef, useState } from 'react'
import {
  Save, Edit2, Check, X, Plus, Trash2, GripVertical, ChevronDown,
  RotateCcw, Wrench, Gift, DollarSign, PackageCheck,
  Box, Truck, FileText, ClipboardList, ShoppingCart, CreditCard,
  Calculator, BarChart3, Users, Settings, Mail, Bell, Calendar,
  Clock, Monitor, HardDrive, Printer,
  LucideIcon,
} from 'lucide-react'
import { getModuleConfigs, updateModuleConfigs, getFieldLabels, setFieldLabel, deleteFieldLabel } from '../api/moduleConfig'
import type { ModuleConfigItem, FieldLabel } from '../types'
import { MODULE_REGISTRY, ICON_MAP, type FieldDefinition } from '../config/moduleRegistry'

// 可选图标列表（含中文名）
const AVAILABLE_ICONS: { name: string; icon: LucideIcon; label: string }[] = [
  { name: 'RotateCcw',     icon: RotateCcw,      label: '退换' },
  { name: 'Wrench',        icon: Wrench,          label: '维修' },
  { name: 'Gift',          icon: Gift,            label: '发货' },
  { name: 'DollarSign',    icon: DollarSign,      label: '财务' },
  { name: 'PackageCheck',  icon: PackageCheck,    label: '包裹' },
  { name: 'Box',           icon: Box,             label: '仓储' },
  { name: 'Truck',         icon: Truck,           label: '物流' },
  { name: 'FileText',      icon: FileText,        label: '文档' },
  { name: 'ClipboardList', icon: ClipboardList,   label: '工单' },
  { name: 'ShoppingCart',  icon: ShoppingCart,    label: '采购' },
  { name: 'CreditCard',    icon: CreditCard,      label: '开票' },
  { name: 'Calculator',    icon: Calculator,      label: '结算' },
  { name: 'BarChart3',     icon: BarChart3,       label: '报表' },
  { name: 'Users',         icon: Users,           label: '人员' },
  { name: 'Settings',      icon: Settings,        label: '设置' },
  { name: 'Mail',          icon: Mail,            label: '邮件' },
  { name: 'Bell',          icon: Bell,            label: '通知' },
  { name: 'Calendar',      icon: Calendar,        label: '日程' },
  { name: 'Clock',         icon: Clock,           label: '考勤' },
  { name: 'Monitor',       icon: Monitor,         label: '看板' },
  { name: 'HardDrive',     icon: HardDrive,       label: '数据' },
  { name: 'Printer',       icon: Printer,         label: '打印' },
]

const NAV_GROUPS = ['客服业务', '仓储业务', '财务业务', '内部协作', '系统管理']

// 所有注册表模块 key（包括未在当前公司注册的）
const ALL_REGISTRY_KEYS = Object.keys(MODULE_REGISTRY)

export default function ModuleSettingsPage() {
  const [modules, setModules] = useState<ModuleConfigItem[]>([])
  const [labels, setLabels] = useState<FieldLabel[]>([])
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null)
  const iconPickerRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭图标选择器
  useEffect(() => {
    if (!iconPickerFor) return
    const handler = (e: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
        setIconPickerFor(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [iconPickerFor])

  // 本地编辑状态：模块级元数据
  const [editMeta, setEditMeta] = useState<Record<string, {
    display_name: string; icon: string; route_path: string; navigation_group: string; enabled: boolean
  }>>({})

  // 字段标签编辑状态
  const [fieldEdits, setFieldEdits] = useState<Record<string, Record<string, string>>>({})

  // 本地新增/删除的字段（module_key -> { mode: 'add'|'delete', fields: Set<string> }）
  const [localFields, setLocalFields] = useState<Record<string, { added: string[]; deleted: string[] }>>({})

  const load = async () => {
    const mods = await getModuleConfigs()
    setModules(mods)
    const meta: Record<string, any> = {}
    for (const m of mods) {
      meta[m.module_key] = {
        display_name: m.display_name || MODULE_REGISTRY[m.module_key]?.displayName || '',
        icon: m.icon || MODULE_REGISTRY[m.module_key]?.icon || 'PackageCheck',
        route_path: m.route_path || MODULE_REGISTRY[m.module_key]?.routePath || `/${m.module_key}`,
        navigation_group: m.navigation_group || MODULE_REGISTRY[m.module_key]?.navigationGroup || '',
        enabled: m.enabled,
      }
    }
    setEditMeta(meta)
    if (mods.length > 0 && !mods.find(m => m.module_key === expandedModule)) {
      setExpandedModule(null)
    }
  }

  const loadLabels = async (key: string) => {
    const lbs = await getFieldLabels(key)
    setLabels(lbs)
    const edits: Record<string, string> = {}
    const reg = MODULE_REGISTRY[key]
    const allFields = getEffectiveFields(key)
    for (const f of allFields) {
      const lab = lbs.find(l => l.field_name === f.name)
      edits[f.name] = lab?.label || ''
    }
    setFieldEdits(prev => ({ ...prev, [key]: edits }))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (expandedModule) loadLabels(expandedModule) }, [expandedModule])

  // 获取模块的有效字段（注册表字段 + 本地新增 - 本地删除）
  const getEffectiveFields = (moduleKey: string): FieldDefinition[] => {
    const reg = MODULE_REGISTRY[moduleKey]
    const baseFields = reg?.fields ? [...reg.fields] : []
    const local = localFields[moduleKey]
    if (!local) return baseFields

    // 移除已删除的
    let result = baseFields.filter(f => !local.deleted.includes(f.name))
    // 添加新增的
    for (const name of local.added) {
      if (!result.find(f => f.name === name)) {
        result.push({ name, label: name, type: 'text', required: false, sortOrder: 999 })
      }
    }
    return result
  }

  const metaFor = (key: string) => editMeta[key] || { display_name: '', icon: 'PackageCheck', route_path: '', navigation_group: '', enabled: false }

  const updateMeta = (key: string, field: string, value: any) => {
    setEditMeta(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const saveMeta = async (key: string) => {
    const m = editMeta[key]
    if (!m) return
    await updateModuleConfigs([{
      module_key: key,
      display_name: m.display_name,
      icon: m.icon,
      navigation_group: m.navigation_group,
      enabled: m.enabled,
    }])
    setMsg('模块信息已保存')
    setTimeout(() => setMsg(''), 2000)
  }

  const toggleModule = async (key: string) => {
    const newEnabled = !editMeta[key]?.enabled
    updateMeta(key, 'enabled', newEnabled)
    await updateModuleConfigs([{ module_key: key, enabled: newEnabled }])
  }

  const saveFieldLabels = async (moduleKey: string) => {
    setSaving(true)
    const edits = fieldEdits[moduleKey] || {}
    for (const [fieldName, label] of Object.entries(edits)) {
      if (label) {
        await setFieldLabel({ module_key: moduleKey, field_name: fieldName, label })
      }
    }
    // 处理删除的字段标签
    const local = localFields[moduleKey]
    if (local?.deleted.length) {
      for (const name of local.deleted) {
        const lab = labels.find(l => l.field_name === name)
        if (lab) await deleteFieldLabel(lab.id)
      }
    }
    setSaving(false)
    setMsg('字段标签已保存')
    setTimeout(() => setMsg(''), 2000)
    loadLabels(moduleKey)
    load()
  }

  const addField = (moduleKey: string) => {
    const name = prompt('请输入新字段名（英文标识）：')
    if (!name || !name.trim()) return
    const trimmed = name.trim().replace(/\s+/g, '_').toLowerCase()
    setLocalFields(prev => {
      const cur = prev[moduleKey] || { added: [], deleted: [] }
      const deletedIdx = cur.deleted.indexOf(trimmed)
      if (deletedIdx >= 0) {
        // 恢复之前删除的
        return {
          ...prev,
          [moduleKey]: { ...cur, deleted: cur.deleted.filter((_, i) => i !== deletedIdx) },
        }
      }
      if (cur.added.includes(trimmed)) return prev
      return {
        ...prev,
        [moduleKey]: { ...cur, added: [...cur.added, trimmed] },
      }
    })
  }

  const removeField = (moduleKey: string, fieldName: string) => {
    setLocalFields(prev => {
      const cur = prev[moduleKey] || { added: [], deleted: [] }
      const addedIdx = cur.added.indexOf(fieldName)
      if (addedIdx >= 0) {
        return {
          ...prev,
          [moduleKey]: { ...cur, added: cur.added.filter((_, i) => i !== addedIdx) },
        }
      }
      if (cur.deleted.includes(fieldName)) return prev
      return {
        ...prev,
        [moduleKey]: { ...cur, deleted: [...cur.deleted, fieldName] },
      }
    })
  }

  const isFieldDeleted = (moduleKey: string, fieldName: string): boolean => {
    return localFields[moduleKey]?.deleted?.includes(fieldName) || false
  }

  const isFieldAdded = (moduleKey: string, fieldName: string): boolean => {
    return localFields[moduleKey]?.added?.includes(fieldName) || false
  }

  const fieldEditValue = (moduleKey: string, fieldName: string): string => {
    return fieldEdits[moduleKey]?.[fieldName] || ''
  }

  const setFieldEditValue = (moduleKey: string, fieldName: string, value: string) => {
    setFieldEdits(prev => ({
      ...prev,
      [moduleKey]: { ...(prev[moduleKey] || {}), [fieldName]: value },
    }))
  }

  // 新增模块（从注册表）
  const addModule = async (moduleKey: string) => {
    await updateModuleConfigs([{
      module_key: moduleKey,
      enabled: true,
      display_name: MODULE_REGISTRY[moduleKey]?.displayName || moduleKey,
      icon: MODULE_REGISTRY[moduleKey]?.icon || 'PackageCheck',
      route_path: MODULE_REGISTRY[moduleKey]?.routePath || `/${moduleKey}`,
      navigation_group: MODULE_REGISTRY[moduleKey]?.navigationGroup || '',
    }])
    await load()
    setMsg(`模块 "${MODULE_REGISTRY[moduleKey]?.displayName}" 已添加`)
    setTimeout(() => setMsg(''), 2000)
  }

  const registeredKeys = new Set(modules.map(m => m.module_key))
  const unregisteredKeys = ALL_REGISTRY_KEYS.filter(k => !registeredKeys.has(k))

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">模块配置</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            管理业务模块的启用状态、显示名称、图标路由及字段标签
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs text-green-600 font-medium">{msg}</span>}
        </div>
      </div>

      {/* 模块表格 */}
      <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
        {/* 表头 */}
        <div className="grid items-center px-4 py-2.5 text-xs font-medium text-gray-400 border-b bg-gray-50/50 gap-x-3"
          style={{
            gridTemplateColumns: '40px 120px 1fr 125px 105px 64px 80px 110px',
            borderColor: '#f0f0f0',
          }}>
          <span></span>
          <span>标识</span>
          <span>显示名 / 图标</span>
          <span>路由（固定）</span>
          <span>导航分组</span>
          <span className="text-center">状态</span>
          <span className="text-center">字段</span>
          <span className="text-center">操作</span>
        </div>

        {/* 模块行 */}
        {modules.map(mod => {
          const meta = metaFor(mod.module_key)
          const reg = MODULE_REGISTRY[mod.module_key]
          const isExpanded = expandedModule === mod.module_key
          const IconComp = ICON_MAP[meta.icon] || ICON_MAP['PackageCheck'] || PackageCheck
          const fields = getEffectiveFields(mod.module_key)

          return (
            <div key={mod.module_key}>
              <div
                className="grid items-center px-4 py-2.5 border-b hover:bg-gray-50/50 transition-colors gap-x-3"
                style={{
                  gridTemplateColumns: '40px 120px 1fr 125px 105px 64px 80px 110px',
                  borderColor: '#f0f0f0',
                  background: isExpanded ? '#f8fafc' : undefined,
                }}
              >
                {/* 展开/收起 */}
                <button
                  onClick={() => setExpandedModule(isExpanded ? null : mod.module_key)}
                  className="flex items-center justify-center"
                  style={{ color: '#a3a3a3' }}
                >
                  <ChevronDown
                    size={16}
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                  />
                </button>

                {/* 标识 */}
                <span className="text-xs font-mono text-gray-500">{mod.module_key}</span>

                {/* 显示名 + 图标 */}
                <div className="flex items-center gap-2 min-w-0">
                  {/* 图标选择 */}
                  <div className="relative flex-shrink-0" ref={iconPickerFor === mod.module_key ? iconPickerRef : undefined}>
                    <button
                      onClick={() => setIconPickerFor(iconPickerFor === mod.module_key ? null : mod.module_key)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:ring-2 hover:ring-blue-200 transition-all"
                      style={{ background: '#f4f4f5' }}
                      title={AVAILABLE_ICONS.find(i => i.name === meta.icon)?.label || meta.icon}
                    >
                      <IconComp size={14} style={{ color: '#52525b' }} />
                    </button>
                    {iconPickerFor === mod.module_key && (
                      <div
                        className="absolute top-full left-0 mt-1 w-44 bg-white border rounded-xl shadow-lg z-30 py-1 max-h-56 overflow-y-auto"
                        style={{ borderColor: '#e5e5e5' }}
                      >
                        {AVAILABLE_ICONS.map(ic => {
                          const Ic = ic.icon
                          const isActive = meta.icon === ic.name
                          return (
                            <button
                              key={ic.name}
                              onClick={() => { updateMeta(mod.module_key, 'icon', ic.name); setIconPickerFor(null) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-gray-50"
                              style={{ color: isActive ? '#2563eb' : '#404040', background: isActive ? '#eff6ff' : undefined }}
                            >
                              <span className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                                style={{ background: isActive ? '#dbeafe' : '#f4f4f5' }}>
                                <Ic size={13} style={{ color: isActive ? '#2563eb' : '#52525b' }} />
                              </span>
                              <span className="font-medium">{ic.label}</span>
                              <span className="text-[10px] text-gray-400 ml-auto">{ic.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <input
                    value={meta.display_name}
                    onChange={e => updateMeta(mod.module_key, 'display_name', e.target.value)}
                    placeholder={reg?.displayName || mod.module_key}
                    className="flex-1 min-w-0 border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-200"
                    style={{ borderColor: '#e5e5e5' }}
                  />
                </div>

                {/* 路由（只读，由注册表定义） */}
                <span className="text-xs font-mono px-2 py-1 rounded select-all"
                  style={{ background: '#f4f4f5', color: '#71717a' }}>
                  {reg?.routePath || `/${mod.module_key}`}
                </span>

                {/* 导航分组 */}
                <select
                  value={meta.navigation_group}
                  onChange={e => updateMeta(mod.module_key, 'navigation_group', e.target.value)}
                  className="border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-200"
                  style={{ borderColor: '#e5e5e5', color: '#404040' }}
                >
                  <option value="">—</option>
                  {NAV_GROUPS.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>

                {/* 状态 */}
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleModule(mod.module_key)}
                    className={`w-9 h-5 rounded-full transition-colors ${meta.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      meta.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* 字段数 */}
                <div className="text-center">
                  <span className="text-xs text-gray-500">{fields.length} 个</span>
                </div>

                {/* 操作 */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => saveMeta(mod.module_key)}
                    className="px-3 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                    style={{ background: '#404040', color: 'white' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#262626'}
                    onMouseLeave={e => e.currentTarget.style.background = '#404040'}
                  >
                    <Save size={10} /> 保存
                  </button>
                </div>
              </div>

              {/* 展开行：字段管理 */}
              {isExpanded && (
                <div className="border-b px-4 py-3" style={{ borderColor: '#f0f0f0', background: '#fafafa' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      字段管理
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => addField(mod.module_key)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                        style={{ background: '#e5e7eb', color: '#404040' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#d1d5db'}
                        onMouseLeave={e => e.currentTarget.style.background = '#e5e7eb'}
                      >
                        <Plus size={10} /> 添加字段
                      </button>
                      <button
                        onClick={() => saveFieldLabels(mod.module_key)}
                        disabled={saving}
                        className="px-3 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                        style={{ background: '#3b82f6', color: 'white' }}
                      >
                        <Save size={10} /> {saving ? '保存中' : '保存字段'}
                      </button>
                    </div>
                  </div>

                  {/* 字段表格头 */}
                  <div className="grid items-center px-3 py-1.5 mb-1 text-[10px] font-medium text-gray-400"
                    style={{
                      gridTemplateColumns: '24px 120px 60px 160px 1fr 60px',
                    }}>
                    <span></span>
                    <span>字段名</span>
                    <span>类型</span>
                    <span>默认标签</span>
                    <span>自定义标签</span>
                    <span></span>
                  </div>

                  {/* 字段行 */}
                  {fields.map(field => {
                    const regField = MODULE_REGISTRY[mod.module_key]?.fields?.find(f => f.name === field.name)
                    const deleted = isFieldDeleted(mod.module_key, field.name)
                    const added = isFieldAdded(mod.module_key, field.name)
                    const hasCustomLabel = labels.find(l => l.field_name === field.name)

                    return (
                      <div
                        key={field.name}
                        className="grid items-center px-3 py-2 rounded-lg mb-0.5 transition-colors"
                        style={{
                          gridTemplateColumns: '24px 120px 60px 160px 1fr 60px',
                          background: deleted ? '#fef2f2' : added ? '#f0fdf4' : 'white',
                          opacity: deleted ? 0.6 : 1,
                          border: `1px solid ${deleted ? '#fecaca' : added ? '#bbf7d0' : '#f0f0f0'}`,
                        }}
                      >
                        <span style={{ color: '#a3a3a3' }}>
                          <GripVertical size={12} />
                        </span>

                        <div>
                          <span className="text-xs font-mono text-gray-700">{field.name}</span>
                          {added && <span className="ml-1 text-[10px] text-green-600">新增</span>}
                        </div>

                        <span className="text-[10px] px-1.5 py-0.5 rounded text-center"
                          style={{ background: '#f4f4f5', color: '#71717a', width: 'fit-content' }}>
                          {regField?.type || field.type || 'text'}
                        </span>

                        <span className="text-xs text-gray-400 truncate">
                          {regField?.label || field.label || field.name}
                        </span>

                        <input
                          value={fieldEditValue(mod.module_key, field.name)}
                          onChange={e => setFieldEditValue(mod.module_key, field.name, e.target.value)}
                          placeholder={regField?.label || '（使用默认）'}
                          disabled={deleted}
                          className="border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-200 disabled:opacity-50"
                          style={{ borderColor: '#e5e5e5' }}
                        />

                        <div className="flex justify-end">
                          {deleted ? (
                            <button
                              onClick={() => removeField(mod.module_key, field.name)}
                              className="text-xs text-blue-500 hover:text-blue-700"
                            >
                              恢复
                            </button>
                          ) : (
                            <button
                              onClick={() => removeField(mod.module_key, field.name)}
                              className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {fields.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">暂无字段，点击"添加字段"创建</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 未注册模块 */}
      {unregisteredKeys.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-medium text-amber-800 mb-2">
            注册表中未启用的模块 ({unregisteredKeys.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {unregisteredKeys.map(key => (
              <button
                key={key}
                onClick={() => addModule(key)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                style={{ background: 'white', color: '#92400e', border: '1px solid #fcd34d' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fef3c7'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >
                <Plus size={12} />
                {MODULE_REGISTRY[key]?.displayName || key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 说明 */}
      <p className="text-xs text-gray-400">
        提示：修改模块元数据（显示名、图标、路由、分组）后需点击「保存」生效。
        字段标签修改后需点击「保存字段」。删除字段仅移除自定义标签和本地定义，不影响注册表。
      </p>
    </div>
  )
}
