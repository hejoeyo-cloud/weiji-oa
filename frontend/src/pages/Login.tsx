import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, Eye, EyeOff } from 'lucide-react'
import { login } from '../api/auth'

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem('remembered_email') || '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => !!localStorage.getItem('remembered_email'))
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      const res = await login(email, password, remember)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      if (remember) {
        localStorage.setItem('remembered_email', email)
      } else {
        localStorage.removeItem('remembered_email')
      }
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || '登录失败，请检查邮箱密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#fafaf9' }}>
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle at 30% 30%, #f5f5f4 0%, #fafaf9 100%)' }} />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full opacity-50"
        style={{ background: 'radial-gradient(circle at 70% 70%, #f5f5f4 0%, transparent 70%)' }} />

      <div className="relative z-10 w-full max-w-[400px] px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: '#404040', boxShadow: '0 8px 32px rgba(64,64,64,0.15)' }}>
              <Store className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1f1f1f' }}>
            微迹OA
          </h1>
          <p className="text-sm mt-2 tracking-wide" style={{ color: '#a3a3a3' }}>数字化内部管理系统</p>
        </div>

        <div className="bg-white rounded-2xl p-8 relative"
          style={{ boxShadow: '0 2px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}>
          <div className="text-center mb-8">
            <h2 className="text-lg font-semibold" style={{ color: '#1f1f1f' }}>欢迎登录</h2>
            <p className="text-sm mt-1" style={{ color: '#a3a3a3' }}>请输入您的邮箱和密码</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm"
              style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#404040' }}>邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none"
                style={{ background: '#fafaf9', border: '1.5px solid #e5e5e5', color: '#1f1f1f' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#404040' }}>密码</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-4 py-3.5 pr-12 rounded-xl text-sm focus:outline-none"
                  style={{ background: '#fafaf9', border: '1.5px solid #e5e5e5', color: '#1f1f1f' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: '#a3a3a3' }}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded accent-[#404040]"
              />
              <span className="text-sm" style={{ color: '#737373' }}>记住我</span>
            </label>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full rounded-xl py-3.5 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#404040', color: 'white' }}
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs tracking-wider" style={{ color: '#d4d4d4' }}>
            微迹 OA INTERNAL SYSTEM v1.0
          </p>
        </div>
      </div>
    </div>
  )
}
