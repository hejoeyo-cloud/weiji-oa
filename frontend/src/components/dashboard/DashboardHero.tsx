import type { DashboardUserSummary } from '../../types'

function getGreeting(hour: number) {
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function formatNow() {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())
}

type Props = {
  user: DashboardUserSummary
  unreadCount: number
  scheduleDays: number
  recentCount: number
}

export default function DashboardHero({ user, unreadCount, scheduleDays, recentCount }: Props) {
  const greeting = getGreeting(new Date().getHours())

  return (
    <section className="rounded-[22px] border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-slate-100/70 px-4 py-3 shadow-sm lg:px-5 lg:py-3.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-sm">
            {formatNow()}
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">{greeting}</p>
            <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight text-slate-900 lg:text-[24px]">
              {user.name}，欢迎回到工作台
            </h1>
          </div>
          <p className="max-w-2xl text-xs leading-5 text-slate-600">
            首页已经为你汇总公告、排班和最近动态，可以直接从这里进入今天最需要关注的工作内容。
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 lg:max-w-[380px] lg:justify-end">
          <div className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[11px] text-slate-600 shadow-sm">
              未读公告 <span className="ml-1 font-semibold text-slate-900">{unreadCount}</span>
          </div>
          <div className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[11px] text-slate-600 shadow-sm">
              本月排班 <span className="ml-1 font-semibold text-slate-900">{scheduleDays}</span> 天
          </div>
          <div className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[11px] text-slate-600 shadow-sm">
              最近动态 <span className="ml-1 font-semibold text-slate-900">{recentCount}</span> 条
          </div>
        </div>
      </div>
    </section>
  )
}
