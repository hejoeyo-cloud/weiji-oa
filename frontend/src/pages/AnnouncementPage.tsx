import { useState, useEffect, useCallback } from 'react'
import { Plus, Pin, Edit2, Trash2, X, Megaphone, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, markAnnouncementRead } from '../api/announcements'
import { getDepartments } from '../api/departments'
import { Announcement, Department } from '../types'
import { useAuth } from '../hooks/useAuth'

function formatDate(s?: string) {
  if (!s) return ''
  return new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const emptyForm = { title: '', content: '', is_pinned: false, target_departments: [] as number[], is_all: true }

export default function AnnouncementPage() {
  const { user } = useAuth()
  const { hasPermission } = useAuth()
  const isAdmin = hasPermission('announcements:create', 'announcements:edit')
  const [items, setItems] = useState<Announcement[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [activeOnly, setActiveOnly] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Announcement | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [viewingAnn, setViewingAnn] = useState<Announcement | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const pageSize = 20

  // 加载部门列表
  useEffect(() => {
    if (isAdmin) {
      getDepartments().then(setDepartments).catch(console.error)
    }
  }, [isAdmin])

  const load = useCallback(() => {
    setLoading(true)
    getAnnouncements({ page, page_size: pageSize, active_only: activeOnly })
      .then(data => { setItems(data.items); setTotal(data.total) })
      .catch(console.error).finally(() => setLoading(false))
  }, [page, activeOnly])

  useEffect(() => { load() }, [load])

  // 标记公告已读
  const handleMarkRead = (a: Announcement) => {
    if (!a.is_read) {
      markAnnouncementRead(a.id).catch(console.error)
      setItems(prev => prev.map(item => item.id === a.id ? { ...item, is_read: true } : item))
    }
  }

  const openCreate = () => {
    setEditItem(null)
    setForm({ title: '', content: '', is_pinned: false, target_departments: [], is_all: true })
    setShowModal(true)
  }
  const openEdit = (a: Announcement) => {
    setEditItem(a)
    const isAll = !a.target_departments || a.target_departments.length === 0
    setForm({
      title: a.title,
      content: a.content,
      is_pinned: a.is_pinned,
      target_departments: a.target_departments || [],
      is_all: isAll,
    })
    setShowModal(true)
  }

  const handleSave = () => {
    setSaving(true)
    const payload = {
      title: form.title,
      content: form.content,
      is_pinned: form.is_pinned,
      target_departments: form.is_all ? [] : form.target_departments,
    }
    const promise = editItem ? updateAnnouncement(editItem.id, payload) : createAnnouncement(payload)
    promise.then(() => { setShowModal(false); load() }).catch(console.error).finally(() => setSaving(false))
  }

  const toggleDept = (deptId: number) => {
    setForm(f => {
      const exists = f.target_departments.includes(deptId)
      const newDepts = exists
        ? f.target_departments.filter(id => id !== deptId)
        : [...f.target_departments, deptId]
      return { ...f, target_departments: newDepts, is_all: newDepts.length === 0 }
    })
  }

  const handleDelete = (id: number) => {
    if (!confirm('确认删除这条公告？')) return
    deleteAnnouncement(id).then(load).catch(console.error)
  }

  const toggleActive = (a: Announcement) => {
    updateAnnouncement(a.id, { is_active: !a.is_active }).then(load).catch(console.error)
  }

  // 点击公告标题展开/收起时标记已读
  const toggleExpand = (a: Announcement) => {
    if (expanded !== a.id) {
      handleMarkRead(a)
    }
    setExpanded(expanded === a.id ? null : a.id)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <Megaphone size={20} className="text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">公告通知</h2>
            <p className="text-sm text-gray-500">公司内部公告，共 {total} 条</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={!activeOnly} onChange={e => { setActiveOnly(!e.target.checked); setPage(1) }} className="rounded" />
              显示已停用
            </label>
          )}
          {isAdmin && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus size={16} /> 发布公告
            </button>
          )}
        </div>
      </div>

      {/* 公告列表 */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl p-10 text-center text-gray-400">加载中...</div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center text-gray-400">
            <Megaphone size={32} className="mx-auto mb-2 opacity-30" />
            <p>暂无公告</p>
          </div>
        ) : items.map(a => (
          <div key={a.id} className={`bg-white rounded-xl shadow-sm border transition-all ${a.is_pinned ? 'border-orange-200 shadow-orange-50' : 'border-gray-100'} ${!a.is_active ? 'opacity-60' : ''}`}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {a.is_pinned && <Pin size={14} className="text-orange-500 mt-1 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!a.is_read && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                      <h3 className="font-semibold text-gray-800 text-base cursor-pointer hover:text-blue-600 transition-colors" onClick={() => { handleMarkRead(a); setViewingAnn(a) }}>{a.title}</h3>
                      {a.is_pinned && <span className="inline-flex px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full font-medium">置顶</span>}
                      {!a.is_active && <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">已停用</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{a.author_name}</span>
                      <span>{formatDate(a.created_at)}</span>
                      {a.target_department_names && (
                        <span className="flex items-center gap-0.5 text-blue-500">
                          <Building2 size={11} />
                          {a.target_department_names}
                        </span>
                      )}
                      {!a.target_department_names && (
                        <span className="flex items-center gap-0.5 text-green-600">
                          🌐 全员
                        </span>
                      )}
                    </div>
                    {/* 内容预览/展开 */}
                    {a.content && (
                      <div className="mt-3">
                        <p className={`text-sm text-gray-600 leading-relaxed whitespace-pre-wrap ${expanded === a.id ? '' : 'line-clamp-3'}`}>
                          {a.content}
                        </p>
                        {a.content.length > 150 && (
                          <button onClick={() => toggleExpand(a)}
                            className="text-xs text-blue-500 hover:text-blue-600 mt-1 font-medium">
                            {expanded === a.id ? '收起' : '展开全文'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleActive(a)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${a.is_active ? 'bg-gray-100 hover:bg-gray-200 text-gray-600' : 'bg-green-50 hover:bg-green-100 text-green-600'}`}>
                      {a.is_active ? '停用' : '启用'}
                    </button>
                    <button onClick={() => openEdit(a)} className="p-1.5 hover:bg-orange-50 text-orange-500 rounded-lg transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(a.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="p-2 rounded-lg disabled:opacity-40 hover:bg-gray-100"><ChevronLeft size={16} /></button>
          <span className="text-sm text-gray-500">第 {page} / {totalPages} 页</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="p-2 rounded-lg disabled:opacity-40 hover:bg-gray-100"><ChevronRight size={16} /></button>
        </div>
      )}

      {/* 弹窗：发布/编辑 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">{editItem ? '编辑公告' : '发布公告'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">标题</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-100"
                  placeholder="公告标题" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">内容</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-100 resize-none"
                  rows={5} placeholder="公告内容..." value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
              </div>
              {/* 目标部门选择 */}
              {isAdmin && departments.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">发送范围</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.is_all} onChange={e => setForm(f => ({ ...f, is_all: e.target.checked, target_departments: e.target.checked ? [] : f.target_departments }))} className="rounded" />
                      <span className="text-sm text-gray-700">🌐 发送全员</span>
                    </label>
                    {!form.is_all && (
                      <div className="pl-6 space-y-1.5">
                        {departments.map(d => (
                          <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox"
                              checked={form.target_departments.includes(d.id)}
                              onChange={() => toggleDept(d.id)}
                              className="rounded" />
                            <span className="text-sm text-gray-600">{d.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-700 flex items-center gap-1"><Pin size={13} className="text-orange-500" />置顶公告</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleSave} disabled={saving || !form.title}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg disabled:opacity-60">
                {saving ? '发布中...' : '发布'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 弹窗：查看公告详情 */}
      {viewingAnn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setViewingAnn(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Megaphone size={18} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-800">公告详情</h3>
                  <p className="text-xs text-gray-400">{viewingAnn.author_name} · {formatDate(viewingAnn.created_at)}</p>
                </div>
              </div>
              <button onClick={() => setViewingAnn(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 min-w-0">
              <h4 className="text-lg font-bold text-gray-800 mb-3 break-words">{viewingAnn.title}</h4>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words max-h-72 overflow-y-auto">{viewingAnn.content}</p>
            </div>
            <div className="flex items-center justify-end p-5 border-t border-gray-100">
              <button onClick={() => setViewingAnn(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
