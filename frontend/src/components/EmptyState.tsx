import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ElementType
  title?: string
  description?: string
}

export default function EmptyState({
  icon: Icon = Inbox,
  title = '暂无数据',
  description,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-300" />
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1.5">{description}</p>}
    </div>
  )
}
