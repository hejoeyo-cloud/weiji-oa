import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { createTicket } from '../api/tickets'
import ImageUpload from '../components/ImageUpload'

const remoteTools = [
  { value: 'netease', label: '网易远程' },
  { value: 'sunlogin', label: '向日葵远程' },
  { value: 'todesk', label: 'ToDesk' },
  { value: 'gotohttp', label: 'GotoHTTP' },
]

export default function TicketCreate() {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    platform: '',
    customer_id: '',
    description: '',
    remote_tool: 'netease',
    remote_code: '',
    verify_code: '',
    priority: 'medium',
    diagnosis_result: '',
    diagnosis_log: [] as any[],
  })
  const [images, setImages] = useState<string[]>([])

  useEffect(() => {
    const state = location.state as any
    if (state) {
      setForm((prev) => ({
        ...prev,
        diagnosis_result: state.diagnosis_result || '',
        diagnosis_log: state.diagnosis_log || [],
      }))
    }
  }, [location.state])

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await createTicket({ ...form, images })
      navigate('/tickets')
    } catch (err) {
      console.error('Failed to create ticket:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">创建工单</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">店铺名字</label>
            <input value={form.platform} onChange={(e) => update('platform', e.target.value)} placeholder="请输入店铺名字" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">客户ID</label>
            <input value={form.customer_id} onChange={(e) => update('customer_id', e.target.value)} placeholder="请输入客户ID" className="input-field" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">问题描述</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="请详细描述客户遇到的问题..."
            rows={4}
            className="input-field resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">问题图片</label>
          <ImageUpload images={images} onChange={setImages} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">远程工具</label>
            <select value={form.remote_tool} onChange={(e) => update('remote_tool', e.target.value)} className="input-field">
              {remoteTools.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">远程码</label>
            <input value={form.remote_code} onChange={(e) => update('remote_code', e.target.value)} placeholder="远程协助码" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">验证码</label>
            <input value={form.verify_code} onChange={(e) => update('verify_code', e.target.value)} placeholder="验证码" className="input-field" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">处理优先级</label>
          <div className="flex gap-4">
            {[
              { value: 'high', label: '高', color: 'border-red-300 bg-red-50 text-red-700' },
              { value: 'medium', label: '中', color: 'border-yellow-300 bg-yellow-50 text-yellow-700' },
              { value: 'low', label: '低', color: 'border-gray-300 bg-gray-50 text-gray-700' },
            ].map((p) => (
              <label key={p.value} className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${form.priority === p.value ? p.color : 'border-transparent bg-gray-50 text-gray-500'}`}>
                <input type="radio" name="priority" value={p.value} checked={form.priority === p.value} onChange={() => update('priority', p.value)} className="sr-only" />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">取消</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '提交中...' : '提交工单'}
          </button>
        </div>
      </form>
    </div>
  )
}
