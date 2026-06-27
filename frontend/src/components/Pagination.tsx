import { useState } from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  total?: number
  onChange: (page: number) => void
}

export default function Pagination({ page, totalPages, total, onChange }: PaginationProps) {
  const [jumpValue, setJumpValue] = useState('')
  const [showJump, setShowJump] = useState(false)

  if (totalPages <= 1) return null

  const handleJump = () => {
    const num = parseInt(jumpValue)
    if (num >= 1 && num <= totalPages) {
      onChange(num)
      setJumpValue('')
      setShowJump(false)
    }
  }

  // 生成页码按钮
  const getPageNumbers = () => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('...')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i)
      }
      if (page < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        {total !== undefined && <span>共 {total} 条</span>}
        <span>第 {page}/{totalPages} 页</span>
      </div>

      <div className="flex items-center gap-1">
        {/* 上一页 */}
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* 页码按钮 */}
        {getPageNumbers().map((p, i) =>
          p === '...' ? (
            <button
              key={`dots-${i}`}
              onClick={() => setShowJump(!showJump)}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-8 h-8 flex items-center justify-center text-sm rounded-lg transition-colors ${
                p === page
                  ? 'bg-primary-500 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* 下一页 */}
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* 跳转输入框 */}
        {showJump && (
          <div className="flex items-center gap-1 ml-2">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpValue}
              onChange={e => setJumpValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJump()}
              placeholder="页码"
              className="w-16 px-2 py-1 text-sm border border-gray-200 rounded-lg text-center outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-100"
              autoFocus
            />
            <button
              onClick={handleJump}
              className="px-2 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              跳转
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
