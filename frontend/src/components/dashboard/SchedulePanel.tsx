import { ArrowRight, Calendar } from 'lucide-react'
import type { DashboardScheduleSlot } from '../../types'

type Props = {
  slots: DashboardScheduleSlot[]
  todaySlot?: DashboardScheduleSlot | null
  tomorrowSlot?: DashboardScheduleSlot | null
  onOpenSchedule: () => void
}

function getTodayString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function getWeekDates() {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + index)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      label: ['一', '二', '三', '四', '五', '六', '日'][index],
      day: d.getDate(),
    }
  })
}

function ShiftBadge({ slot, large = false }: { slot?: DashboardScheduleSlot | null; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-semibold text-white ${large ? 'h-6 min-w-6 px-1.5 text-[10px]' : 'h-5 min-w-5 px-1 text-[9px]'}`}
      style={{ backgroundColor: slot?.shift_color || '#CBD5E1' }}
    >
      {slot?.shift_short_name || (slot?.shift_name ? slot.shift_name[0] : '休')}
    </span>
  )
}

export default function SchedulePanel({ slots, todaySlot, tomorrowSlot, onOpenSchedule }: Props) {
  const weekDates = getWeekDates()
  const today = getTodayString()
  const slotMap: Record<string, DashboardScheduleSlot> = {}
  for (const slot of slots) slotMap[slot.date] = slot

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-500">
            <Calendar className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-slate-900">我的班次</h2>
            <p className="text-[11px] text-slate-500">今明安排与本周班次概览</p>
          </div>
        </div>
        <button onClick={onOpenSchedule} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-900">
          排班表
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">今天</p>
            <div className="mt-2 flex items-center gap-2">
              <ShiftBadge slot={todaySlot} large />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">{todaySlot?.shift_name || '休息'}</p>
                <p className="text-[11px] text-slate-400">{todaySlot ? '已加入排班' : '暂无班次安排'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">明天</p>
            <div className="mt-2 flex items-center gap-2">
              <ShiftBadge slot={tomorrowSlot} large />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">{tomorrowSlot?.shift_name || '休息'}</p>
                <p className="text-[11px] text-slate-400">{tomorrowSlot ? '已加入排班' : '暂无班次安排'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-medium text-slate-500">本周</p>
            <p className="text-[11px] text-slate-400">周一至周日</p>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDates.map(item => {
              const slot = slotMap[item.key]
              const isToday = item.key === today
              return (
                <div
                  key={item.key}
                  className={`rounded-xl border px-1 py-2 text-center ${
                    isToday ? 'border-sky-200 bg-sky-50' : 'border-slate-100 bg-slate-50/60'
                  }`}
                  title={slot?.shift_name || '休息'}
                >
                  <p className={`text-[9px] font-medium ${isToday ? 'text-sky-700' : 'text-slate-400'}`}>{item.label}</p>
                  <p className={`mt-1 text-[10px] ${isToday ? 'font-semibold text-sky-800' : 'text-slate-600'}`}>{item.day}</p>
                  <div className="mt-1 flex justify-center">
                    <ShiftBadge slot={slot} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
