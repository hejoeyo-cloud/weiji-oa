import { useEffect, useState, useRef } from 'react'
import { Send, Edit2, ArrowLeft, Paperclip, X, Trash2, Star, Search, RotateCcw, Reply, Forward, Download } from 'lucide-react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { getInbox, getSent, getDrafts, getTrash, getCounts, sendMessage, saveDraft, markRead,
         toggleStar, softDelete, restore, permanentDelete, replyMessage, forwardMessage, getAttachments } from '../api/messages'
import OrgTreePicker from '../components/OrgTreePicker'
import client from '../api/client'
import type { Message } from '../types'

type Folder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash'
type Mode = 'view' | 'compose' | 'reply' | 'forward'

const quillModules = {
  toolbar: [ [{ header: [1,2,3,false] }], ['bold','italic','underline','strike'], [{ color:[] },{ background:[] }],
    [{ list:'ordered' },{ list:'bullet' }], ['blockquote','code-block'], ['link','image'], ['clean'] ],
}

export default function MessagesPage() {
  const [folder, setFolder] = useState<Folder>('inbox')
  const [messages, setMessages] = useState<Message[]>([])
  const [selected, setSelected] = useState<Message | null>(null)
  const [mode, setMode] = useState<Mode>('view')
  const [counts, setCounts] = useState<Record<string,number>>({})
  const [search, setSearch] = useState('')

  // Compose state
  const [recipientId, setRecipientId] = useState(0)
  const [recipientName, setRecipientName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<{id:number;filename:string;size:number}[]>([])
  const [detailAtts, setDetailAtts] = useState<{id:number;filename:string;size:number;mime_type:string}[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async (f: Folder) => {
    setSelected(null); setMode('view')
    try { setMessages(await { inbox:getInbox, sent:getSent, drafts:getDrafts, starred:()=>getInbox(undefined,true), trash:getTrash }[f]()) } catch {}
  }
  const loadCounts = async () => { try { setCounts(await getCounts()) } catch {} }

  useEffect(() => { load('inbox'); loadCounts() }, [])
  useEffect(() => { if (folder === 'inbox' || folder === 'starred') load(folder) }, [search])

  const handleSelect = async (m: Message) => {
    setSelected(m); setMode('view')
    if (folder === 'inbox' && !m.is_read) { await markRead(m.id); load(folder); loadCounts() }
    try { setDetailAtts(await getAttachments(m.id)) } catch { setDetailAtts([]) }
  }

  const switchFolder = (f: Folder) => { setFolder(f); setSearch(''); load(f) }

  const handleStar = async (m: Message) => {
    await toggleStar(m.id)
    setMessages(messages.map(msg => msg.id === m.id ? { ...msg, is_starred: !msg.is_starred } : msg))
    if (selected?.id === m.id) setSelected({ ...selected, is_starred: !selected.is_starred })
  }

  const handleDelete = async (m: Message) => {
    await softDelete(m.id)
    setMessages(messages.filter(msg => msg.id !== m.id))
    if (selected?.id === m.id) setSelected(null)
    loadCounts()
  }

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]; if (!file || file.size > 150*1024*1024) { alert('≤150MB'); return }
    setUploading(true); const form = new FormData(); form.append('file', file)
    try { const r = await client.post('/messages/upload', form); setAttachments([...attachments, r.data]) }
    catch { alert('上传失败') } finally { setUploading(false); if(fileRef.current) fileRef.current.value='' }
  }

  const submit = async (draft=false) => {
    if (!recipientId || !subject.trim()) return
    const payload = { recipient_id: recipientId, subject: subject.trim(), content: body||'<p></p>' }
    let msg: any
    if (mode === 'reply' && selected) msg = await replyMessage(selected.id, payload)
    else if (mode === 'forward' && selected) msg = await forwardMessage(selected.id, payload)
    else if (draft) msg = await saveDraft(payload)
    else msg = await sendMessage(payload)
    if (attachments.length && msg.id) {
      for (const a of attachments) { try { await client.put(`/messages/attach/${a.id}/link/${msg.id}`) } catch {} }
    }
    resetCompose(); load(draft?'drafts':'sent'); setFolder(draft?'drafts':'sent')
  }

  const startReply = () => {
    if (!selected) return; setMode('reply')
    setRecipientId(selected.sender_id); setRecipientName(selected.sender_name)
    setSubject(`Re: ${selected.subject}`); setBody('')
  }
  const startForward = () => { if(!selected) return; setMode('forward'); setSubject(`Fwd: ${selected.subject}`); setRecipientId(0); setRecipientName(''); setBody('') }
  const startCompose = () => { setMode('compose'); setRecipientId(0); setRecipientName(''); setSubject(''); setBody(''); setAttachments([]) }

  const resetCompose = () => { setMode('view'); setRecipientId(0); setRecipientName(''); setSubject(''); setBody(''); setAttachments([]) }

  const formatSize = (b: number) => b<1024?`${b}B`:b<1024*1024?`${(b/1024).toFixed(1)}KB`:`${(b/(1024*1024)).toFixed(1)}MB`

  const isComposing = mode !== 'view'

  const folderBadge = (key: string) => counts[key] ? (
    <span className="ml-auto px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full font-medium">{counts[key]}</span>
  ) : null

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left: folders + list */}
      <div className="w-80 border-r flex flex-col bg-white" style={{ borderColor: '#f0f0f0' }}>
        <div className="p-3 border-b space-y-2" style={{ borderColor: '#f0f0f0' }}>
          <button onClick={startCompose} className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg flex items-center justify-center gap-1.5">
            <Edit2 size={14} /> 写邮件
          </button>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索邮件"
              className="w-full pl-8 pr-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-100" style={{ borderColor:'#e5e5e5' }} />
          </div>
        </div>

        <div className="p-1">
          {([ { k:'inbox' as Folder, l:'收件箱' }, { k:'starred' as Folder, l:'星标邮件' },
              { k:'sent' as Folder, l:'已发送' }, { k:'drafts' as Folder, l:'草稿箱' },
              { k:'trash' as Folder, l:'回收站' } ]).map(f => (
            <button key={f.k} onClick={() => switchFolder(f.k)}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center ${
                folder===f.k?'bg-blue-50 text-blue-700 font-medium':'text-gray-600 hover:bg-gray-50'
              }`}>{f.l}{folderBadge(f.k)}</button>
          ))}
        </div>
        <div className="border-t" style={{ borderColor:'#f0f0f0' }} />

        <div className="flex-1 overflow-auto">
          {messages.map(m => (
            <div key={m.id} onClick={() => handleSelect(m)}
              className={`px-3 py-2.5 cursor-pointer border-b transition-colors group ${selected?.id===m.id?'bg-blue-50/50':'hover:bg-gray-50'}`}
              style={{ borderColor:'#f5f5f5' }}>
              <div className="flex items-center gap-1">
                <button onClick={e => { e.stopPropagation(); handleStar(m) }}
                  className={`flex-shrink-0 ${m.is_starred?'text-yellow-500':'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-yellow-400'}`}>
                  <Star size={12} fill={m.is_starred?'currentColor':'none'} /></button>
                {m.has_attachments && <Paperclip size={10} className="text-gray-400 flex-shrink-0" />}
                <span className={`text-xs truncate flex-1 ${!m.is_read&&folder==='inbox'?'font-semibold text-gray-900':'text-gray-700'}`}>
                  {folder==='inbox'?m.sender_name:m.recipient_name}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">
                  {m.created_at?new Date(m.created_at).toLocaleDateString('zh-CN',{month:'short',day:'numeric'}):''}</span>
              </div>
              <div className={`text-xs truncate mt-0.5 ${!m.is_read&&folder==='inbox'?'font-medium text-gray-800':'text-gray-500'}`}>
                {m.subject||'(无主题)'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: detail / compose */}
      {isComposing ? (
        <div className="flex-1 flex flex-col bg-gray-50">
          <div className="bg-white border-b px-5 py-3 flex items-center justify-between" style={{ borderColor:'#f0f0f0' }}>
            <h3 className="text-sm font-semibold text-gray-700">
              {mode==='reply'?'回复':mode==='forward'?'转发':'写邮件'}
            </h3>
            <button onClick={resetCompose} className="p-1 hover:bg-gray-100 rounded"><X size={14}/></button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-5 pt-4 space-y-3">
                {mode!=='reply' && (
                  <div><label className="block text-xs text-gray-500 mb-1">
                    收件人 {recipientName&&<span className="text-blue-600 font-medium">{recipientName}</span>}</label></div>
                )}
                {mode==='reply' && <div className="text-xs text-gray-500">收件人: <b>{recipientName}</b></div>}
                <div><label className="block text-xs text-gray-500 mb-1">主题</label>
                  <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="邮件主题"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" style={{ borderColor:'#e5e5e5' }} /></div>
              </div>
              <div className="flex-1 px-5 py-3 overflow-hidden">
                <ReactQuill value={body} onChange={setBody} modules={quillModules} style={{ height:'220px' }} />
              </div>
              <div className="px-5 py-2 border-t space-y-2" style={{ borderColor:'#f0f0f0' }}>
                {attachments.length>0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map(a => (
                      <div key={a.id} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                        <Paperclip size={10}/><span className="truncate max-w-32">{a.filename}</span>({formatSize(a.size)})
                        <button onClick={()=>setAttachments(attachments.filter(x=>x.id!==a.id))}><Trash2 size={10} className="text-red-400"/></button>
                      </div>))}
                  </div>)}
                <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer hover:text-blue-600">
                  <Paperclip size={12}/>{uploading?'上传中...':'添加附件（最大150MB）'}
                  <input ref={fileRef} type="file" onChange={handleUpload} className="hidden"/></label>
              </div>
              <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor:'#f0f0f0' }}>
                {mode==='compose' && <button onClick={()=>submit(true)} className="px-4 py-2 border rounded-lg text-sm text-gray-600">存草稿</button>}
                <button onClick={resetCompose} className="px-4 py-2 border rounded-lg text-sm">取消</button>
                <button onClick={()=>submit(false)} disabled={!recipientId||!subject.trim()}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50">
                  <Send size={14}/>发送</button>
              </div>
            </div>
            {mode!=='reply' && (
              <div className="w-56 border-l bg-gray-50 p-3 overflow-auto" style={{ borderColor:'#f0f0f0' }}>
                <h4 className="text-xs font-medium text-gray-500 mb-2">公司架构</h4>
                <OrgTreePicker onSelect={(uid,name)=>{setRecipientId(uid);setRecipientName(name)}} selectedIds={recipientId?[recipientId]:[]} />
              </div>
            )}
          </div>
        </div>
      ) : selected ? (
        <div className="flex-1 flex flex-col bg-gray-50">
          <div className="px-5 py-3 bg-white border-b" style={{ borderColor:'#f0f0f0' }}>
            <button onClick={()=>setSelected(null)} className="mb-2 text-xs text-gray-400 flex items-center gap-1 hover:text-gray-600">
              <ArrowLeft size={14}/>返回列表</button>
            <div className="flex items-center gap-2">
              <button onClick={()=>handleStar(selected)} className={`${selected.is_starred?'text-yellow-500':'text-gray-300'}`}>
                <Star size={16} fill={selected.is_starred?'currentColor':'none'}/></button>
              <h2 className="text-base font-semibold text-gray-800 flex-1">{selected.subject||'(无主题)'}</h2>
              <div className="flex items-center gap-1">
                <button onClick={startReply} className="px-3 py-1.5 border rounded-lg text-xs flex items-center gap-1 hover:bg-gray-50">
                  <Reply size={12}/>回复</button>
                <button onClick={startForward} className="px-3 py-1.5 border rounded-lg text-xs flex items-center gap-1 hover:bg-gray-50">
                  <Forward size={12}/>转发</button>
                <button onClick={()=>handleDelete(selected)} className="px-3 py-1.5 border rounded-lg text-xs flex items-center gap-1 hover:bg-red-50 text-red-500">
                  <Trash2 size={12}/>删除</button>
                {folder==='trash' && <>
                  <button onClick={async()=>{await restore(selected.id);switchFolder('inbox')}}
                    className="px-3 py-1.5 border rounded-lg text-xs flex items-center gap-1 hover:bg-green-50 text-green-600"><RotateCcw size={12}/>恢复</button>
                  <button onClick={async()=>{await permanentDelete(selected.id);setMessages(messages.filter(m=>m.id!==selected.id));setSelected(null)}}
                    className="px-3 py-1.5 border rounded-lg text-xs flex items-center gap-1 hover:bg-red-50 text-red-600"><Trash2 size={12}/>彻底删除</button>
                </>}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {selected.sender_name} → {selected.recipient_name} · {selected.created_at?new Date(selected.created_at).toLocaleString('zh-CN'):''}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-5">
            <div className="bg-white rounded-xl p-5 shadow-sm text-sm leading-relaxed ql-editor-content"
              dangerouslySetInnerHTML={{__html:selected.content||'(空)'}}/>
            {detailAtts.length>0 && (
              <div className="mt-3 bg-white rounded-xl p-4 shadow-sm">
                <h4 className="text-xs font-medium text-gray-500 mb-2">附件 ({detailAtts.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {detailAtts.map(a => (
                    <a key={a.id} href={`/api/messages/attachment/${a.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-blue-600 hover:bg-blue-50">
                      <Paperclip size={11}/>{a.filename} ({formatSize(a.size)})<Download size={11}/></a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">选择左侧邮件查看详情</div>
      )}
    </div>
  )
}
