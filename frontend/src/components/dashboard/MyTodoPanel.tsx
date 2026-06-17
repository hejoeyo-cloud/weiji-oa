import { CheckSquare, Package, RotateCcw, Wrench, ListTodo, ChevronRight } from 'lucide-react'

interface TodoItem {
  type: string
  label: string
  title: string
  time: string
  path: string
}

const typeConfig: Record<string, { color: string; bg: string; icon: typeof CheckSquare }> = {
  approval: { color: 'text-amber-600', bg: 'bg-amber-50', icon: CheckSquare },
  task: { color: 'text-blue-600', bg: 'bg-blue-50', icon: ListTodo },
  delivery: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Package },
  return_exchange: { color: 'text-orange-600', bg: 'bg-orange-50', icon: RotateCcw },
  repair: { color: 'text-purple-600', bg: 'bg-purple-50', icon: Wrench },
}

export default function MyTodoPanel({ items, onOpen }: { items: TodoItem[]; onOpen: (path: string) => void }) {
  if (!items || items.length === 0) return null

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">我的待办</h2>
          <p className="mt-0.5 text-xs text-slate-400">共 {items.length} 项待处理</p>
        </div>
        <ListTodo className="h-5 w-5 text-slate-400" />
      </div>

      <div className="space-y-2">
        {items.map((item, i) => {
          const cfg = typeConfig[item.type] || typeConfig.task
          const Icon = cfg.icon
          return (
            <button
              key={i}
              onClick={() => onOpen(item.path)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left transition-all hover:border-slate-200 hover:bg-slate-50"
            >
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                <Icon className={`h-4 w-4 ${cfg.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
                    {item.label}
                  </span>
                  <span className="truncate text-sm text-slate-700">{item.title}</span>
                </div>
                {item.time && (
                  <p className="mt-0.5 text-xs text-slate-400">{item.time.slice(0, 16).replace('T', ' ')}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
            </button>
          )
        })}
      </div>
    </section>
  )
}
