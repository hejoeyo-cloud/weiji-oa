/**
 * MessagesPage — Three-panel email client
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { Edit2, Star, Trash2, Search, Reply, Forward, Download, Inbox, Send, FileText, RefreshCw, X, Paperclip } from 'lucide-react'
import { getInbox, getSent, getDrafts, getTrash, getCounts, sendMessage, saveDraft, markRead,
         toggleStar, softDelete, permanentDelete, replyMessage, forwardMessage, getAttachments } from '../api/messages'
import { getUsers } from '../api/users'
import client from '../api/client'

type Folder = 'inbox' | 'sent' | 'drafts' | 'trash'
type Mode = 'view' | 'compose' | 'reply' | 'forward'

const folderIcons: Record<Folder, any> = { inbox: Inbox, sent: Send, drafts: FileText, trash: Trash2 }
const folderLabels: Record<Folder, string> = { inbox: '收件箱', sent: '已发送', drafts: '草稿', trash: '回收站' }
const modules = { toolbar: [['bold','italic','underline','strike'],[{list:'ordered'},{list:'bullet'}],['blockquote'],['link','image'],['clean']] }

export default function MessagesPage() {
  const [folder, setFolder] = useState<Folder>('inbox')
  const [messages, setMessages] = useState<any[]>([])
  const [counts, setCounts] = useState<Record<string,number>>({})
  const [selected, setSelected] = useState<any | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('view')
  const [attachments, setAttachments] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [to, setTo] = useState<any[]>([])
  const [ccUsers, setCcUsers] = useState<any[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showToPicker, setShowToPicker] = useState(false)
  const [showCcPicker, setShowCcPicker] = useState(false)
  const [sending, setSending] = useState(false)
  const quillRef = useRef<any>(null)

  useEffect(() => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() }, [])
  const notify = useCallback((t: string, b: string) => {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(t, { body: b, icon: '/vite.svg' })
  }, [])

  const loadFolder = useCallback(async (f: Folder) => {
    setLoading(true)
    try { let data: any
      if (f==='inbox') data = await getInbox(); else if (f==='sent') data = await getSent()
      else if (f==='drafts') data = await getDrafts(); else if (f==='trash') data = await getTrash()
      setMessages(Array.isArray(data?.data||data) ? (data?.data||data) : [])
    } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { loadFolder(folder); loadCounts(); loadUsers() }, [folder])

  const loadCounts = async () => { try { setCounts((await getCounts()).data || {}) } catch {} }
  const loadUsers = async () => { try { setUsers((await getUsers()).data || (await getUsers()) || []) } catch {} }

  const selectMessage = async (msg: any) => {
    setSelected(msg); setMode('view')
    if (msg.is_read===0||msg.is_read===false) try { await markRead(msg.id); loadFolder(folder) } catch {}
    try { setAttachments(await getAttachments(msg.id)) } catch { setAttachments([]) }
  }

  const openCompose = (m: Mode = 'compose', msg?: any) => {
    setMode(m); setSubject(''); setBody(''); setTo([]); setCcUsers([]); setFiles([])
    if (msg) {
      if (m==='reply') { setTo([{id:msg.sender_id,name:msg.sender_name}]); setSubject('Re: '+(msg.subject||'')) }
      if (m==='forward') { setSubject('Fwd: '+(msg.subject||'')); setBody(msg.body||'') }
    }
  }

  const handleSend = async () => {
    const recipientId = to[0]?.id
    if (!recipientId) { alert('请选择收件人'); return }
    setSending(true)
    try {
      if (mode==='compose') { await sendMessage({ recipient_id: recipientId, subject, content: body, draft: false }); notify('邮件已发送', subject||'(无主题)') }
      else if (mode==='reply'&&selected) { await replyMessage(selected.id, { content: body, recipient_id: recipientId }) }
      else if (mode==='forward'&&selected) { await forwardMessage(selected.id, { content: body, recipient_id: recipientId }) }
      setMode('view'); setSelected(null); loadFolder('sent'); loadFolder('inbox')
    } catch (e:any) { const msg = typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : '发送失败'; alert(msg) }
    finally { setSending(false) }
  }

  const handleStar = async (m:any) => { try { await toggleStar(m.id); loadFolder(folder) } catch {} }
  const handleDelete = async (m:any) => {
    if (folder==='trash') { if(!confirm('永久删除？'))return; try{await permanentDelete(m.id);loadFolder('trash');setSelected(null)}catch{} }
    else { try{await softDelete(m.id);loadFolder(folder);setSelected(null)}catch{} }
  }

  const removeRecipient = (arr:any[], setArr:any, id:number) => setArr([])
  const addRecipient = (arr:any[], setArr:any, user:any) => { setArr([user]) }

  const folders: Folder[] = ['inbox','sent','drafts','trash']
  const filtered = messages.filter((m:any)=>!search||(m.subject||'').includes(search)||(m.sender_name||'').includes(search))

  return (
    <div className="flex h-[calc(100vh-80px)] bg-white border rounded-lg overflow-hidden" style={{borderColor:'#e5e7eb'}}>
      {/* Left: Folder Nav */}
      <div className="p-2 flex-shrink-0 border-r flex flex-col" style={{width:180, borderColor:'#e5e7eb'}}>
        <button onClick={()=>openCompose('compose')}
          className="w-full px-3 py-2.5 bg-blue-600 text-white text-sm rounded-lg mb-3 flex items-center gap-2 justify-center hover:bg-blue-700 transition-colors">
          <Edit2 size={15}/>写邮件</button>
        {folders.map(f => { const c = counts[f]||0; const Icon = folderIcons[f]; return (
          <div key={f} onClick={()=>{setFolder(f);setSelected(null);setMode('view')}}
            className={'flex items-center justify-between px-3 py-2.5 text-sm rounded-lg cursor-pointer mb-0.5 transition-colors '+(folder===f?'bg-blue-50 text-blue-700 font-medium':'text-gray-600 hover:bg-gray-50')}>
            <span className="flex items-center gap-2"><Icon size={15}/>{folderLabels[f]}</span>
            {c>0&&<span className="text-xs bg-gray-200 rounded-full px-1.5 min-w-[20px] text-center">{c}</span>}
          </div>)})}
      </div>

      {mode !== 'view' ? (
        /* Compose / Reply / Forward */
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{borderColor:'#e5e7eb'}}>
            <div className="flex items-center gap-3">
              <button onClick={()=>{setMode('view');setSelected(null)}} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
              <span className="font-medium text-sm">{mode==='reply'?'回复':mode==='forward'?'转发':'写邮件'}</span>
            </div>
            <button onClick={handleSend} disabled={sending} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg flex items-center gap-1.5 hover:bg-blue-700 disabled:opacity-50">
              <Send size={14}/> {sending?'发送中...':'发送'}</button>
          </div>
          <div className="flex-1 flex flex-col p-4 overflow-auto">
            {mode !== 'reply' && <div className="mb-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-500 w-12 pt-1.5">收件人</span>
                <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[32px] border rounded-lg px-2 py-1" style={{borderColor:'#d1d5db'}}>
                  {to.map((u:any)=>(
                    <span key={u.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded flex items-center gap-1">
                      {u.name}<button onClick={()=>removeRecipient(to,setTo,u.id)}><X size={10}/></button></span>))}
                  <div className="relative flex-1 min-w-[100px]">
                    <input className="border-none outline-none text-sm w-full py-0.5" placeholder="添加收件人..."
                      onFocus={()=>setShowToPicker(true)} onBlur={()=>setTimeout(()=>setShowToPicker(false),200)} />
                    {showToPicker && <div className="absolute top-full left-0 bg-white border rounded-lg shadow-lg z-20 max-h-48 overflow-auto w-56 mt-1">
                      {users.filter((u:any)=>!to.find((t:any)=>t.id===u.id)).slice(0,20).map((u:any)=>(
                        <div key={u.id} className="px-3 py-1.5 text-sm hover:bg-blue-50 cursor-pointer" onMouseDown={()=>addRecipient(to,setTo,u)}>{u.name}</div>))}
                    </div>}
                  </div>
                </div>
              </div>
            </div>}
            <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="主题"
              className="w-full border-0 border-b px-2 py-2 text-sm outline-none mb-3 focus:border-blue-400" style={{borderColor:'#e5e7eb',borderBottomWidth:1,borderStyle:'solid'}} />
            <div className="flex-1 min-h-[300px]">
              <ReactQuill ref={quillRef} value={body} onChange={setBody} modules={modules} theme="snow" style={{height:'calc(100% - 42px)'}} placeholder="撰写邮件内容..." />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Center: Message List */}
          <div className="flex flex-col border-r" style={{width:360, borderColor:'#e5e7eb'}}>
            <div className="p-2 border-b flex items-center gap-2" style={{borderColor:'#e5e7eb'}}>
              <div className="relative flex-1"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索邮件..." className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400" style={{borderColor:'#d1d5db'}}/>
              </div>
              <button onClick={()=>loadFolder(folder)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><RefreshCw size={14}/></button>
            </div>
            <div className="flex-1 overflow-auto">
              {loading && <div className="text-center py-12 text-gray-400 text-sm">加载中...</div>}
              {!loading && filtered.length===0 && <div className="text-center py-16 text-gray-400 text-sm">{folder==='inbox'?'收件箱为空':'暂无邮件'}</div>}
              {filtered.map((msg:any)=>(
                <div key={msg.id} onClick={()=>selectMessage(msg)} className={'px-3 py-3 cursor-pointer border-b transition-colors '+(selected?.id===msg.id?'bg-blue-50':'hover:bg-gray-50')} style={{borderColor:'#f3f4f6'}}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={'text-sm truncate pr-2 '+(msg.is_read===0?'font-semibold text-gray-900':'text-gray-700')}>{msg.sender_name||msg.recipient_name||'(未知)'}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{fmt(msg.created_at)}</span>
                  </div>
                  <div className="text-sm truncate" style={{fontWeight:msg.is_read===0?600:400}}>{msg.subject||'(无主题)'}</div>
                  <div className="text-xs text-gray-400 truncate mt-0.5">{stripHtml(msg.body||'').slice(0,60)}</div>
                </div>))}
            </div>
          </div>

          {/* Right: Detail */}
          <div className="flex-1 flex flex-col min-w-0">
            {selected ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-2.5 border-b flex items-center gap-1" style={{borderColor:'#e5e7eb'}}>
                  <button onClick={()=>handleStar(selected)} className={'p-1.5 rounded hover:bg-gray-100 '+(selected.is_starred?'text-yellow-500':'text-gray-400')}><Star size={15} fill={selected.is_starred?'currentColor':'none'}/></button>
                  <button onClick={()=>handleDelete(selected)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={15}/></button>
                  <div className="w-px h-4 bg-gray-200 mx-1"/>
                  <button onClick={()=>openCompose('reply',selected)} className="px-3 py-1 text-xs border rounded hover:bg-gray-50"><Reply size={12} className="inline mr-1"/>回复</button>
                  <button onClick={()=>openCompose('forward',selected)} className="px-3 py-1 text-xs border rounded hover:bg-gray-50"><Forward size={12} className="inline mr-1"/>转发</button>
                </div>
                <div className="flex-1 overflow-auto p-5">
                  <h2 className="text-lg font-semibold mb-4">{selected.subject||'(无主题)'}</h2>
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b" style={{borderColor:'#f3f4f6'}}>
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">{(selected.sender_name||'?')[0]}</div>
                    <div className="flex-1"><div className="text-sm font-medium">{selected.sender_name}</div><div className="text-xs text-gray-400">{fmt(selected.created_at)}</div></div>
                  </div>
                  <div className="text-sm leading-relaxed prose max-w-none" dangerouslySetInnerHTML={{__html:selected.body||''}}/>
                  {attachments.length>0&&<div className="mt-5 pt-4 border-t" style={{borderColor:'#f3f4f6'}}><div className="text-xs text-gray-500 mb-2">{attachments.length}个附件</div>
                    {attachments.map((a:any)=>(<a key={a.id} href={client.defaults.baseURL+'/messages/attachment/'+a.id} target="_blank" className="flex items-center gap-2 px-3 py-2 border rounded-lg mb-1.5 text-sm hover:bg-gray-50" style={{borderColor:'#e5e7eb'}}><Download size={14} className="text-gray-400"/>{a.filename}</a>))}</div>}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400"><div className="text-center"><Inbox size={48} className="mx-auto mb-3 opacity-20"/><div className="text-sm">选择一封邮件查看</div></div></div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
function stripHtml(h: string) { return h.replace(/<[^>]*>/g, '') }
function fmt(t: string) { if(!t)return'';try{const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('zh-CN')}catch{return t} }

