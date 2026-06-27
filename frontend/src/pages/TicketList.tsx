import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, FilePlus, Eye, Edit2, Trash2, ChevronRight } from 'lucide-react'
import Pagination from '../components/Pagination'
import { getTickets, deleteTicket } from '../api/tickets'
import { useAuth } from '../hooks/useAuth'
import type { Ticket } from '../types'

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'need_return', label: '需寄回' },
  { value: 'completed', label: '已完成' },
]

const priorityOptions = [
  { value: '', label: '全部优先级' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

const statusStyle: Record<string, string> = {
  pending: 'bg-orange-50 text-orange-600',
  processing: 'bg-blue-50 text-blue-600',
  need_return: 'bg-red-50 text-red-600',
  completed: 'bg-green-50 text-green-600',
}

const statusLabel: Record<string, string> = {
  pending: '待处理', processing: '处理中', need_return: '需寄回', completed: '已完成',
}

const priorityStyle: Record<string, string> = {
  high: 'bg-red-50 text-red-600', medium: 'bg-yellow-50 text-yellow-700', low: 'bg-gray-50 text-gray-600',
}

const priorityLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }

export default function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [search, setSearch] = useState('')
  const pageSize = 15
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const fetchTickets = () => {
    getTickets({ page, page_size: pageSize, status, priority, search }).then((res) => {
      setTickets(res.data.items)
      setTotal(res.data.total)
    }).catch(() => {})
  }

  useEffect(() => { fetchTickets() }, [page, status, priority])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchTickets()
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('确定要删除此工单吗？删除后不可恢复。')) return
    try {
      await deleteTicket(id)
      fetchTickets()
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">工单池</h1>
        <button onClick={() => navigate('/tickets/create')} className="btn-primary flex items-center gap-2">
          <FilePlus className="w-4 h-4" /> 创建工单
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索客户ID或问题描述..."
              className="flex-1 border-0 outline-none text-sm bg-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="input-field w-28">
              {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1) }} className="input-field w-28">
              {priorityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </form>
      </div>

      {/* Ticket list */}
      <div className="space-y-3">
        {tickets.length === 0 && (
          <div className="card p-8 text-center text-gray-400 text-sm">暂无工单</div>
        )}
        {tickets.map((t) => (
          <div
            key={t.id}
            className="card p-4 hover:shadow-md cursor-pointer transition-all duration-200"
            onClick={() => navigate(`/tickets/${t.id}`)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-gray-400 font-mono">#{t.id}</span>
                  <span className={`badge ${priorityStyle[t.priority]}`}>{priorityLabel[t.priority] || t.priority}</span>
                  <span className={`badge ${statusStyle[t.status]}`}>{statusLabel[t.status] || t.status}</span>
                  {t.platform && <span className="badge bg-gray-50 text-gray-500">{t.platform}</span>}
                </div>
                <p className="text-sm text-gray-800 truncate mb-1">
                  {t.customer_id ? `客户：${t.customer_id}` : ''}
                  {t.description ? ` - ${t.description.slice(0, 60)}` : ''}
                </p>
                <p className="text-xs text-gray-400">
                  {t.creator_name} · {t.created_at ? new Date(t.created_at).toLocaleString('zh-CN') : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/tickets/${t.id}`) }}
                  className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors"
                  title="查看详情"
                >
                  <Eye size={14} />
                </button>
                {hasPermission('tickets:edit') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/tickets/${t.id}`) }}
                    className="p-1.5 hover:bg-amber-50 text-amber-500 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
                {hasPermission('tickets:delete') && (
                  <button
                    onClick={(e) => handleDelete(e, t.id)}
                    className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 ml-1" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </div>
  )
}
