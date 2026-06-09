import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, X, Edit2, Building2, Users, RefreshCw, Shield } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser } from '../api/users'
import { getDepartments, createDepartment, deleteDepartment } from '../api/departments'
import { getRoles, createRole, updateRole, deleteRole, getAllPermissions } from '../api/roles'
import type { User, Department, Role } from '../types'

const emptyUserForm = { email: '', username: '', password: '', name: '', note: '', role: 'customer', department_id: 0, is_manager: false }
const emptyDeptForm = { name: '', description: '', sort_order: 0 }
const emptyRoleForm = { name: '', label: '', color: '#1677FF', permissions: [] as string[] }

export default function UserManage() {
  const [users, setUsers] = useState<User[]>([])
  const [depts, setDepts] = useState<Department[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [allPerms, setAllPerms] = useState<string[]>([])
  const [permGroups, setPermGroups] = useState<{ key: string; label: string; perms: string[] }[]>([])
  const [tab, setTab] = useState<'users' | 'departments' | 'roles'>('users')
  const [showUserModal, setShowUserModal] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState(emptyUserForm)
  const [userError, setUserError] = useState('')
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [deptForm, setDeptForm] = useState(emptyDeptForm)
  const [deptError, setDeptError] = useState('')
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editRole, setEditRole] = useState<Role | null>(null)
  const [roleForm, setRoleForm] = useState(emptyRoleForm)
  const [roleError, setRoleError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    getUsers().then(r => setUsers(r.data)).catch(console.error)
    getDepartments().then(data => setDepts(data)).catch(console.error)
    getRoles().then(data => setRoles(data)).catch(console.error)
    getAllPermissions().then(data => {
      setAllPerms(data.permissions || [])
      setPermGroups(data.groups || [])
    }).catch(console.error)
  }, [])

  useEffect(() => { load() }, [load])

  // 权限分组 fallback（与后端 PERMISSION_GROUPS 保持一致）
  const FALLBACK_GROUPS = [
    { key: 'tickets', label: '工单管理', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'knowledge', label: '知识库', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'return_exchange', label: '退换登记', perms: ['view', 'create', 'edit', 'delete', 'process'] },
    { key: 'repair', label: '维修登记', perms: ['view', 'create', 'edit', 'delete', 'process'] },
    { key: 'gifts', label: '发货登记', perms: ['view', 'create', 'edit', 'delete', 'cost_view'] },
    { key: 'gift_cashback', label: '返现登记', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'gift_resend', label: '礼品补发', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'warehouse_products', label: '仓储-货品管理', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'warehouse_inbound', label: '仓储-入库管理', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'warehouse_outbound', label: '仓储-出库管理', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'warehouse_return_to_factory', label: '仓储-返厂出库', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'announcements', label: '公告通知', perms: ['view', 'create', 'edit'] },
    { key: 'approvals', label: '审批管理', perms: ['view', 'create', 'process'] },
    { key: 'approval_rules', label: '审批规则', perms: ['view'] },
    { key: 'schedule', label: '排班管理', perms: ['view', 'create', 'edit'] },
    { key: 'attendance', label: '考勤打卡', perms: ['view', 'manage'] },
    { key: 'tasks', label: '任务看板', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'messages', label: '内部邮件', perms: ['view', 'send'] },
    { key: 'users', label: '人员管理', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'departments', label: '部门管理', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'audit_logs', label: '操作日志', perms: ['view'] },
    { key: 'finance_invoice_request', label: '财务-开票申请', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'finance_sales_invoice', label: '财务-销项台账', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'finance_purchase_invoice', label: '财务-进项台账', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'finance_expense_invoice', label: '财务-报销发票', perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'field_options', label: '预设选项', perms: ['manage'] },
  ]

  const ROLE_CONFIG: Record<string, { label: string; color: string }> = {}
  for (const r of roles) {
    ROLE_CONFIG[r.name] = { label: r.label, color: '' }
  }
  // Fallback
  ROLE_CONFIG['admin'] = ROLE_CONFIG['admin'] || { label: '管理员', color: '' }
  ROLE_CONFIG['technician'] = ROLE_CONFIG['technician'] || { label: '技术员', color: '' }
  ROLE_CONFIG['customer'] = ROLE_CONFIG['customer'] || { label: '客服', color: '' }

  // ── 用户操作 ──────────────────────────────────────────
  const openCreateUser = () => {
    setEditUser(null)
    setUserForm(emptyUserForm)
    setUserError('')
    setShowUserModal(true)
  }

  const openEditUser = (u: User) => {
    setEditUser(u)
    setUserForm({ email: u.email || '', username: u.username, password: '', name: u.name, note: u.note || '', role: u.role, department_id: u.department_id || 0, is_manager: u.is_manager || false })
    setUserError('')
    setShowUserModal(true)
  }

  const handleSaveUser = async () => {
    if (!userForm.name) { setUserError('姓名不能为空'); return }
    if (!editUser && !userForm.password) { setUserError('密码不能为空'); return }
    setSaving(true)
    setUserError('')
    const payload = { ...userForm, department_id: userForm.department_id || undefined, is_manager: userForm.is_manager }
    try {
      if (editUser) {
        const updatePayload: any = { name: userForm.name, note: userForm.note, role: userForm.role, department_id: userForm.department_id || undefined, is_manager: userForm.is_manager }
        if (userForm.password) updatePayload.password = userForm.password
        await updateUser(editUser.id, updatePayload)
      } else {
        await createUser(payload)
      }
      setShowUserModal(false)
      load()
    } catch (err: any) {
      setUserError(err.response?.data?.detail || '操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async (id: number) => {
    if (!confirm('确定要删除此用户吗？')) return
    deleteUser(id).then(load).catch((e: any) => alert(e.response?.data?.detail || '删除失败'))
  }

  // ── 部门操作 ──────────────────────────────────────────
  const openCreateDept = () => { setDeptForm(emptyDeptForm); setDeptError(''); setShowDeptModal(true) }

  const handleSaveDept = async () => {
    if (!deptForm.name) { setDeptError('部门名称不能为空'); return }
    setSaving(true)
    setDeptError('')
    createDepartment(deptForm)
      .then(() => { setShowDeptModal(false); load() })
      .catch((e: any) => setDeptError(e.response?.data?.detail || '创建失败'))
      .finally(() => setSaving(false))
  }

  const handleDeleteDept = (id: number) => {
    if (!confirm('确定要删除此部门？成员的部门归属将被清空。')) return
    deleteDepartment(id).then(load).catch(console.error)
  }

  // ── 角色操作 ──────────────────────────────────────────
  const openCreateRole = () => {
    setEditRole(null)
    setRoleForm(emptyRoleForm)
    setRoleError('')
    setShowRoleModal(true)
  }

  const openEditRole = (r: Role) => {
    setEditRole(r)
    setRoleForm({ name: r.name, label: r.label, color: r.color, permissions: [...(r.permissions || [])] })
    setRoleError('')
    setShowRoleModal(true)
  }

  const toggleRolePerm = (permKey: string) => {
    setRoleForm(f => ({
      ...f,
      permissions: f.permissions.includes(permKey)
        ? f.permissions.filter(p => p !== permKey)
        : [...f.permissions, permKey],
    }))
  }

  const handleSaveRole = async () => {
    if (!roleForm.name || !roleForm.label) { setRoleError('角色标识和名称不能为空'); return }
    setSaving(true)
    setRoleError('')
    try {
      if (editRole) {
        await updateRole(editRole.id, { label: roleForm.label, color: roleForm.color, permissions: roleForm.permissions })
      } else {
        await createRole({ name: roleForm.name, label: roleForm.label, color: roleForm.color, permissions: roleForm.permissions })
      }
      setShowRoleModal(false)
      load()
    } catch (err: any) {
      setRoleError(err.response?.data?.detail || '操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = async (r: Role) => {
    if (!confirm(`确定要删除角色"${r.label}"吗？`)) return
    try {
      await deleteRole(r.id)
      load()
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败')
    }
  }

  const getPermLabel = (permKey: string) => {
    const parts = permKey.split(':')
    const actionLabels: Record<string, string> = {
      view: '查看', create: '创建', edit: '编辑', delete: '删除', process: '处理',
      cost_view: '成本查看', manage: '管理',
    }
    return actionLabels[parts[1]] || parts[1]
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">人员管理</h2>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><RefreshCw size={15} /></button>
          {tab === 'users' && (
            <button onClick={openCreateUser}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus size={16} /> 新建用户
            </button>
          )}
          {tab === 'departments' && (
            <button onClick={openCreateDept}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus size={16} /> 新建部门
            </button>
          )}
          {tab === 'roles' && (
            <button onClick={openCreateRole}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus size={16} /> 新建角色
            </button>
          )}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('users')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'users' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Users size={15} /> 员工列表
        </button>
        <button onClick={() => setTab('departments')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'departments' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Building2 size={15} /> 部门管理
        </button>
        <button onClick={() => setTab('roles')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'roles' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Shield size={15} /> 角色管理
        </button>
      </div>

      {/* 员工列表 */}
      {tab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {['邮箱', '账号', '姓名', '角色', '所属部门', '备注', '创建时间', '操作'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-sm">{u.email || '-'}</td>
                  <td className="px-4 py-3 font-mono text-gray-700 font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-gray-800">{u.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${u.role_color || '#1677FF'}15`, color: u.role_color || '#1677FF' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: u.role_color || '#1677FF' }} />
                      {u.role_label || (ROLE_CONFIG[u.role] || ROLE_CONFIG.customer).label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.department_name || '-'}</td>
                  <td className="px-4 py-3">
                    {u.is_manager ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">是</span> : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 max-w-32 truncate">{u.note || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEditUser(u)} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors"><Edit2 size={14} /></button>
                      {u.username !== 'admin' && (
                        <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 部门列表 */}
      {tab === 'departments' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {depts.length === 0 ? (
            <div className="col-span-3 bg-white rounded-xl p-10 text-center text-gray-400">
              <Building2 size={32} className="mx-auto mb-2 opacity-30" />
              <p>暂无部门，点击右上角添加</p>
            </div>
          ) : depts.map(d => (
            <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{d.name}</h3>
                  {d.description && <p className="text-sm text-gray-500 mt-0.5">{d.description}</p>}
                  <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
                    <Users size={12} /><span>{d.member_count} 人</span>
                  </div>
                </div>
                <button onClick={() => handleDeleteDept(d.id)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 角色列表 */}
      {tab === 'roles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.length === 0 ? (
            <div className="col-span-3 bg-white rounded-xl p-10 text-center text-gray-400">
              <Shield size={32} className="mx-auto mb-2 opacity-30" />
              <p>暂无角色，点击右上角添加</p>
            </div>
          ) : roles.map(r => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: r.color || '#1677FF' }}>
                    {r.label[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{r.label}</h3>
                    <p className="text-xs text-gray-400 font-mono">{r.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditRole(r)} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors"><Edit2 size={14} /></button>
                  {!r.is_builtin && (
                    <button onClick={() => handleDeleteRole(r)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {(r.permissions || []).map(p => (
                  <span key={p} className="inline-flex px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">
                    {getPermLabel(p)}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{r.permissions?.length || 0} 项权限</span>
                <span>{r.user_count} 个用户</span>
              </div>
              {r.is_builtin && (
                <div className="mt-2 px-2 py-1 bg-gray-50 rounded-md">
                  <span className="text-[10px] text-gray-400">内置角色</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 用户弹窗 */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">{editUser ? '编辑用户' : '新建用户'}</h3>
              <button onClick={() => setShowUserModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {userError && <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">{userError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">邮箱</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">{editUser ? '新密码（留空不修改）' : '密码'}</label>
                  <input type="password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">姓名</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">角色</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
                    {roles.map(r => (
                      <option key={r.id} value={r.name}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">所属部门</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    value={userForm.department_id} onChange={e => setUserForm(f => ({ ...f, department_id: Number(e.target.value) }))}>
                    <option value={0}>无部门</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">备注</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    value={userForm.note} onChange={e => setUserForm(f => ({ ...f, note: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isManagerCheck"
                  checked={userForm.is_manager}
                  onChange={e => setUserForm(f => ({ ...f, is_manager: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                <label htmlFor="isManagerCheck" className="text-sm text-gray-600 cursor-pointer select-none">部门管理人员（可作为审批人）</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowUserModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleSaveUser} disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 部门弹窗 */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">新建部门</h3>
              <button onClick={() => setShowDeptModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {deptError && <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">{deptError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">部门名称</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-100"
                  value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">部门描述</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-100"
                  value={deptForm.description} onChange={e => setDeptForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowDeptModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleSaveDept} disabled={saving}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
                {saving ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 角色弹窗 */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-800">{editRole ? '编辑角色' : '新建角色'}</h3>
              <button onClick={() => setShowRoleModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {roleError && <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">{roleError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">角色标识</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-100 font-mono"
                    disabled={!!editRole} value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value.replace(/\s/g, '') }))}
                    placeholder="如 warehouse_manager" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">显示名称</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-100"
                    value={roleForm.label} onChange={e => setRoleForm(f => ({ ...f, label: e.target.value }))} placeholder="如 仓库管理员" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">显示颜色</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={roleForm.color} onChange={e => setRoleForm(f => ({ ...f, color: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                  <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-100 font-mono"
                    value={roleForm.color} onChange={e => setRoleForm(f => ({ ...f, color: e.target.value }))} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">权限配置</label>
                  <span className="text-[10px] text-gray-400">{roleForm.permissions.length} 项已选</span>
                </div>
                <div className="space-y-3 border border-gray-100 rounded-xl p-3 max-h-60 overflow-y-auto">
                  {(permGroups.length > 0 ? permGroups : FALLBACK_GROUPS).map(group => (
                    <div key={group.key}>
                      <div className="text-xs font-semibold text-gray-500 mb-1.5">{group.label}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.perms.map(perm => {
                          const permKey = `${group.key}:${perm}`
                          const checked = roleForm.permissions.includes(permKey)
                          return (
                            <button key={permKey}
                              onClick={() => toggleRolePerm(permKey)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                checked ? 'bg-purple-100 text-purple-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                              }`}
                            >
                              <span className={`w-3 h-3 rounded border flex items-center justify-center ${
                                checked ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                              }`}>
                                {checked && <span className="text-white text-[8px]">&#10003;</span>}
                              </span>
                              {getPermLabel(permKey)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowRoleModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleSaveRole} disabled={saving}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
