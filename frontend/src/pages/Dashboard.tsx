import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, TrendingUp } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { markAnnouncementRead } from '../api/announcements'
import { getDashboard } from '../api/dashboard'
import { getDashboardStats } from '../api/reports'
import type { DashboardResponse, DashboardStats } from '../types'
import DashboardHero from '../components/dashboard/DashboardHero'
import AnnouncementPanel from '../components/dashboard/AnnouncementPanel'
import SchedulePanel from '../components/dashboard/SchedulePanel'
import OverviewCards from '../components/dashboard/OverviewCards'
import RecentActivity from '../components/dashboard/RecentActivity'

export default function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    setError('')
    Promise.all([
      getDashboard(),
      getDashboardStats().catch(() => null),
    ])
      .then(([dashData, statsData]) => {
        setDashboard(dashData)
        setStats(statsData as DashboardStats | null)
      })
      .catch((err: any) => {
        console.error('Dashboard fetch failed:', err)
        setError('工作台数据加载失败，请稍后刷新重试。')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleMarkRead = (annId: number) => {
    markAnnouncementRead(annId)
      .then(() => {
        setDashboard(prev => {
          if (!prev) return prev
          return {
            ...prev,
            announcement_summary: {
              ...prev.announcement_summary,
              unread_count: Math.max(0, prev.announcement_summary.unread_count - 1),
              items: prev.announcement_summary.items.map(item => (
                item.id === annId ? { ...item, is_read: true } : item
              )),
            },
          }
        })
      })
      .catch(console.error)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          工作台加载中...
        </div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm text-rose-600">
        {error || '工作台暂时不可用，请稍后重试。'}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <DashboardHero
        user={dashboard.user_summary}
        unreadCount={dashboard.announcement_summary.unread_count}
        scheduleDays={dashboard.schedule_summary.slots.filter(slot => !slot.shift_is_rest).length}
        recentCount={dashboard.recent_activity.length}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AnnouncementPanel
          unreadCount={dashboard.announcement_summary.unread_count}
          items={dashboard.announcement_summary.items}
          onOpenAll={() => navigate('/announcements')}
          onMarkRead={handleMarkRead}
        />

        <SchedulePanel
          slots={dashboard.schedule_summary.slots}
          todaySlot={dashboard.schedule_summary.today_slot}
          tomorrowSlot={dashboard.schedule_summary.tomorrow_slot}
          onOpenSchedule={() => navigate('/schedule')}
        />
      </div>

      <OverviewCards cards={dashboard.overview_cards} onOpen={(path) => path && navigate(path)} />

      <RecentActivity items={dashboard.recent_activity} onOpen={(path) => navigate(path)} />

      {/* 数据报表图表 */}
      {stats && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-gray-600">
            <TrendingUp size={18} />
            <span className="text-lg font-semibold text-gray-800">数据报表</span>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* 工单月度趋势 */}
            <div className="bg-white border rounded-xl p-5" style={{ borderColor: '#f0f0f0' }}>
              <h3 className="text-sm font-semibold text-gray-600 mb-4">工单月度趋势（近12个月）</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats.ticket_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f0f0f0' }} />
                  <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="工单数" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 工单状态分布 */}
            <div className="bg-white border rounded-xl p-5" style={{ borderColor: '#f0f0f0' }}>
              <h3 className="text-sm font-semibold text-gray-600 mb-4">工单状态分布</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={stats.ticket_status_distribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, count }) => `${name}: ${count}`}
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
              <ResponsiveContainer width="100%" height={260}>
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
              <h3 className="text-sm font-semibold text-gray-600 mb-4">今日概览</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-xl" style={{ background: '#eff6ff' }}>
                  <div className="text-3xl font-bold text-blue-600">{stats.today_attendance}</div>
                  <div className="text-xs text-gray-500 mt-1">今日已打卡</div>
                </div>
                <div className="text-center p-4 rounded-xl" style={{ background: '#f0fdf4' }}>
                  <div className="text-3xl font-bold text-green-600">{stats.total_tasks}</div>
                  <div className="text-xs text-gray-500 mt-1">任务总数</div>
                </div>
                <div className="text-center p-4 rounded-xl col-span-2" style={{ background: '#fefce8' }}>
                  <div className="text-3xl font-bold text-yellow-600">{stats.pending_tasks}</div>
                  <div className="text-xs text-gray-500 mt-1">待处理任务</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
