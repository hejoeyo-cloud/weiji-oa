import { Mail, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface UnreadMessage {
  id: number; subject: string; sender_name: string; content_preview: string; created_at: string
}

export default function UnreadMessagesPanel({ messages }: { messages: UnreadMessage[] }) {
  const navigate = useNavigate()

  return (
    <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#f0f0f0' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Mail size={14} className="text-blue-600" /> 未读邮件
        </h3>
        <button onClick={() => navigate('/messages')} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
          查看全部 <ArrowRight size={12} />
        </button>
      </div>
      {messages.length === 0 ? (
        <div className="text-center py-4 text-xs text-gray-400">暂无未读邮件</div>
      ) : (
        <div className="space-y-2">
          {messages.slice(0, 5).map(msg => (
            <div key={msg.id} onClick={() => navigate('/messages')}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-medium flex-shrink-0">
                {(msg.sender_name || '?')[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800 truncate">{msg.subject}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{fmtShort(msg.created_at)}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{msg.sender_name}</div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{msg.content_preview}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function fmtShort(t: string) {
  if (!t) return ''
  try {
    const d = new Date(t)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch { return t }
}
