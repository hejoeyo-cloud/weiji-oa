import {
  Calendar,
  CheckSquare,
  ClipboardList,
  Gift,
  Package,
  PlusSquare,
  RotateCcw,
  Wrench,
} from 'lucide-react'
import type { DashboardShortcut } from '../../types'

const iconMap = {
  ticket: PlusSquare,
  return_exchange: RotateCcw,
  repair: Wrench,
  gift_box: Package,
  gift_resend: Gift,
  approval: CheckSquare,
  calendar: Calendar,
} as const

export default function QuickActions({
  shortcuts,
  onOpen,
}: {
  shortcuts: DashboardShortcut[]
  onOpen: (path: string) => void
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">快捷入口</h2>
        <p className="mt-1 text-sm text-slate-500">弱化展示高频动作，保留正式 OA 首页的工作入口感。</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {shortcuts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400 xl:col-span-6">
            当前账号没有可展示的快捷入口
          </div>
        ) : shortcuts.map(item => {
          const Icon = iconMap[item.icon as keyof typeof iconMap] || PlusSquare
          return (
            <button
              key={item.key}
              onClick={() => onOpen(item.path)}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-900">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
