/**
 * MessagesPage — Gmail-style inbox with react-mail-inbox compose
 */
import { useEffect, useState, useCallback } from 'react'
import GmailInbox from 'react-mail-inbox'
import 'react-mail-inbox/dist/index.css'
import { Edit2, Star, Trash2, Search, Reply, Forward, Download, Inbox, Send, FileText, RefreshCw } from 'lucide-react'
import { getInbox, getSent, getDrafts, getTrash, getCounts, sendMessage, saveDraft, markRead,
         toggleStar, softDelete, permanentDelete, replyMessage, forwardMessage, getAttachments } from '../api/messages'
import { getUsers } from '../api/users'
import client from '../api/client'

type Folder = 'inbox' | 'sent' | 'drafts' | 'trash'
type Mode = 'view' | 'compose' | 'reply' | 'forward'

const folderIcons: Record<Folder, any> = { inbox: Inbox, sent: Send, drafts: FileText, trash: Trash2 }
const folderLabels: Record<Folder, string> = { inbox: '收件箱', sent: '已发送', drafts: '草稿', trash: '回收站' }

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
  const loadUsers = async () => { try { const u = (await getUsers()).data || (await getUsers()) || []; setUsers(u.map((x:any)=>({name:x.name||'',email:x.email||(x.name||'')+'@oa.local',id:x.id}))) } catch {} }

  const selectMessage = async (msg: any) => {
    setSelected(msg); setMode('view')
    if (msg.is_read===0||msg.is_read===false) try { await markRead(msg.id); loadFolder(folder) } catch {}
    try { setAttachments(await getAttachments(msg.id)) } catch { setAttachments([]) }
  }

  const handleSend = async (emailData: any) => {
    const toIds = emailData.to?.map((u:any)=>u.id).filter(Boolean) || []
    try {
      if (mode==='compose') { await sendMessage({ to_ids:toIds, subject:emailData.subject||'', body:emailData.body||'', draft:false }); notify('邮件已发送', emailData.subject||'(无主题)') }
      else if (mode==='reply'&&selected) { await replyMessage(selected.id, { body:emailData.body||'', to_ids:toIds }); notify('回复已发送', 'Re: '+selected.subject) }
      else if (mode==='forward'&&selected) { await forwardMessage(selected.id, { body:emailData.body||'', to_ids:toIds }); notify('转发已发送', 'Fwd: '+selected.subject) }
      setMode('view'); setSelected(null); loadFolder('sent'); loadFolder('inbox')
    } catch (e:any) { alert(e?.response?.data?.detail||'发送失败') }
  }

  const handleStar = async (m:any) => { try { await toggleStar(m.id); loadFolder(folder) } catch {} }
  const handleDelete = async (m:any) => {
    if (folder==='trash') { if(!confirm('永久删除？'))return; try{await permanentDelete(m.id);loadFolder('trash');setSelected(null)}catch{} }
    else { try{await softDelete(m.id);loadFolder(folder);setSelected(null)}catch{} }
  }

  const fetchEmailOptions = async (q: string) => {
    const list = users.length > 0 ? users : await getUsers().then(r => (r.data||r||[])).then(u => u.map((x:any)=>({name:x.name||'',email:x.email||(x.name||'')+'@oa.local',id:x.id})))
    if (!q) return list.slice(0,20)
    const lower = q.toLowerCase()
    return list.filter((u:any)=>u.name.toLowerCase().includes(lower)||(u.email||'').toLowerCase().includes(lower)).slice(0,20)
  }

  const folders: Folder[] = ['inbox','sent','drafts','trash']
  const filtered = messages.filter((m:any)=>!search||(m.subject||'').includes(search)||(m.sender_name||'').includes(search))

  // Compose/reply/forward view
  if (mode !== 'view') {
    const isReply = mode === 'reply'
    const isForward = mode === 'forward'
    return (
      <div className="flex h-[calc(100vh-80px)] bg-white border rounded-lg overflow-hidden" style={{borderColor:'#e5e7eb'}}>
        <div className="p-2 flex-shrink-0 border-r flex flex-col" style={{width:180, borderColor:'#e5e7eb'}}>
          <button onClick={()=>{setMode('compose');setSelected(null)}}
            className="w-full px-3 py-2.5 bg-blue-600 text-white text-sm rounded-lg mb-3 flex items-center gap-2 justify-center hover:bg-blue-700 transition-colors">
            <Edit2 size={15}/>写邮件</button>
          {folders.map(f => { const c = counts[f]||0; const Icon = folderIcons[f]; return (
            <div key={f} onClick={()=>{setFolder(f);setSelected(null);setMode('view')}}
              className={'flex items-center justify-between px-3 py-2.5 text-sm rounded-lg cursor-pointer mb-0.5 transition-colors '+
                (folder===f?'bg-blue-50 text-blue-700 font-medium':'text-gray-600 hover:bg-gray-50')}>
              <span className="flex items-center gap-2"><Icon size={15}/>{folderLabels[f]}</span>
              {c>0&&<span className="text-xs bg-gray-200 rounded-full px-1.5 min-w-[20px] text-center">{c}</span>}
            </div>)})}
        </div>
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2.5 border-b flex items-center gap-3" style={{borderColor:'#e5e7eb'}}>
            <button onClick={()=>{setMode('view');setSelected(null)}} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            <span className="font-medium text-sm">{isReply?'回复':isForward?'转发':'写邮件'}</span>
          </div>
          <div className="flex-1 overflow-hidden" style={{height:'calc(100vh - 130px)'}}>
            <GmailInbox
              fetchEmailOptions={fetchEmailOptions}
              handleChange={handleSend}
              initialData={isReply&&selected ? {to:[{name:selected.sender_name||'',email:''}],subject:selected.subject||''} : isForward&&selected ? {subject:selected.subject||'',body:selected.body||''} : {}}
              initialTheme="light"
              isReply={isReply}
              showOnlyBody={isForward}
              placeholder="撰写邮件内容..."
              minHeight="100%"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-80px)] bg-white border rounded-lg overflow-hidden" style={{borderColor:'#e5e7eb'}}>
      {/* Left: Folder Nav */}
      <div className="p-2 flex-shrink-0 border-r flex flex-col" style={{width:180, borderColor:'#e5e7eb'}}>
        <button onClick={()=>{setMode('compose');setSelected(null)}}
          className="w-full px-3 py-2.5 bg-blue-600 text-white text-sm rounded-lg mb-3 flex items-center gap-2 justify-center hover:bg-blue-700 transition-colors">
          <Edit2 size={15}/>写邮件</button>
        {folders.map(f => { const c = counts[f]||0; const Icon = folderIcons[f]; return (
          <div key={f} onClick={()=>{setFolder(f);setSelected(null);setMode('view')}}
            className={'flex items-center justify-between px-3 py-2.5 text-sm rounded-lg cursor-pointer mb-0.5 transition-colors '+
              (folder===f?'bg-blue-50 text-blue-700 font-medium':'text-gray-600 hover:bg-gray-50')}>
            <span className="flex items-center gap-2"><Icon size={15}/>{folderLabels[f]}</span>
            {c>0&&<span className="text-xs bg-gray-200 rounded-full px-1.5 min-w-[20px] text-center">{c}</span>}
          </div>)})}
      </div>

      {/* Center: Message List */}
      <div className="flex flex-col border-r" style={{width:360, borderColor:'#e5e7eb'}}>
        <div className="p-2 border-b flex items-center gap-2" style={{borderColor:'#e5e7eb'}}>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索邮件..."
              className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400 transition-colors" style={{borderColor:'#d1d5db'}}/>
          </div>
          <button onClick={()=>loadFolder(folder)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><RefreshCw size={14}/></button>
        </div>
        <div className="flex-1 overflow-auto">
          {loading && <div className="text-center py-12 text-gray-400 text-sm">加载中...</div>}
          {!loading && filtered.length===0 && <div className="text-center py-16 text-gray-400 text-sm">{folder==='inbox'?'收件箱为空':'暂无邮件'}</div>}
          {filtered.map((msg:any)=>(
            <div key={msg.id} onClick={()=>selectMessage(msg)}
              className={'px-3 py-3 cursor-pointer border-b transition-colors '+(selected?.id===msg.id?'bg-blue-50':'hover:bg-gray-50')}
              style={{borderColor:'#f3f4f6'}}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={'text-sm truncate pr-2 '+(msg.is_read===0?'font-semibold text-gray-900':'text-gray-700')}>
                  {msg.sender_name||msg.recipient_name||'(未知)'}</span>
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
              <button onClick={()=>handleStar(selected)} className={'p-1.5 rounded hover:bg-gray-100 '+(selected.is_starred?'text-yellow-500':'text-gray-400')}>
                <Star size={15} fill={selected.is_starred?'currentColor':'none'}/></button>
              <button onClick={()=>handleDelete(selected)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={15}/></button>
              <div className="w-px h-4 bg-gray-200 mx-1"/>
              <button onClick={()=>setMode('reply')} className="px-3 py-1 text-xs border rounded hover:bg-gray-50"><Reply size={12} className="inline mr-1"/>回复</button>
              <button onClick={()=>setMode('forward')} className="px-3 py-1 text-xs border rounded hover:bg-gray-50"><Forward size={12} className="inline mr-1"/>转发</button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <h2 className="text-lg font-semibold mb-4">{selected.subject||'(无主题)'}</h2>
              <div className="flex items-center gap-3 mb-4 pb-4 border-b" style={{borderColor:'#f3f4f6'}}>
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">{(selected.sender_name||'?')[0]}</div>
                <div className="flex-1"><div className="text-sm font-medium">{selected.sender_name}</div><div className="text-xs text-gray-400">{fmt(selected.created_at)}</div></div>
              </div>
              <div className="text-sm leading-relaxed prose max-w-none" dangerouslySetInnerHTML={{__html:selected.body||''}}/>
              {attachments.length>0&&<div className="mt-5 pt-4 border-t" style={{borderColor:'#f3f4f6'}}>
                <div className="text-xs text-gray-500 mb-2">{attachments.length}个附件</div>
                {attachments.map((a:any)=>(<a key={a.id} href={client.defaults.baseURL+'/messages/attachment/'+a.id} target="_blank" className="flex items-center gap-2 px-3 py-2 border rounded-lg mb-1.5 text-sm hover:bg-gray-50 transition-colors" style={{borderColor:'#e5e7eb'}}><Download size={14} className="text-gray-400"/>{a.filename}</a>))}</div>}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center"><Inbox size={48} className="mx-auto mb-3 opacity-20"/><div className="text-sm">选择一封邮件查看</div></div>
          </div>
        )}
      </div>
    </div>
  )
}

function stripHtml(h: string) { return h.replace(/<[^>]*>/g, '') }
function fmt(t: string) { if(!t)return'';try{const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('zh-CN')}catch{return t} }

