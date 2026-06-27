import { useState, useEffect, useRef } from 'react'
import { BookOpen, ChevronRight, X } from 'lucide-react'
import { suggestArticles, type KnowledgeSuggestItem } from '../api/knowledge'

const matchTypeLabel: Record<string, { label: string; color: string }> = {
  title: { label: '标题匹配', color: 'bg-primary-50 text-primary-600' },
  keyword: { label: '关键词', color: 'bg-amber-50 text-amber-600' },
  desc: { label: '内容匹配', color: 'bg-gray-100 text-gray-500' },
}

export default function KnowledgeSuggest({
  query,
  onSelect,
}: {
  query: string
  onSelect?: (article: KnowledgeSuggestItem) => void
}) {
  const [results, setResults] = useState<KnowledgeSuggestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (dismissed) return
    if (!query || query.length < 3) {
      setResults([])
      return
    }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setLoading(true)
      suggestArticles(query)
        .then(res => setResults(res.data))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 500)
    return () => clearTimeout(timerRef.current)
  }, [query, dismissed])

  if (dismissed || !query || query.length < 3 || (results.length === 0 && !loading)) return null

  return (
    <div className="border border-primary-200 bg-primary-50/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-primary-700">
          <BookOpen className="w-3.5 h-3.5" />
          {loading ? '正在搜索知识库...' : `找到 ${results.length} 条相关知识`}
        </div>
        <button onClick={() => setDismissed(true)} className="p-0.5 hover:bg-primary-100 rounded">
          <X className="w-3 h-3 text-primary-400" />
        </button>
      </div>

      {results.length > 0 && (
        <div className="divide-y divide-primary-100">
          {results.map(item => {
            const mt = matchTypeLabel[item.match_type] || matchTypeLabel.desc
            const isExpanded = expanded === item.id
            return (
              <div key={item.id} className="bg-white">
                <button
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${mt.color}`}>{mt.label}</span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{item.title}</span>
                  {item.category_name && <span className="text-xs text-gray-400">{item.category_name}</span>}
                  <ChevronRight className={`w-3.5 h-3.5 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    {item.problem_desc && (
                      <p className="text-xs text-gray-500 line-clamp-3">{item.problem_desc}</p>
                    )}
                    {onSelect && (
                      <button
                        onClick={() => onSelect(item)}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        引用此知识 →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
