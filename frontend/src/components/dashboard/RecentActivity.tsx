import { ArrowRight, Bell, CheckSquare, ClipboardList, Ticket, RotateCcw, Wrench } from 'lucide-react'
import type { DashboardRecentActivityItem } from '../../types'

function formatTime(value?: string) {
  if (!value) return '刚刚'
  const date = new Date(value)
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getIcon(kind: string) {
  if (kind === 'announcement') return Bell
  if (kind === 'approval') return CheckSquare
  if (kind === 'return_exchange') return RotateCcw
  if (kind === 'repair') return Wrench
  return Ticket
}

export default function RecentActivity({
  items,
  onOpen,
}: {
  items: DashboardRecentActivityItem[]
  onOpen: (path: string) => void
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">最近动态</h2>
      </div>

      <div className="divide-y divide-slate-100">
        {items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">最近还没有与你相关的动态</div>
        ) : items.map(item => {
          const Icon = getIcon(item.kind)
          return (
            <button
              key={item.key}
              onClick={() => onOpen(item.path)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/70"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                <p className="mt-1 truncate text-sm text-slate-500">{item.description}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{formatTime(item.time)}</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
