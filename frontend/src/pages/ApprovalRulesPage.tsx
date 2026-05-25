import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit2, X, Check, Users } from 'lucide-react'
import { getRules, createRule, updateRule, deleteRule } from '../api/approvalRules'
import { getUsers } from '../api/users'
import type { ApprovalRule, UserBrief } from '../types'

const MODULES = [
  { key: 'return_exchange', label: '退换登记' },
  { key: 'repair', label: '维修登记' },
]

const OPS = [
  { key: 'gt', label: '>' },
  { key: 'gte', label: '>=' },
  { key: 'lt', label: '<' },
  { key: 'lte', label: '<=' },
  { key: 'eq', label: '=' },
  { key: 'contains', label: '包含' },
]

const FIELDS: Record<string, { key: string; label: string }[]> = {
  return_exchange: [
    { key: 'computer_price', label: '电脑价格' },
    { key: 'accessories_price', label: '配件价格' },
    { key: 'record_type', label: '类型(退/换)' },
  ],
  repair: [
    { key: 'computer_price', label: '电脑价格' },
  ],
}

export default function ApprovalRulesPage() {
  const [rules, setRules] = useState<ApprovalRule[]>([])
  const [editing, setEditing] = useState<ApprovalRule | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [users, setUsers] = useState<UserBrief[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [selectedApprovers, setSelectedApprovers] = useState<UserBrief[]>([])

  // Form state
  const [name, setName] = useState('')
  const [module, setModule] = useState('return_exchange')
  const [field, setField] = useState('')
  const [op, setOp] = useState('gt')
  const [value, setValue] = useState('')
  const [mode, setMode] = useState('or')

  const load = async () => { setRules(await getRules()) }
  const loadUsers = async () => { try { const r = await getUsers(); setUsers((r.data||r||[]).map((u:any)=>({id:u.id,name:u.name}))) } catch {} }

  useEffect(() => { load(); loadUsers() }, [])

  const openNew = () => {
    setEditing(null); setName(''); setModule('return_exchange'); setField(''); setOp('gt'); setValue(''); setMode('or')
    setSelectedApprovers([]); setUserSearch(''); setShowForm(true)
  }

  const openEdit = (rule: ApprovalRule) => {
    setEditing(rule); setName(rule.name); setModule(rule.target_module); setField(rule.condition_field)
    setOp(rule.condition_op); setValue(rule.condition_value); setMode(rule.sign_mode)
    const ids = rule.approver_ids.split(',').filter(Boolean).map(Number)
    const names = rule.approver_names.split(',').filter(Boolean)
    setSelectedApprovers(ids.map((id, i) => ({ id, name: names[i] || String(id) })))
    setUserSearch(''); setShowForm(true)
  }

  const save = async () => {
    const data = {
      name, target_module: module, condition_field: field, condition_op: op,
      condition_value: value, sign_mode: mode,
      approver_ids: selectedApprovers.map(u => u.id).join(','),
      enabled: true, sort_order: editing?.sort_order ?? 0,
    }
    if (editing) await updateRule(editing.id, data)
    else await createRule(data)
    setShowForm(false); load()
  }

  const remove = async (id: number) => { await deleteRule(id); load() }

  const addApprover = (u: UserBrief) => {
    if (!selectedApprovers.find(a => a.id === u.id)) {
      setSelectedApprovers([...selectedApprovers, u])
    }
    setUserSearch('')
  }

  const filteredUsers = userSearch ? users.filter(u => u.name.includes(userSearch)).slice(0, 8) : []

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">审批规则配置</h2>
        <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg flex items-center gap-1.5">
          <Plus size={14} /> 新增规则
        </button>
      </div>

      {rules.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">暂无审批规则，点击右上角新增</div>
      )}

      {rules.map(rule => (
        <div key={rule.id} className="bg-white border rounded-lg p-4 flex items-center gap-4"
          style={{ borderColor: '#f0f0f0' }}>
          <div className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-700">{rule.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              模块: {MODULES.find(m=>m.key===rule.target_module)?.label||rule.target_module}
              {rule.condition_field && ` | 条件: ${FIELDS[rule.target_module]?.find(f=>f.key===rule.condition_field)?.label||rule.condition_field} ${OPS.find(o=>o.key===rule.condition_op)?.label||rule.condition_op} ${rule.condition_value}`}
              {!rule.condition_field && ' | 无条件'}
              {' '}| {rule.sign_mode==='and' ? '会签' : '或签'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              审批人: {rule.approver_names || rule.approver_ids}
            </div>
          </div>
          <button onClick={() => openEdit(rule)} className="p-2 hover:bg-gray-100 rounded text-gray-400">
            <Edit2 size={14} /></button>
          <button onClick={() => remove(rule.id)} className="p-2 hover:bg-red-50 rounded text-red-400">
            <Trash2 size={14} /></button>
        </div>
      ))}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[520px] max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: '#f0f0f0' }}>
              <h3 className="text-sm font-semibold">{editing ? '编辑规则' : '新增规则'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">规则名称</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="如: 高价退换需经理审批"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" style={{ borderColor:'#e5e5e5' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">目标模块</label>
                  <select value={module} onChange={e => { setModule(e.target.value); setField('') }}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor:'#e5e5e5' }}>
                    {MODULES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">审批模式</label>
                  <div className="flex rounded-lg border overflow-hidden" style={{ borderColor:'#e5e5e5' }}>
                    <button onClick={()=>setMode('or')} className={`flex-1 py-2 text-xs ${mode==='or'?'bg-blue-600 text-white':'bg-gray-50'}`}>或签</button>
                    <button onClick={()=>setMode('and')} className={`flex-1 py-2 text-xs ${mode==='and'?'bg-blue-600 text-white':'bg-gray-50'}`}>会签</button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">触发条件（可选，为空则无条件触发）</label>
                <div className="flex gap-2">
                  <select value={field} onChange={e => setField(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor:'#e5e5e5' }}>
                    <option value="">无条件</option>
                    {(FIELDS[module]||[]).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  {field && (
                    <>
                      <select value={op} onChange={e => setOp(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm outline-none w-20" style={{ borderColor:'#e5e5e5' }}>
                        {OPS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                      <input value={value} onChange={e => setValue(e.target.value)} placeholder="阈值"
                        className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor:'#e5e5e5' }} />
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">审批人</label>
                <div className="relative">
                  <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                    placeholder="搜索员工添加审批人"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor:'#e5e5e5' }} />
                  {userSearch && filteredUsers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 max-h-32 overflow-auto z-10 shadow-lg">
                      {filteredUsers.map(u => (
                        <div key={u.id} onMouseDown={() => addApprover(u)}
                          className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer">{u.name}</div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedApprovers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedApprovers.map(u => (
                      <span key={u.id} className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                        <Users size={10} /> {u.name}
                        <button onClick={() => setSelectedApprovers(selectedApprovers.filter(a => a.id !== u.id))}>
                          <X size={10} className="text-red-400" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor:'#f0f0f0' }}>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">取消</button>
              <button onClick={save} disabled={!name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                <Check size={14} className="inline mr-1" />{editing ? '更新' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
