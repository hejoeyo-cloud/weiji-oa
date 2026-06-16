import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { markAnnouncementRead } from '../api/announcements'
import { getDashboard } from '../api/dashboard'
import type { DashboardResponse } from '../types'
import DashboardHero from '../components/dashboard/DashboardHero'
import AnnouncementPanel from '../components/dashboard/AnnouncementPanel'
import SchedulePanel from '../components/dashboard/SchedulePanel'
import OverviewCards from '../components/dashboard/OverviewCards'
import RecentActivity from '../components/dashboard/RecentActivity'
import UnreadMessagesPanel from '../components/dashboard/UnreadMessagesPanel'

export default function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    setError('')
    getDashboard()
      .then(data => {
        setDashboard(data)
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
        pendingDelivery={Number(dashboard.overview_cards.find(c => c.key === 'pending_delivery')?.value ?? 0)}
        scheduleDays={dashboard.schedule_summary.slots.filter(slot => !slot.shift_is_rest).length}
        recentCount={dashboard.recent_activity.length}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <AnnouncementPanel
            unreadCount={dashboard.announcement_summary.unread_count}
            items={dashboard.announcement_summary.items}
            onOpenAll={() => navigate('/announcements')}
            onMarkRead={handleMarkRead}
          />
          <UnreadMessagesPanel messages={dashboard.unread_messages || []} />
        </div>

        <div className="space-y-6">
          <OverviewCards cards={dashboard.overview_cards} onOpen={(path) => path && navigate(path)} />
          <SchedulePanel
            slots={dashboard.schedule_summary.slots}
            todaySlot={dashboard.schedule_summary.today_slot}
            tomorrowSlot={dashboard.schedule_summary.tomorrow_slot}
            onOpenSchedule={() => navigate('/schedule')}
          />
        </div>
      </div>

      <RecentActivity items={dashboard.recent_activity} onOpen={(path) => navigate(path)} />
    </div>
  )
}
