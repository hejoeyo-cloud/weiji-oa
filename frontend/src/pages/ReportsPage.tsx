import { useEffect, useState } from 'react'
import { TrendingUp, RefreshCw } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getDashboardStats } from '../api/reports'
import type { DashboardStats } from '../types'

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getDashboardStats()
      if (data) setStats(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading && !stats) {
    return (
      <div className="p-6 text-sm text-gray-400">加载中...</div>
    )
  }

  if (!stats) {
    return (
      <div className="p-6 text-sm text-red-500">报表数据加载失败</div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-800">
          <TrendingUp size={20} />
          <h2 className="text-xl font-semibold">数据报表</h2>
        </div>
        <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><RefreshCw size={15} /></button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* 工单月度趋势 */}
        <div className="bg-white border rounded-xl p-5" style={{ borderColor: '#f0f0f0' }}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">工单月度趋势（近12个月）</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={stats.ticket_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f0f0f0' }} />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="工单数" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 工单状态分布 */}
        <div className="bg-white border rounded-xl p-5" style={{ borderColor: '#f0f0f0' }}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">工单状态分布</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={stats.ticket_status_distribution}
                dataKey="count" nameKey="name"
                cx="50%" cy="50%" outerRadius={100}
                label={({ name, count }: any) => `${name}: ${count}`}
                labelLine={false}
              >
                {stats.ticket_status_distribution.map((_, i) => (
                  <Cell key={i} fill={['#f59e0b', '#2563eb', '#16a34a'][i % 3]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 业务模块分布 */}
        <div className="bg-white border rounded-xl p-5" style={{ borderColor: '#f0f0f0' }}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">业务模块分布</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.module_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f0f0f0' }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="记录数" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 今日概览 */}
        <div className="bg-white border rounded-xl p-5" style={{ borderColor: '#f0f0f0' }}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">今日数据概览</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-5 rounded-xl" style={{ background: '#eff6ff' }}>
              <div className="text-3xl font-bold text-blue-600">{stats.today_attendance}</div>
              <div className="text-xs text-gray-500 mt-1">今日已打卡</div>
            </div>
            <div className="text-center p-5 rounded-xl" style={{ background: '#f0fdf4' }}>
              <div className="text-3xl font-bold text-green-600">{stats.total_tasks}</div>
              <div className="text-xs text-gray-500 mt-1">任务总数</div>
            </div>
            <div className="text-center p-5 rounded-xl" style={{ background: '#fefce8' }}>
              <div className="text-3xl font-bold text-yellow-600">{stats.pending_tasks}</div>
              <div className="text-xs text-gray-500 mt-1">待处理任务</div>
            </div>
            <div className="text-center p-5 rounded-xl" style={{ background: '#f5f3ff' }}>
              <div className="text-3xl font-bold text-purple-600">{stats.module_distribution.length}</div>
              <div className="text-xs text-gray-500 mt-1">活跃模块数</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
