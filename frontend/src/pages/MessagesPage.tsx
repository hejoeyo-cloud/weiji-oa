/**
 * MessagesPage — Gmail-style three-panel layout
 * Left: folder nav | Center: thread list | Right: message detail
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { Send, Edit2, ArrowLeft, Paperclip, X, Trash2, Star, Search, RotateCcw, Reply, Forward, Download, Inbox } from 'lucide-react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { getInbox, getSent, getDrafts, getTrash, getCounts, sendMessage, saveDraft, markRead,
         toggleStar, softDelete, restore, permanentDelete, replyMessage, forwardMessage, getAttachments } from '../api/messages'
import { getUsers } from '../api/users'
import client from '../api/client'
import type { Message, UserBrief } from '../types'

type Folder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash'
type Mode = 'view' | 'compose' | 'reply' | 'forward'

const quillModules = {
  toolbar: [ [{ header: [1,2,3,false] }], ['bold','italic','underline','strike'], [{ color:[] },{ background:[] }],
    [{ list:'ordered' },{ list:'bullet' }], ['blockquote','code-block'], ['link','image'], ['clean'] ],
}

const folderLabels: Record<Folder, string> = { inbox: '收件箱', sent: '已发送', drafts: '草稿', starred: '星标', trash: '回收站' }

export default function MessagesPage() {
  const [folder, setFolder] = useState<Folder>('inbox')
  const [mode, setMode] = useState<Mode>('view')
  const [messages, setMessages] = useState<Message[]>([])
  const [counts, setCounts] = useState<Record<string,number>>({})
  const [selected, setSelected] = useState<Message | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [composeOpen, setComposeOpen] = useState(false)
  const [to, setTo] = useState<number[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [users, setUsers] = useState<UserBrief[]>([])
  const [replyId, setReplyId] = useState(0)
  const [attachments, setAttachments] = useState<any[]>([])
  const [showToPicker, setShowToPicker] = useState(false)

  useEffect(() => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() }, [])
  const notify = useCallback((t: string, b: string) => {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(t, { body: b, icon: '/vite.svg' })
  }, [])

  const loadFolder = useCallback(async (f: Folder) => {
    setLoading(true)
    try {
      let data: any
      if (f === 'inbox') data = await getInbox()
      else if (f === 'sent') data = await getSent()
      else if (f === 'drafts') data = await getDrafts()
      else if (f === 'trash') data = await getTrash()
      const arr = data?.data || data || []
      setMessages(Array.isArray(arr) ? arr : [])
    } catch { } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadFolder(folder); loadCounts(); loadUsers() }, [folder])

  const loadCounts = async () => { try { const c = (await getCounts()).data || await getCounts(); setCounts(c || {}) } catch {} }
  const loadUsers = async () => { try { setUsers((await getUsers()).data || (await getUsers()) || []) } catch {} }
  const fetchAttachments = async (id: number) => { try { setAttachments(await getAttachments(id)) } catch { setAttachments([]) } }

  const selectMessage = async (msg: Message) => {
    setSelected(msg); fetchAttachments(msg.id)
    if (msg.is_read === 0 || msg.is_read === false) { try { await markRead(msg.id); loadFolder(folder) } catch {} }
  }

  const handleSend = async () => {
    try {
      if (mode === 'compose') { await sendMessage({ to_ids: to, subject, body, draft: false, thread_id: replyId || undefined }); notify('邮件已发送', subject || '(无主题)') }
      else if (mode === 'reply' && selected) { await replyMessage(selected.id, { body, to_ids: to }); notify('回复已发送', 'Re: '+selected.subject) }
      else if (mode === 'forward' && selected) { await forwardMessage(selected.id, { body, to_ids: to }); notify('转发已发送', 'Fwd: '+selected.subject) }
      setComposeOpen(false); resetCompose(); loadFolder('sent')
    } catch (e: any) { alert(e?.response?.data?.detail || '发送失败') }
  }

  const handleSaveDraft = async () => { try { await saveDraft({ to_ids: to, subject, body }); setComposeOpen(false); resetCompose(); loadFolder('drafts') } catch {} }
  const resetCompose = () => { setSubject(''); setBody(''); setTo([]); setReplyId(0); setMode('view') }
  const openCompose = (m: Mode = 'compose', msg?: Message) => {
    resetCompose(); setMode(m); setComposeOpen(true)
    if (msg) {
      if (m === 'reply') { setTo([msg.sender_id]); setSubject('Re: '+(msg.subject||'')); setReplyId(msg.id) }
      if (m === 'forward') { setSubject('Fwd: '+(msg.subject||'')); setReplyId(msg.id) }
    }
  }
  const handleStar = async (m: Message) => { try { await toggleStar(m.id); loadFolder(folder) } catch {} }
  const handleDelete = async (m: Message) => {
    if (folder === 'trash') {
      if (!confirm('永久删除？')) return; try { await permanentDelete(m.id); loadFolder('trash'); setSelected(null) } catch {}
    } else { try { await softDelete(m.id); loadFolder(folder); setSelected(null) } catch {} }
  }

  const folders: Folder[] = ['inbox', 'sent', 'drafts', 'trash']

  if (composeOpen) return <ComposeEditor mode={mode} folder={folder} setFolder={setFolder} setSelected={setSelected}
    setComposeOpen={setComposeOpen} to={to} setTo={setTo} subject={subject} setSubject={setSubject} body={body}
    setBody={setBody} users={users} showToPicker={showToPicker} setShowToPicker={setShowToPicker}
    folderLabels={folderLabels} counts={counts} onSend={handleSend} onSaveDraft={handleSaveDraft} openCompose={openCompose} />

  return (
    <div className="flex h-[calc(100vh-80px)] bg-white rounded-lg border overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
      {/* Left Nav */}
      <div className="p-2 flex-shrink-0 border-r flex flex-col" style={{ width: 180, borderColor: '#f0f0f0' }}>
        <button onClick={() => openCompose('compose')} className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg mb-3 flex items-center gap-2 justify-center"><Edit2 size={14} />写邮件</button>
        {folders.map(f => { const c = counts[f] || 0; return (
          <div key={f} onClick={() => { setFolder(f); setSelected(null) }} className={'flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer mb-0.5 '+(folder===f?'bg-blue-50 text-blue-700 font-medium':'text-gray-600 hover:bg-gray-50')}>
            <span>{folderLabels[f]}</span>{c>0&&<span className="text-xs bg-gray-200 rounded-full px-1.5 min-w-[20px] text-center">{c}</span>}
          </div>)})}
      </div>

      {/* Center List */}
      <div className="flex flex-col border-r" style={{ width: 350, borderColor: '#f0f0f0' }}>
        <div className="p-2 border-b" style={{ borderColor: '#f0f0f0' }}>
          <div className="relative"><Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索邮件..." className="w-full pl-7 pr-3 py-1.5 text-sm border rounded-lg outline-none" style={{borderColor:'#e5e5e5'}} />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading && <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>}
          {!loading && messages.filter(m=>!search||(m.subject||'').includes(search)||(m.sender_name||'').includes(search)).length===0 &&
            <div className="text-center py-12 text-gray-400 text-sm">{folder==='inbox'?'收件箱为空':'暂无邮件'}</div>}
          {messages.filter(m=>!search||(m.subject||'').includes(search)||(m.sender_name||'').includes(search)).map(msg=>(
            <div key={msg.id} onClick={()=>selectMessage(msg)} className={'px-3 py-3 cursor-pointer border-b transition-colors '+(selected?.id===msg.id?'bg-blue-50':'hover:bg-gray-50')} style={{borderColor:'#f5f5f5'}}>
              <div className="flex items-center justify-between">
                <span className={'text-sm truncate pr-2 '+(msg.is_read===0?'font-semibold':'')}>{msg.sender_name||msg.recipient_name||'(未知)'}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{fmt(msg.created_at)}</span>
              </div>
              <div className="text-sm mt-0.5 truncate" style={{fontWeight:msg.is_read===0?600:400}}>{msg.subject||'(无主题)'}</div>
              <div className="text-xs text-gray-400 truncate mt-0.5">{stripHtml(msg.body||'').slice(0,60)}</div>
            </div>))}
        </div>
      </div>

      {/* Right Detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? <div className="flex-1 flex items-center justify-center text-gray-400 text-sm"><div className="text-center"><Inbox size={40} className="mx-auto mb-2 opacity-30"/>选择邮件查看</div></div> : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b flex items-center gap-1" style={{borderColor:'#f0f0f0'}}>
              <button onClick={()=>handleStar(selected)} className={'p-1.5 rounded hover:bg-gray-100 '+(selected.is_starred?'text-yellow-500':'text-gray-400')}><Star size={15} fill={selected.is_starred?'currentColor':'none'}/></button>
              <button onClick={()=>handleDelete(selected)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={15}/></button>
              <div className="w-px h-4 bg-gray-200 mx-1"/>
              <button onClick={()=>openCompose('reply',selected)} className="px-3 py-1 text-xs border rounded hover:bg-gray-50"><Reply size={12} className="inline mr-1"/>回复</button>
              <button onClick={()=>openCompose('forward',selected)} className="px-3 py-1 text-xs border rounded hover:bg-gray-50"><Forward size={12} className="inline mr-1"/>转发</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <h2 className="text-base font-semibold mb-3">{selected.subject||'(无主题)'}</h2>
              <div className="flex items-center gap-2 mb-4"><div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-medium">{(selected.sender_name||'?')[0]}</div>
                <div><div className="text-sm font-medium">{selected.sender_name}</div><div className="text-xs text-gray-400">{fmt(selected.created_at)}</div></div></div>
              <div className="text-sm leading-relaxed prose max-w-none" dangerouslySetInnerHTML={{__html:selected.body||''}}/>
              {attachments.length>0&&<div className="mt-4 pt-3 border-t" style={{borderColor:'#f0f0f0'}}><div className="text-xs text-gray-500 mb-2">{attachments.length}个附件</div>
                {attachments.map((a:any)=>(<a key={a.id} href={client.defaults.baseURL+'/messages/attachment/'+a.id} target="_blank" className="flex items-center gap-2 px-3 py-2 border rounded-lg mb-1 text-sm hover:bg-gray-50" style={{borderColor:'#f0f0f0'}}><Download size={14} className="text-gray-400"/>{a.filename}</a>))}</div>}
            </div>
          </div>)}
      </div>
    </div>
  )
}

function ComposeEditor({ mode, folder, setFolder, setSelected, setComposeOpen, to, setTo, subject, setSubject, body, setBody, users, showToPicker, setShowToPicker, folderLabels, counts, onSend, onSaveDraft, openCompose }: any) {
  const folders: Folder[] = ['inbox','sent','drafts','trash']
  return <div className="flex h-[calc(100vh-80px)] bg-white">
    <div className="p-2 border-r" style={{width:180,borderColor:'#f0f0f0'}}>
      <button onClick={()=>{setComposeOpen(false);openCompose('compose')}} className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg mb-3 flex items-center gap-2 justify-center"><Edit2 size={14}/>写邮件</button>
      {folders.map((f:Folder)=>{const c=counts[f]||0;return<div key={f} onClick={()=>{setFolder(f);setSelected(null);setComposeOpen(false)}} className={'flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer mb-0.5 '+(folder===f?'bg-blue-50 text-blue-700 font-medium':'text-gray-600 hover:bg-gray-50')}><span>{folderLabels[f]}</span>{c>0&&<span className="text-xs bg-gray-200 rounded-full px-1.5 min-w-[20px] text-center">{c}</span>}</div>})}
    </div>
    <div className="flex-1 flex flex-col">
      <div className="px-4 py-3 border-b flex items-center gap-3" style={{borderColor:'#f0f0f0'}}>
        <button onClick={()=>setComposeOpen(false)} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft size={16}/></button>
        <span className="font-medium text-sm">{mode==='reply'?'回复':mode==='forward'?'转发':'写邮件'}</span>
      </div>
      <div className="flex-1 flex flex-col p-4 overflow-auto">
        {mode!=='reply'&&<div className="mb-3"><div className="flex items-center gap-2"><span className="text-xs text-gray-500 w-10">收件人</span>
          <div className="flex-1 flex flex-wrap items-center gap-1">
            {to.map((id:number)=>{const u=users.find((x:any)=>x.id===id);return<span key={id} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded flex items-center gap-1">{u?.name||id}<button onClick={()=>setTo(to.filter((x:number)=>x!==id))}><X size={10}/></button></span>})}
            <div className="relative min-w-[80px]"><input className="border-none outline-none text-sm w-full p-1" placeholder="添加收件人..." onFocus={()=>setShowToPicker(true)} onBlur={()=>setTimeout(()=>setShowToPicker(false),200)}/>
              {showToPicker&&<div className="absolute top-full left-0 bg-white border rounded shadow-lg z-20 max-h-40 overflow-auto w-48">{users.filter((u:any)=>!to.includes(u.id)).slice(0,20).map((u:any)=>(<div key={u.id} className="px-3 py-1.5 text-sm hover:bg-blue-50 cursor-pointer" onMouseDown={()=>setTo([...to,u.id])}>{u.name}</div>))}</div>}
            </div>
          </div>
        </div></div>}
        <input value={subject} onChange={(e:any)=>setSubject(e.target.value)} placeholder="主题" className="w-full border-b px-2 py-2 text-sm outline-none mb-3" style={{borderColor:'#f0f0f0'}} disabled={mode==='reply'} />
        <div className="flex-1"><ReactQuill value={body} onChange={setBody} modules={quillModules} theme="snow" style={{height:'calc(100% - 50px)'}}/></div>
        <div className="flex justify-end gap-2 pt-3 border-t mt-2" style={{borderColor:'#f0f0f0'}}>
          <button onClick={onSaveDraft} className="px-4 py-2 border rounded-lg text-sm">存草稿</button>
          <button onClick={onSend} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1.5"><Send size={14}/>发送</button>
        </div>
      </div>
    </div>
  </div>
}

function stripHtml(h: string) { return h.replace(/<[^>]*>/g, '') }
function fmt(t: string) { if(!t)return'';try{const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('zh-CN')}catch{return t} }

