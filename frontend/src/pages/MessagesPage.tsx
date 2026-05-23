import { useEffect, useState, useRef } from 'react'
import { Search, Send, Edit2, ArrowLeft, Bold, Italic, List, Type } from 'lucide-react'
import { getInbox, getSent, getDrafts, sendMessage, saveDraft, markRead, getUnreadCount } from '../api/messages'
import { getUsers } from '../api/users'
import type { Message, UserBrief } from '../types'

type Folder = 'inbox' | 'sent' | 'drafts'

export default function MessagesPage() {
  const [folder, setFolder] = useState<Folder>('inbox')
  const [messages, setMessages] = useState<Message[]>([])
  const [selected, setSelected] = useState<Message | null>(null)
  const [compose, setCompose] = useState(false)
  const [recipientId, setRecipientId] = useState(0)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [users, setUsers] = useState<UserBrief[]>([])
  const [userSearch, setUserSearch] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)

  const loadFolder = async (f: Folder) => {
    setSelected(null)
    try {
      const fn = { inbox: getInbox, sent: getSent, drafts: getDrafts }[f]
      setMessages(await fn())
    } catch {}
  }

  const loadUsers = async () => {
    try { const res = await getUsers(); setUsers((res.data || []).map((u: any) => ({ id: u.id, name: u.name }))) } catch {}
  }

  useEffect(() => { loadFolder('inbox'); loadUsers() }, [])

  const handleSelect = async (m: Message) => {
    setSelected(m)
    if (folder === 'inbox' && !m.is_read) {
      await markRead(m.id)
      loadFolder('inbox')
    }
  }

  const handleSend = async (draft = false) => {
    if (!recipientId || !subject.trim() || !body.trim()) return
    if (draft) {
      await saveDraft({ recipient_id: recipientId, subject: subject.trim(), content: body.trim() })
    } else {
      await sendMessage({ recipient_id: recipientId, subject: subject.trim(), content: body.trim() })
    }
    setCompose(false); setRecipientId(0); setSubject(''); setBody('')
    loadFolder(draft ? 'drafts' : 'sent')
  }

  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
    editorRef.current?.focus()
  }

  const filteredUsers = users.filter(u => u.name.includes(userSearch))

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* 左侧文件夹 + 邮件列表 */}
      <div className="w-80 border-r flex flex-col bg-white" style={{ borderColor: '#f0f0f0' }}>
        <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: '#f0f0f0' }}>
          <button onClick={() => setCompose(true)}
            className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg flex items-center justify-center gap-1.5">
            <Edit2 size={14} /> 写邮件
          </button>
        </div>

        {/* 文件夹 */}
        <div className="p-1">
          {([
            { key: 'inbox' as Folder, label: '收件箱' },
            { key: 'sent' as Folder, label: '已发送' },
            { key: 'drafts' as Folder, label: '草稿箱' },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => { setFolder(f.key); loadFolder(f.key) }}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                folder === f.key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >{f.label}</button>
          ))}
        </div>

        <div className="border-t" style={{ borderColor: '#f0f0f0' }} />

        {/* 邮件列表 */}
        <div className="flex-1 overflow-auto">
          {messages.map(m => (
            <div
              key={m.id}
              onClick={() => handleSelect(m)}
              className={`px-3 py-3 cursor-pointer border-b transition-colors ${
                selected?.id === m.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'
              }`}
              style={{ borderColor: '#f5f5f5' }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-sm truncate pr-2 ${!m.is_read && folder === 'inbox' ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                  {folder === 'inbox' ? m.sender_name : m.recipient_name}
                </span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">
                  {m.created_at ? new Date(m.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
              <div className={`text-xs truncate ${!m.is_read && folder === 'inbox' ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                {m.subject || '(无主题)'}
              </div>
              <div className="text-[11px] text-gray-400 truncate mt-0.5">
                {m.content?.replace(/<[^>]*>/g, '').slice(0, 40) || ''}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">暂无邮件</div>
          )}
        </div>
      </div>

      {/* 右侧邮件详情 */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selected ? (
          <>
            <div className="px-5 py-3 bg-white border-b" style={{ borderColor: '#f0f0f0' }}>
              <button onClick={() => setSelected(null)} className="mb-2 text-xs text-gray-400 flex items-center gap-1 hover:text-gray-600">
                <ArrowLeft size={14} /> 返回列表
              </button>
              <h2 className="text-base font-semibold text-gray-800">{selected.subject || '(无主题)'}</h2>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span>发件人: <b className="text-gray-700">{selected.sender_name}</b></span>
                <span>收件人: <b className="text-gray-700">{selected.recipient_name}</b></span>
                <span>{selected.created_at ? new Date(selected.created_at).toLocaleString('zh-CN') : ''}</span>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <div className="bg-white rounded-xl p-5 shadow-sm text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: selected.content || '(空)' }} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            选择左侧邮件查看详情
          </div>
        )}
      </div>

      {/* 写邮件弹窗 */}
      {compose && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setCompose(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[600px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b" style={{ borderColor: '#f0f0f0' }}>
              <h3 className="text-sm font-semibold text-gray-700">写邮件</h3>
            </div>

            <div className="p-5 space-y-3 flex-1 overflow-auto">
              {/* 收件人 */}
              <div className="relative">
                <label className="block text-xs text-gray-500 mb-1">收件人</label>
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  placeholder={recipientId ? users.find(u => u.id === recipientId)?.name : '搜索员工'}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                  style={{ borderColor: '#e5e5e5' }} />
                {userSearch && !recipientId && (
                  <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 max-h-28 overflow-auto z-10 shadow-lg">
                    {filteredUsers.slice(0, 8).map(u => (
                      <div key={u.id} onClick={() => { setRecipientId(u.id); setUserSearch(u.name) }}
                        className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">{u.name}</div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">主题</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="邮件主题"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                  style={{ borderColor: '#e5e5e5' }} />
              </div>

              {/* 富文本工具栏 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">内容</label>
                <div className="flex items-center gap-0.5 px-2 py-1 border rounded-t-lg bg-gray-50" style={{ borderColor: '#e5e5e5' }}>
                  {[
                    { cmd: 'bold', icon: Bold, title: '加粗' },
                    { cmd: 'italic', icon: Italic, title: '斜体' },
                    { cmd: 'insertUnorderedList', icon: List, title: '列表' },
                  ].map(btn => (
                    <button key={btn.cmd} title={btn.title}
                      onMouseDown={e => { e.preventDefault(); execCmd(btn.cmd) }}
                      className="p-1.5 hover:bg-gray-200 rounded text-gray-600">
                      <btn.icon size={14} />
                    </button>
                  ))}
                  <div className="w-px h-4 bg-gray-300 mx-1" />
                  <button title="清除格式" onMouseDown={e => { e.preventDefault(); execCmd('removeFormat') }}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"><Type size={14} /></button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => setBody(editorRef.current?.innerHTML || '')}
                  className="min-h-[200px] border border-t-0 rounded-b-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                  style={{ borderColor: '#e5e5e5' }}
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor: '#f0f0f0' }}>
              <button onClick={() => handleSend(true)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600">存草稿</button>
              <button onClick={() => setCompose(false)}
                className="px-4 py-2 border rounded-lg text-sm">取消</button>
              <button onClick={() => handleSend(false)} disabled={!recipientId || !subject.trim()}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50">
                <Send size={14} /> 发送
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
