import { useEffect, useState } from 'react'
import { Plus, Trash2, GripVertical, AlertCircle, Clock, CheckCircle2, RefreshCw, User as UserIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { getTasks, createTask, updateTask, deleteTask } from '../api/tasks'
import { getUsers } from '../api/users'
import type { TaskItem, User } from '../types'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  todo: { label: '待处理', color: '#6b7280', bg: '#f9fafb', icon: AlertCircle },
  in_progress: { label: '进行中', color: '#2563eb', bg: '#eff6ff', icon: Clock },
  done: { label: '已完成', color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle2 },
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-50 text-blue-600',
  high: 'bg-orange-50 text-orange-600',
  urgent: 'bg-red-50 text-red-600',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: '低', normal: '中', high: '高', urgent: '紧急',
}

const PAGE_SIZE = 15

export default function TaskBoard() {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formPriority, setFormPriority] = useState('normal')
  const [formAssignee, setFormAssignee] = useState<number | undefined>(undefined)
  const [formDueDate, setFormDueDate] = useState('')
  const [msg, setMsg] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const loadTasks = async (p?: number) => {
    setLoading(true)
    try {
      const data = await getTasks({ page: p || page, page_size: PAGE_SIZE })
      setTasks(data.items)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const res = await getUsers()
      const list = Array.isArray(res) ? res : (res as any).data || []
      setUsers(list)
    } catch { setUsers([]) }
  }

  useEffect(() => { loadTasks(); loadUsers() }, [])

  // page 变化时重新加载
  useEffect(() => { loadTasks(page) }, [page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleCreate = async () => {
    if (!formTitle.trim()) return
    setMsg('')
    try {
      await createTask({
        title: formTitle,
        description: formDesc,
        priority: formPriority,
        assignee_id: formAssignee,
        due_date: formDueDate,
      })
      setFormTitle(''); setFormDesc(''); setFormPriority('normal')
      setFormAssignee(undefined); setFormDueDate(''); setShowForm(false)
      setPage(1)
      loadTasks(1)
    } catch (err: any) {
      setMsg(err.response?.data?.detail || '创建失败')
    }
  }

  const handleMove = async (task: TaskItem, newStatus: string) => {
    try {
      await updateTask(task.id, { status: newStatus })
      loadTasks()
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此任务？')) return
    try {
      await deleteTask(id)
      loadTasks()
    } catch { /* ignore */ }
  }

  const columns = ['todo', 'in_progress', 'done'] as const

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">任务看板</h2>
        <div className="flex items-center gap-3">
          <button onClick={() => loadTasks()} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><RefreshCw size={15} /></button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2"
            style={{ background: '#404040' }}
          >
            <Plus size={16} /> 新建任务
          </button>
        </div>
      </div>

      {/* 创建表单 */}
      {showForm && (
        <div className="bg-white border rounded-xl p-5 space-y-4" style={{ borderColor: '#f0f0f0' }}>
          <input
            type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
            placeholder="任务标题" className="w-full px-4 py-2.5 border rounded-lg text-sm" style={{ borderColor: '#e5e5e5' }}
          />
          <textarea
            value={formDesc} onChange={e => setFormDesc(e.target.value)}
            placeholder="任务描述（可选）" rows={2} className="w-full px-4 py-2.5 border rounded-lg text-sm" style={{ borderColor: '#e5e5e5' }}
          />
          <div className="flex gap-4">
            <select value={formPriority} onChange={e => setFormPriority(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#e5e5e5' }}>
              <option value="low">低优先级</option>
              <option value="normal">中优先级</option>
              <option value="high">高优先级</option>
              <option value="urgent">紧急</option>
            </select>
            <select value={formAssignee || ''} onChange={e => setFormAssignee(e.target.value ? Number(e.target.value) : undefined)} className="px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#e5e5e5' }}>
              <option value="">未分配</option>
              {users?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#e5e5e5' }} />
          </div>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <div className="flex gap-3">
            <button onClick={handleCreate} className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm">创建</button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 border rounded-lg text-sm text-gray-500">取消</button>
          </div>
        </div>
      )}

      {/* 看板三列 */}
      <div className="grid grid-cols-3 gap-4">
        {columns.map(status => {
          const config = STATUS_CONFIG[status]
          const columnTasks = tasks.filter(t => t.status === status)
          return (
            <div key={status} className="rounded-xl p-4" style={{ background: config.bg }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <config.icon size={16} style={{ color: config.color }} />
                  <span className="text-sm font-semibold" style={{ color: config.color }}>{config.label}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white text-gray-500">{columnTasks.length}</span>
              </div>
              <div className="space-y-3">
                {columnTasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg border p-3 cursor-pointer text-sm group hover:shadow-md transition-shadow"
                    style={{ borderColor: '#f0f0f0' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <GripVertical size={12} className="text-gray-300 flex-shrink-0" />
                          <span className="font-medium text-gray-800 truncate">{task.title}</span>
                        </div>
                        {task.description && (
                          <p className="text-xs text-gray-400 truncate mb-2">{task.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority] || ''}`}>
                            {PRIORITY_LABELS[task.priority] || task.priority}
                          </span>
                          {task.assignee_name && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <UserIcon size={10} /> {task.assignee_name}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-xs text-gray-400">{task.due_date}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                    {/* 状态切换按钮 */}
                    <div className="flex gap-1 mt-3 pt-2 border-t" style={{ borderColor: '#f5f5f5' }}>
                      {columns.filter(s => s !== status).map(s => {
                        const c = STATUS_CONFIG[s]
                        return (
                          <button
                            key={s}
                            onClick={() => handleMove(task, s)}
                            className="text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                            style={{ color: c.color }}
                          >
                            → {c.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {columnTasks.length === 0 && (
                  <div className="text-center py-8 text-xs text-gray-400">暂无任务</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 翻页控件 */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            style={{ borderColor: '#e5e5e5' }}
          >
            <ChevronLeft size={14} /> 上一页
          </button>
          <span className="text-sm text-gray-500">
            第 {page} / {totalPages} 页 · 共 {total} 条
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            style={{ borderColor: '#e5e5e5' }}
          >
            下一页 <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
