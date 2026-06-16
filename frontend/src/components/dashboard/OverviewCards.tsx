import { ArrowUpRight } from 'lucide-react'
import type { DashboardOverviewCard } from '../../types'

const statusStyles: Record<string, string> = {
  info: 'bg-sky-50 text-sky-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  neutral: 'bg-slate-100 text-slate-600',
}

export default function OverviewCards({
  cards,
  onOpen,
}: {
  cards: DashboardOverviewCard[]
  onOpen: (path?: string) => void
}) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {cards.map(card => (
        <button
          key={card.key}
          onClick={() => onOpen(card.path)}
          className="group rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">{card.title}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{card.value}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyles[card.status] || statusStyles.neutral}`}>
              {card.status}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="text-sm leading-6 text-slate-500">{card.subtext}</p>
            <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
          </div>
        </button>
      ))}
    </section>
  )
}
