import { useEffect, useState, useRef } from 'react'
import { Send, Edit2, ArrowLeft, Paperclip, X, Trash2 } from 'lucide-react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { getInbox, getSent, getDrafts, sendMessage, saveDraft, markRead } from '../api/messages'
import OrgTreePicker from '../components/OrgTreePicker'
import client from '../api/client'
import type { Message } from '../types'

type Folder = 'inbox' | 'sent' | 'drafts'

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean'],
  ],
}

export default function MessagesPage() {
  const [folder, setFolder] = useState<Folder>('inbox')
  const [messages, setMessages] = useState<Message[]>([])
  const [selected, setSelected] = useState<Message | null>(null)
  const [compose, setCompose] = useState(false)
  const [recipientId, setRecipientId] = useState(0)
  const [recipientName, setRecipientName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<{ id: number; filename: string; size: number }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadFolder = async (f: Folder) => {
    setSelected(null)
    try {
      setMessages(await { inbox: getInbox, sent: getSent, drafts: getDrafts }[f]())
    } catch {}
  }

  useEffect(() => { loadFolder('inbox') }, [])

  const handleSelect = async (m: Message) => {
    setSelected(m)
    if (folder === 'inbox' && !m.is_read) {
      await markRead(m.id); loadFolder('inbox')
    }
  }

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    if (file.size > 150 * 1024 * 1024) { alert('文件不能超过 150MB'); return }
    setUploading(true)
    const form = new FormData(); form.append('file', file)
    try {
      const res = await client.post('/messages/upload', form)
      setAttachments([...attachments, res.data])
    } catch { alert('上传失败') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const handleSend = async (draft = false) => {
    if (!recipientId || !subject.trim()) return
    const payload = { recipient_id: recipientId, subject: subject.trim(), content: body || '<p></p>' }
    let msg: any
    if (draft) msg = await saveDraft(payload)
    else msg = await sendMessage(payload)

    // Link attachments to message
    if (attachments.length > 0 && msg.id) {
      for (const att of attachments) {
        try { await client.put(`/messages/attach/${att.id}/link/${msg.id}`) } catch {}
      }
    }

    setCompose(false); setRecipientId(0); setRecipientName(''); setSubject(''); setBody(''); setAttachments([])
    loadFolder(draft ? 'drafts' : 'sent')
  }

  const removeAttachment = (id: number) => setAttachments(attachments.filter(a => a.id !== id))

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* 左侧邮件列表 */}
      <div className="w-80 border-r flex flex-col bg-white" style={{ borderColor: '#f0f0f0' }}>
        <div className="p-3 border-b" style={{ borderColor: '#f0f0f0' }}>
          <button onClick={() => setCompose(true)}
            className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg flex items-center justify-center gap-1.5">
            <Edit2 size={14} /> 写邮件
          </button>
        </div>
        <div className="p-1">
          {([ { key: 'inbox' as Folder, label: '收件箱' }, { key: 'sent' as Folder, label: '已发送' }, { key: 'drafts' as Folder, label: '草稿箱' } ]).map(f => (
            <button key={f.key} onClick={() => { setFolder(f.key); loadFolder(f.key) }}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                folder === f.key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}>{f.label}</button>
          ))}
        </div>
        <div className="border-t" style={{ borderColor: '#f0f0f0' }} />
        <div className="flex-1 overflow-auto">
          {messages.map(m => (
            <div key={m.id} onClick={() => handleSelect(m)}
              className={`px-3 py-3 cursor-pointer border-b transition-colors ${selected?.id === m.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
              style={{ borderColor: '#f5f5f5' }}>
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
            </div>
          ))}
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
              <div className="bg-white rounded-xl p-5 shadow-sm text-sm ql-editor-content"
                dangerouslySetInnerHTML={{ __html: selected.content || '(空)' }} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">选择左侧邮件查看详情</div>
        )}
      </div>

      {/* 写邮件弹窗 */}
      {compose && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setCompose(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[780px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: '#f0f0f0' }}>
              <h3 className="text-sm font-semibold text-gray-700">写邮件</h3>
              <button onClick={() => setCompose(false)} className="p-1 hover:bg-gray-100 rounded"><X size={14} /></button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* 左侧：收件人 + 主题 + 编辑器 */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-5 pt-4 space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      收件人 {recipientName && <span className="text-blue-600 font-medium ml-1">{recipientName}</span>}
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">主题</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="邮件主题"
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                      style={{ borderColor: '#e5e5e5' }} />
                  </div>
                </div>

                <div className="flex-1 px-5 py-3 overflow-hidden">
                  <ReactQuill
                    value={body}
                    onChange={setBody}
                    modules={quillModules}
                    className="h-full flex flex-col"
                    style={{ height: '250px' }}
                  />
                </div>

                {/* 附件 */}
                <div className="px-5 py-2 border-t" style={{ borderColor: '#f0f0f0' }}>
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {attachments.map(a => (
                        <div key={a.id} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                          <Paperclip size={10} className="text-gray-400" />
                          <span className="text-gray-600 truncate max-w-40">{a.filename}</span>
                          <span className="text-gray-400">({formatSize(a.size)})</span>
                          <button onClick={() => removeAttachment(a.id)}><Trash2 size={10} className="text-red-400" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer hover:text-blue-600">
                    <Paperclip size={12} />
                    <span>{uploading ? '上传中...' : '添加附件（最大150MB）'}</span>
                    <input ref={fileRef} type="file" onChange={handleUpload} className="hidden" />
                  </label>
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

              {/* 右侧：公司架构树 */}
              <div className="w-56 border-l bg-gray-50 p-3 overflow-auto" style={{ borderColor: '#f0f0f0' }}>
                <h4 className="text-xs font-medium text-gray-500 mb-2">公司架构</h4>
                <OrgTreePicker
                  onSelect={(uid, uname) => { setRecipientId(uid); setRecipientName(uname) }}
                  selectedIds={recipientId ? [recipientId] : []}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
