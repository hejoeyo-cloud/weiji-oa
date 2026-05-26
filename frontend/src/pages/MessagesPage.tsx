/**
 * MessagesPage — Gmail-style three-panel email client
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { Edit2, Star, Trash2, Search, Reply, Forward, Download, Inbox, Send, FileText, RefreshCw, X, ChevronDown, ChevronRight, Users } from 'lucide-react'
import { getInbox, getSent, getDrafts, getTrash, getCounts, sendMessage, markRead,
         toggleStar, softDelete, permanentDelete, replyMessage, forwardMessage, getAttachments } from '../api/messages'
import { getUsers } from '../api/users'
import client from '../api/client'

type Folder = 'inbox' | 'sent' | 'drafts' | 'trash'
type Mode = 'view' | 'compose' | 'reply' | 'forward'
type User = { id: number; name: string; department?: string; job_title?: string; email?: string }

const folderIcons: Record<Folder, any> = { inbox: Inbox, sent: Send, drafts: FileText, trash: Trash2 }
const folderLabels: Record<Folder, string> = { inbox: '收件箱', sent: '已发送', drafts: '草稿', trash: '回收站' }
const modules = { toolbar: [['bold','italic','underline'],[{list:'ordered'},{list:'bullet'}],['blockquote'],['link'],['clean']] }

export default function MessagesPage() {
  const [folder, setFolder] = useState<Folder>('inbox')
  const [messages, setMessages] = useState<any[]>([])
  const [counts, setCounts] = useState<Record<string,number>>({})
  const [selected, setSelected] = useState<any | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('view')
  const [attachments, setAttachments] = useState<any[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [to, setTo] = useState<User[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [term, setTerm] = useState('')
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

  const selectMessage = async (msg: any) => { setSelected(msg); setMode('view')
    if (msg.is_read===0) try { await markRead(msg.id); loadFolder(folder) } catch {}
    try { setAttachments(await getAttachments(msg.id)) } catch { setAttachments([]) }
  }

  const openCompose = (m: Mode = 'compose', msg?: any) => { setMode(m); setSubject(''); setBody(''); setTo([])
    if (msg) { if (m==='reply') { setTo([{id:msg.sender_id,name:msg.sender_name,department:''}])
      setSubject('Re: '+(msg.subject||'')) }
      if (m==='forward') { setSubject('Fwd: '+(msg.subject||'')); setBody(msg.content||'') } }
  }

  const handleSend = async () => {
    const rid = to[0]?.id; if (!rid) { alert('请选择收件人'); return }
    setSending(true)
    try { if (mode==='compose') { await sendMessage({ recipient_id:rid, subject, content:body, draft:false }); notify('邮件已发送', subject||'') }
      else if (mode==='reply'&&selected) { await replyMessage(selected.id, { recipient_id:rid, subject, content:body }) }
      else if (mode==='forward'&&selected) { await forwardMessage(selected.id, { recipient_id:rid, subject, content:body }) }
      setMode('view'); setSelected(null); loadFolder('sent') } catch (e:any) { alert(typeof e?.response?.data?.detail==='string'?e.response.data.detail:'发送失败') }
    finally { setSending(false) }
  }

  const handleStar = async (m:any) => { try { await toggleStar(m.id); loadFolder(folder) } catch {} }
  const handleDelete = async (m:any) => {
    if (folder==='trash') { if(!confirm('永久删除？'))return; try{await permanentDelete(m.id);loadFolder('trash');setSelected(null)}catch{} }
    else { try{await softDelete(m.id);loadFolder(folder);setSelected(null)}catch{} }
  }

  // Department grouping for picker
  const departments: Record<string, User[]> = {}
  users.forEach(u => { const d = u.department || '其他'; if(!departments[d]) departments[d] = []; departments[d].push(u) })

  const filtered: any[] = messages.filter((m:any)=>!search||(m.subject||'').includes(search)||(m.sender_name||'').includes(search))
  const folders: Folder[] = ['inbox','sent','drafts','trash']

  return (
    <div className="flex h-[calc(100vh-80px)] bg-white border rounded-lg overflow-hidden" style={{borderColor:'#e5e7eb'}}>
      {/* Left Nav */}
      <div className="p-2 flex-shrink-0 border-r flex flex-col" style={{width:180, borderColor:'#e5e7eb'}}>
        <button onClick={()=>openCompose('compose')} className="w-full px-3 py-2.5 bg-blue-600 text-white text-sm rounded-lg mb-3 flex items-center gap-2 justify-center hover:bg-blue-700">
          <Edit2 size={15}/>写邮件</button>
        {folders.map(f => { const c = counts[f]||0; const I = folderIcons[f]; return (
          <div key={f} onClick={()=>{setFolder(f);setSelected(null);setMode('view')}} className={'flex items-center justify-between px-3 py-2.5 text-sm rounded-lg cursor-pointer mb-0.5 '+(folder===f?'bg-blue-50 text-blue-700 font-medium':'text-gray-600 hover:bg-gray-50')}>
            <span className="flex items-center gap-2"><I size={15}/>{folderLabels[f]}</span>
            {c>0&&<span className="text-xs bg-gray-200 rounded-full px-1.5 min-w-[20px] text-center">{c}</span>}
          </div>)})}
      </div>

      {mode !== 'view' ? (
        /* Compose */
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
            {mode !== 'reply' && <div className="mb-3">
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-500 w-12 pt-1.5">收件人</span>
                <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[32px] border rounded-lg px-2 py-1" style={{borderColor:'#d1d5db'}}>
                  {to.map((u:any)=>(<span key={u.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded flex items-center gap-1">
                    {u.name}<button onClick={()=>setTo([])} className="hover:text-red-500"><X size={10}/></button></span>))}
                  {to.length===0 && <span className="text-xs text-gray-400 px-1">未选择</span>}
                  <button onClick={()=>setShowPicker(!showPicker)} className="ml-auto px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-1 flex-shrink-0">
                    <Users size={11}/> 选择收件人</button>
                </div>
              </div>
            </div>}

            {/* Department picker */}
            {showPicker && <div className="mb-3 ml-14 bg-white border rounded-lg shadow-lg z-20" style={{borderColor:'#e5e7eb'}}>
              <div className="p-2 border-b" style={{borderColor:'#f0f0f0'}}>
                <div className="relative"><Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input className="w-full pl-6 pr-2 py-1.5 text-xs border rounded-md outline-none focus:border-blue-400" style={{borderColor:'#d1d5db'}}
                    placeholder="输入姓名搜索..." value={term} onChange={e=>setTerm(e.target.value)} autoFocus />
                </div>
              </div>
              <DeptTree depts={departments} term={term} onPick={(u:User)=>{setTo([u]);setShowPicker(false);setTerm('')}} to={to} />
            </div>}

            <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="主题" className="w-full border-0 border-b px-2 py-2 text-sm outline-none mb-3" style={{borderColor:'#e5e7eb',borderBottomWidth:1}} />
            <div className="flex-1 min-h-[250px]">
              <ReactQuill ref={quillRef} value={body} onChange={setBody} modules={modules} theme="snow" style={{height:'calc(100% - 42px)'}} placeholder="撰写邮件内容..." />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Center List */}
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
              {filtered.map((msg:any)=>(<div key={msg.id} onClick={()=>selectMessage(msg)} className={'px-3 py-3 cursor-pointer border-b '+(selected?.id===msg.id?'bg-blue-50':'hover:bg-gray-50')} style={{borderColor:'#f3f4f6'}}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={'text-sm truncate pr-2 '+(msg.is_read===0?'font-semibold text-gray-900':'text-gray-700')}>{msg.sender_name||msg.recipient_name||'?'}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{fmt(msg.created_at)}</span></div>
                <div className="text-sm truncate" style={{fontWeight:msg.is_read===0?600:400}}>{msg.subject||'(无主题)'}</div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{strip(msg.content||'').slice(0,60)}</div>
              </div>))}
            </div>
          </div>

          {/* Right Detail */}
          <div className="flex-1 flex flex-col min-w-0">
            {selected ? (<div className="flex-1 flex flex-col overflow-hidden">
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
                <div className="text-sm leading-relaxed prose max-w-none" dangerouslySetInnerHTML={{__html:selected.content||''}}/>
                {attachments.length>0 && <div className="mt-5 pt-4 border-t" style={{borderColor:'#f3f4f6'}}>
                  <div className="text-xs text-gray-500 mb-2">{attachments.length}个附件</div>
                  {attachments.map((a:any)=>(<a key={a.id} href={client.defaults.baseURL+'/messages/attachment/'+a.id} target="_blank" className="flex items-center gap-2 px-3 py-2 border rounded-lg mb-1.5 text-sm hover:bg-gray-50" style={{borderColor:'#e5e7eb'}}><Download size={14} className="text-gray-400"/>{a.filename}</a>))}</div>}
              </div>
            </div>) : (
              <div className="flex-1 flex items-center justify-center text-gray-400"><div className="text-center"><Inbox size={48} className="mx-auto mb-3 opacity-20"/><div className="text-sm">选择一封邮件查看</div></div></div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* Department tree picker */
function DeptTree({ depts, term, onPick, to }: { depts: Record<string, User[]>; term: string; onPick: (u: User) => void; to: User[] }) {
  const [expanded, setExpanded] = useState<Record<string,boolean>>({})
  const lower = term.toLowerCase()
  const filtered: Record<string, User[]> = {}
  Object.entries(depts).forEach(([d, us]) => {
    const matched = us.filter(u => !term || u.name.toLowerCase().includes(lower) || (u.department||'').toLowerCase().includes(lower))
    if (matched.length) filtered[d] = matched
  })
  return <div className="max-h-64 overflow-auto p-1">
    {Object.keys(filtered).length===0 && <div className="px-3 py-4 text-sm text-gray-400 text-center">无匹配员工</div>}
    {Object.entries(filtered).map(([dept, us]) => {
      const open = expanded[dept] !== false
      return <div key={dept}>
        <div onClick={()=>setExpanded(p=>({...p,[dept]:!open}))} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded cursor-pointer flex items-center gap-1">
          {open ? <ChevronDown size={12}/> : <ChevronRight size={12}/>} {dept} ({us.length})
        </div>
        {open && us.map(u => (<div key={u.id} onClick={()=>onPick(u)} className="px-8 py-1.5 text-sm hover:bg-blue-50 cursor-pointer rounded">{u.name}<span className="text-xs text-gray-400 ml-1">{u.job_title||''}</span></div>))}
      </div>
    })}
  </div>
}

function strip(h: string) { return (h||'').replace(/<[^>]*>/g, '') }
function fmt(t: string) { if(!t)return'';try{const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('zh-CN')}catch{return t} }

