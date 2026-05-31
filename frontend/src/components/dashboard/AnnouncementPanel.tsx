import { ArrowRight, Check, Megaphone, Pin } from 'lucide-react'
import type { DashboardAnnouncementItem } from '../../types'

type Props = {
  unreadCount: number
  items: DashboardAnnouncementItem[]
  onOpenAll: () => void
  onMarkRead: (id: number) => void
}

function formatTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function AnnouncementPanel({ unreadCount, items, onOpenAll, onMarkRead }: Props) {
  const pinned = items.find(item => item.is_pinned)
  const regular = items.filter(item => item.id !== pinned?.id)

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
            <Megaphone className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-slate-900">公告通知</h2>
            <p className="text-[11px] text-slate-500">未读 {unreadCount} 条</p>
          </div>
        </div>
        <button onClick={onOpenAll} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-900">
          全部
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-5 text-center text-sm text-slate-400">当前没有需要关注的公告</div>
      ) : (
        <div className="max-h-[280px] overflow-y-auto space-y-2 px-4 py-3">
          {pinned && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-3.5 py-3">
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  <Pin className="h-3 w-3" />
                  置顶公告
                </span>
                {!pinned.is_read && (
                  <button
                    onClick={() => onMarkRead(pinned.id)}
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-50"
                  >
                    <Check className="h-2.5 w-2.5" />
                    已读
                  </button>
                )}
              </div>
              <h3 className="mt-2 text-[13px] font-semibold text-slate-900">{pinned.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{pinned.content}</p>
              <p className="mt-2 text-[11px] text-slate-400">
                {pinned.author_name || '系统'} · {formatTime(pinned.created_at)}
              </p>
            </div>
          )}

          {regular.map(item => (
            <div key={item.id} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
              <div className={`h-2 w-2 rounded-full flex-shrink-0 ${item.is_read ? 'bg-slate-300' : 'bg-rose-500'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-800">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{formatTime(item.created_at)}</p>
              </div>
              {!item.is_read && (
                <button
                  onClick={() => onMarkRead(item.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 flex-shrink-0"
                >
                  <Check className="h-2.5 w-2.5" />
                  已读
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
