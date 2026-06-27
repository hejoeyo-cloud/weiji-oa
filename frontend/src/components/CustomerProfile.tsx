import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Wrench, RotateCcw, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { getCustomerProfile, type CustomerProfile as ProfileData } from '../api/customer'

const statusLabel: Record<string, string> = {
  pending: '待处理', processing: '处理中', need_return: '需寄回', completed: '已完成',
}
const repairStatusLabel: Record<string, string> = {
  pending_repair: '待维修', processing_repair: '维修中', completed_repair: '已修好',
}
const returnStatusLabel: Record<string, string> = {
  pending: '待处理', processing: '处理中', completed: '已完成',
}

export default function CustomerProfile({ customerId }: { customerId: string }) {
  const navigate = useNavigate()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<'tickets' | 'repairs' | 'returns'>('tickets')

  useEffect(() => {
    if (!customerId) return
    setLoading(true)
    getCustomerProfile(customerId)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customerId])

  if (loading) return <div className="card p-4 text-sm text-gray-400">加载客户信息...</div>
  if (!data) return null

  const totalRecords = data.ticket_count + data.repair_count + data.return_count + data.exchange_count

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center">
            <User className="w-4.5 h-4.5 text-primary-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-800">客户画像</p>
            <p className="text-xs text-gray-400">共 {totalRecords} 条交互记录</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-gray-500"><Wrench className="w-3 h-3" />工单 {data.ticket_count}</span>
            <span className="flex items-center gap-1 text-gray-500"><Wrench className="w-3 h-3" />维修 {data.repair_count}</span>
            <span className="flex items-center gap-1 text-gray-500"><RotateCcw className="w-3 h-3" />退换 {data.return_count + data.exchange_count}</span>
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Stats */}
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {[
              { label: '工单', count: data.ticket_count, color: 'text-primary-600' },
              { label: '维修', count: data.repair_count, color: 'text-amber-600' },
              { label: '退换货', count: data.return_count + data.exchange_count, color: 'text-purple-600' },
            ].map(s => (
              <div key={s.label} className="py-3 text-center">
                <p className={`text-lg font-semibold ${s.color}`}>{s.count}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 bg-gray-50 py-1.5">
            {([
              { key: 'tickets' as const, label: '近期工单' },
              { key: 'repairs' as const, label: '近期维修' },
              { key: 'returns' as const, label: '近期退换' },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${tab === t.key ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Lists */}
          <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
            {tab === 'tickets' && data.recent_tickets.length === 0 && <p className="text-xs text-gray-400">暂无工单记录</p>}
            {tab === 'repairs' && data.recent_repairs.length === 0 && <p className="text-xs text-gray-400">暂无维修记录</p>}
            {tab === 'returns' && data.recent_returns.length === 0 && <p className="text-xs text-gray-400">暂无退换记录</p>}

            {tab === 'tickets' && data.recent_tickets.map(t => (
              <div key={t.id} className="flex items-center justify-between py-1.5 group">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400 font-mono">#{t.id}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{statusLabel[t.status] || t.status}</span>
                  <span className="text-sm text-gray-600 truncate">{t.description}</span>
                </div>
                <button onClick={() => navigate(`/tickets/${t.id}`)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity">
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            ))}

            {tab === 'repairs' && data.recent_repairs.map(r => (
              <div key={r.id} className="flex items-center justify-between py-1.5 group">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400 font-mono">#{r.id}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">{repairStatusLabel[r.repair_status] || r.repair_status}</span>
                  <span className="text-sm text-gray-600 truncate">{r.model}</span>
                  <span className="text-xs text-gray-400">{r.apply_date}</span>
                </div>
                <button onClick={() => navigate(`/repair?highlight=${r.id}`)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity">
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            ))}

            {tab === 'returns' && data.recent_returns.map(r => (
              <div key={r.id} className="flex items-center justify-between py-1.5 group">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400 font-mono">#{r.id}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${r.record_type === 'return' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
                    {r.record_type === 'return' ? '退货' : '换货'}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{returnStatusLabel[r.progress] || r.progress}</span>
                  <span className="text-sm text-gray-600 truncate">{r.model}</span>
                  <span className="text-xs text-gray-400">{r.apply_date}</span>
                </div>
                <button onClick={() => navigate(`/return-exchange?highlight=${r.id}`)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity">
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
