import { ArrowUpRight } from 'lucide-react'
import type { DashboardOverviewCard } from '../../types'

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
          <div>
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{card.value}</p>
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
