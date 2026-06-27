import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ZoomIn, Send, MessageSquare, Lock, Clock, ChevronDown, BookOpen } from 'lucide-react'
import { getTicket, updateTicket, addFeedback } from '../api/tickets'
import { createArticleFromTicket } from '../api/knowledge'
import { useAuth } from '../hooks/useAuth'
import CustomerProfile from '../components/CustomerProfile'
import type { Ticket } from '../types'

const statusLabel: Record<string, string> = {
  pending: '待处理', processing: '处理中', need_return: '需寄回', completed: '已完成',
}
const statusStyle: Record<string, string> = {
  pending: 'bg-orange-50 text-orange-600', processing: 'bg-blue-50 text-blue-600',
  need_return: 'bg-red-50 text-red-600', completed: 'bg-green-50 text-green-600',
}
const priorityLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }
const priorityStyle: Record<string, string> = {
  high: 'bg-red-50 text-red-600', medium: 'bg-yellow-50 text-yellow-700', low: 'bg-gray-50 text-gray-600',
}
const remoteLabel: Record<string, string> = { netease: '网易远程', sunlogin: '向日葵远程', todesk: 'ToDesk', gotohttp: 'GotoHTTP' }

const feedbackTypeConfig: Record<string, { label: string; color: string; dotColor: string; icon: typeof Clock }> = {
  progress: { label: '进度更新', color: 'bg-blue-50 text-blue-600', dotColor: 'bg-primary-400', icon: Clock },
  internal: { label: '内部备注', color: 'bg-gray-100 text-gray-500', dotColor: 'bg-gray-400', icon: Lock },
  contact: { label: '客户沟通', color: 'bg-green-50 text-green-600', dotColor: 'bg-green-400', icon: MessageSquare },
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isHighlighted = searchParams.get('highlight') === id
  const { hasPermission } = useAuth()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [feedback, setFeedback] = useState('')
  const [feedbackType, setFeedbackType] = useState<string>('progress')
  const [timelineFilter, setTimelineFilter] = useState<string>('all')
  const [previewImg, setPreviewImg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 高亮动画样式
  const highlightStyle = `
    @keyframes highlight-flash {
      0% { box-shadow: 0 0 0 4px #fde68a; }
      30% { box-shadow: 0 0 20px 4px #fde68a; }
      60% { box-shadow: 0 0 10px 2px #fde68a; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }
    .highlight-box { animation: highlight-flash 2s ease-out; }
  `

  const fetchTicket = () => {
    if (!id) return
    getTicket(Number(id)).then((res) => setTicket(res.data)).catch(() => {})
  }

  useEffect(() => { fetchTicket() }, [id])

  const handleStatusChange = async (status: string) => {
    if (!id || !ticket || ticket.status === status) return
    setLoading(true)
    try {
      await updateTicket(Number(id), { status })
      await addFeedback(Number(id), `工单状态变更为：${statusLabel[status]}`, 'progress')
      fetchTicket()
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !feedback.trim()) return
    try {
      await addFeedback(Number(id), feedback, feedbackType)
      setFeedback('')
      fetchTicket()
    } catch (err) { console.error(err) }
  }

  if (!ticket) return <div className="text-center py-20 text-gray-400">加载中...</div>

  return (
    <>
      <style>{highlightStyle}</style>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className={`flex items-center gap-3 ${isHighlighted ? 'highlight-box' : ''}`}>
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-200"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <h1 className="text-xl font-bold text-gray-800">工单 #{ticket.id}</h1>
          <span className={`badge ${statusStyle[ticket.status]}`}>{statusLabel[ticket.status]}</span>
        </div>

        {/* Basic info */}
        <div className={`card p-5 ${isHighlighted ? 'highlight-box' : ''}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-400">优先级</span><br /><span className={`badge ${priorityStyle[ticket.priority]}`}>{priorityLabel[ticket.priority]}</span></div>
          <div><span className="text-gray-400">店铺名字</span><br /><span className="font-medium text-gray-800">{ticket.platform || '-'}</span></div>
          <div><span className="text-gray-400">提交人</span><br /><span className="font-medium text-gray-800">{ticket.creator_name}</span></div>
          <div><span className="text-gray-400">创建时间</span><br /><span className="font-medium text-gray-800">{ticket.created_at ? new Date(ticket.created_at).toLocaleString('zh-CN') : '-'}</span></div>
        </div>
        {ticket.customer_id && (
          <div className="mt-3 text-sm"><span className="text-gray-400">客户ID：</span><span className="font-medium text-gray-800">{ticket.customer_id}</span></div>
        )}
      </div>

      {/* Customer profile */}
      {ticket.customer_id && <CustomerProfile customerId={ticket.customer_id} />}

      {/* Description & images */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">问题描述</h3>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{ticket.description || '无描述'}</p>
        {ticket.images && ticket.images.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3">
            {ticket.images.map((url) => (
              <div key={url} className="w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer" onClick={() => setPreviewImg(url)}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Remote info */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">远程协助信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-gray-400">远程工具</span>
            <p className="text-sm font-medium text-gray-800">{remoteLabel[ticket.remote_tool] || ticket.remote_tool}</p>
          </div>
          {hasPermission('tickets:edit') && (
            <div>
              <span className="text-xs text-gray-400">远程码 / 验证码</span>
              <div className="mt-1 space-y-1">
                {ticket.remote_code && <p className="text-sm font-mono font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded select-all">{ticket.remote_code}</p>}
                {ticket.verify_code && <p className="text-sm font-mono font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded select-all">{ticket.verify_code}</p>}
                {!ticket.remote_code && !ticket.verify_code && <p className="text-sm text-gray-400">未填写</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Diagnosis log */}
      {ticket.diagnosis_log && ticket.diagnosis_log.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">排查记录</h3>
          <div className="space-y-2">
            {ticket.diagnosis_log.map((step: any, idx: number) => (
              <div key={idx} className="flex gap-3 text-sm">
                <span className="text-gray-400 font-mono w-6 flex-shrink-0">{idx + 1}.</span>
                <div>
                  <span className="font-medium text-gray-700">{step.title}</span>
                  {step.answer && <span className="text-gray-500 ml-2">→ {step.answer}</span>}
                </div>
              </div>
            ))}
          </div>
          {ticket.diagnosis_result && (
            <div className={`mt-3 p-2 rounded-lg text-sm ${ticket.diagnosis_result === 'hardware' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              诊断结果：{ticket.diagnosis_result === 'hardware' ? '硬件故障 - 需寄回' : '软件问题 - 远程解决'}
            </div>
          )}
        </div>
      )}

      {/* Admin/Tech actions */}
      {hasPermission('tickets:edit') && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">处理操作</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => handleStatusChange('processing')}
              disabled={loading}
              className={`text-sm py-1.5 px-3 rounded-lg transition-colors ${
                ticket.status === 'processing'
                  ? 'bg-blue-100 text-blue-700 cursor-default'
                  : 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-50'
              }`}
            >
              处理中
            </button>
            <button
              onClick={() => handleStatusChange('need_return')}
              disabled={loading}
              className={`text-sm py-1.5 px-3 rounded-lg transition-colors ${
                ticket.status === 'need_return'
                  ? 'bg-red-100 text-red-700 cursor-default'
                  : 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
              }`}
            >
              需寄回
            </button>
            <button
              onClick={() => handleStatusChange('completed')}
              disabled={loading}
              className={`text-sm py-1.5 px-3 rounded-lg transition-colors ${
                ticket.status === 'completed'
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-white border border-green-200 text-green-600 hover:bg-green-50'
              }`}
            >
              完结工单
            </button>
          </div>
          {hasPermission('knowledge:create') && (
            <button
              onClick={async () => {
                try {
                  const res = await createArticleFromTicket(ticket.id)
                  navigate(`/knowledge/${res.data.id}/edit`)
                } catch (err: any) {
                  alert(err.response?.data?.detail || '沉淀失败')
                }
              }}
              className="btn-ghost flex items-center gap-1.5 text-xs mb-3"
            >
              <BookOpen className="w-3.5 h-3.5" /> 沉淀为知识库
            </button>
          )}
          <form onSubmit={handleSubmitFeedback} className="space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="progress">进度更新</option>
                <option value="internal">内部备注</option>
                <option value="contact">客户沟通</option>
              </select>
              {feedbackType === 'internal' && (
                <span className="text-xs text-gray-400 flex items-center gap-1"><Lock className="w-3 h-3" />仅团队可见</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={feedbackType === 'internal' ? '添加内部备注...' : feedbackType === 'contact' ? '记录客户沟通内容...' : '添加处理反馈...'}
                className="input-field flex-1"
              />
              <button type="submit" className="btn-primary flex items-center gap-1">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feedback timeline */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-600">处理记录</h3>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {[
              { key: 'all', label: '全部' },
              { key: 'progress', label: '进度' },
              { key: 'internal', label: '内部' },
              { key: 'contact', label: '沟通' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTimelineFilter(t.key)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${timelineFilter === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const filtered = timelineFilter === 'all'
            ? ticket.feedbacks
            : ticket.feedbacks.filter(f => f.feedback_type === timelineFilter)
          return filtered.length === 0 ? (
            <p className="text-sm text-gray-400">暂无{timelineFilter === 'all' ? '' : feedbackTypeConfig[timelineFilter]?.label || ''}记录</p>
          ) : (
            <div className="space-y-4">
              {filtered.map((f) => {
                const cfg = feedbackTypeConfig[f.feedback_type] || feedbackTypeConfig.progress
                const Icon = cfg.icon
                return (
                  <div key={f.id} className="flex gap-3">
                    <div className={`w-2 h-2 rounded-full ${cfg.dotColor} mt-2 flex-shrink-0`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.color}`}>
                          <Icon className="w-2.5 h-2.5" />{cfg.label}
                        </span>
                        <span className="font-medium text-gray-700">{f.user_name}</span>
                        <span className="text-gray-400 text-xs">{f.created_at ? new Date(f.created_at).toLocaleString('zh-CN') : ''}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{f.content}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Image preview */}
      {previewImg && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
    </>
  )
}
