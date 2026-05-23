import { useEffect, useState, useRef } from 'react'
import { Search, Send, Edit2, Users } from 'lucide-react'
import { getConversations, getConversation, sendMessage, getUnreadCount } from '../api/messages'
import { getUsers } from '../api/users'
import type { Conversation, Message, UserBrief } from '../types'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [activePartner, setActivePartner] = useState<Conversation | null>(null)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [users, setUsers] = useState<UserBrief[]>([])
  const [composeTo, setComposeTo] = useState(0)
  const [composeText, setComposeText] = useState('')
  const [composeSearch, setComposeSearch] = useState('')
  const chatEnd = useRef<HTMLDivElement>(null)

  const loadConversations = async () => {
    const data = await getConversations(search || undefined)
    setConversations(data)
  }

  const loadMessages = async (partnerId: number) => {
    const data = await getConversation(partnerId)
    setMessages(data)
    setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const loadUsers = async () => {
    try {
      const res = await getUsers()
      setUsers((res.data || []).map((u: any) => ({ id: u.id, name: u.name })))
    } catch { /* ignore */ }
  }

  useEffect(() => { loadConversations(); loadUsers() }, [])
  useEffect(() => { loadConversations() }, [search])

  const handleSelect = (conv: Conversation) => {
    setActivePartner(conv)
    loadMessages(conv.partner_id)
  }

  const handleSend = async () => {
    if (!input.trim() || !activePartner) return
    const msg = await sendMessage({ recipient_id: activePartner.partner_id, content: input.trim() })
    setMessages([...messages, msg])
    setInput('')
    setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    loadConversations()
  }

  const handleCompose = async () => {
    if (!composeTo || !composeText.trim()) return
    await sendMessage({ recipient_id: composeTo, content: composeText.trim() })
    setShowCompose(false)
    setComposeTo(0)
    setComposeText('')
    loadConversations()
  }

  const filteredUsers = users.filter(u => u.name.includes(composeSearch))

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* 左侧：会话列表 */}
      <div className="w-80 border-r flex flex-col bg-white" style={{ borderColor: '#f0f0f0' }}>
        <div className="p-3 border-b space-y-2" style={{ borderColor: '#f0f0f0' }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索联系人"
                className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
                style={{ borderColor: '#e5e5e5' }}
              />
            </div>
            <button
              onClick={() => setShowCompose(true)}
              className="p-2 bg-blue-600 text-white rounded-lg flex-shrink-0"
            ><Edit2 size={14} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {conversations.map(conv => (
            <div
              key={conv.partner_id}
              onClick={() => handleSelect(conv)}
              className={`px-3 py-3 cursor-pointer hover:bg-gray-50 border-b transition-colors ${
                activePartner?.partner_id === conv.partner_id ? 'bg-blue-50/50' : ''
              }`}
              style={{ borderColor: '#f5f5f5' }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-800">{conv.partner_name}</span>
                <span className="text-xs text-gray-400">
                  {conv.last_time ? new Date(conv.last_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 truncate pr-4">{conv.last_content}</span>
                {conv.unread_count > 0 && (
                  <span className="w-5 h-5 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center flex-shrink-0">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              暂无消息
            </div>
          )}
        </div>
      </div>

      {/* 右侧：对话详情 */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {activePartner ? (
          <>
            <div className="px-4 py-3 bg-white border-b" style={{ borderColor: '#f0f0f0' }}>
              <span className="text-sm font-medium text-gray-700">{activePartner.partner_name}</span>
            </div>

            <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
              {messages.map(msg => {
                const isMe = msg.sender_id !== activePartner.partner_id
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[70%]">
                      {!isMe && <span className="text-[10px] text-gray-400 ml-1 mb-0.5 block">{msg.sender_name}</span>}
                      <div className={`px-3 py-2 rounded-2xl text-sm ${
                        isMe ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                      }`}>
                        {msg.content}
                      </div>
                      <span className={`text-[10px] text-gray-400 mt-0.5 block ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div ref={chatEnd} />
            </div>

            <div className="p-3 bg-white border-t flex items-center gap-2" style={{ borderColor: '#f0f0f0' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="输入消息，Enter 发送"
                className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                style={{ borderColor: '#e5e5e5' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              ><Send size={16} /></button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            选择左侧联系人查看消息
          </div>
        )}
      </div>

      {/* 新建消息弹窗 */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCompose(false)}>
          <div className="bg-white rounded-xl p-5 w-96 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-700">新建消息</h3>
            <div className="relative">
              <input
                value={composeSearch}
                onChange={e => setComposeSearch(e.target.value)}
                placeholder="搜索员工"
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                style={{ borderColor: '#e5e5e5' }}
              />
              {composeSearch && (
                <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 max-h-32 overflow-auto z-10 shadow-lg">
                  {filteredUsers.slice(0, 10).map(u => (
                    <div key={u.id} onClick={() => { setComposeTo(u.id); setComposeSearch(u.name); }}
                      className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">{u.name}</div>
                  ))}
                </div>
              )}
            </div>
            <textarea
              value={composeText}
              onChange={e => setComposeText(e.target.value)}
              placeholder="输入消息内容..."
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ borderColor: '#e5e5e5' }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCompose(false)} className="px-4 py-2 border rounded-lg text-sm">取消</button>
              <button onClick={handleCompose} disabled={!composeTo || !composeText.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">发送</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
