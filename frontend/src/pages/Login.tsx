import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, Eye, EyeOff } from 'lucide-react'
import { login, register } from '../api/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || (mode === 'register' && (!companyName || !name))) return
    setLoading(true)
    setError('')
    try {
      const res = mode === 'login'
        ? await login(email, password)
        : await register({ company_name: companyName, email, password, name })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || (mode === 'login' ? '登录失败，请检查邮箱密码' : '注册失败，请检查填写信息'))
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
            Fries OA
          </h1>
          <p className="text-sm mt-2 tracking-wide" style={{ color: '#a3a3a3' }}>智能内部管理系统</p>
        </div>

        <div className="bg-white rounded-2xl p-8 relative"
          style={{ boxShadow: '0 2px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}>
          <div className="text-center mb-8">
            <h2 className="text-lg font-semibold" style={{ color: '#1f1f1f' }}>{mode === 'login' ? '欢迎登录' : '注册公司账号'}</h2>
            <p className="text-sm mt-1" style={{ color: '#a3a3a3' }}>{mode === 'login' ? '请输入您的邮箱和密码' : '新公司可免费试用 1 个月'}</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm"
              style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#404040' }}>公司名称</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="请输入公司名称"
                    className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none"
                    style={{ background: '#fafaf9', border: '1.5px solid #e5e5e5', color: '#1f1f1f' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#404040' }}>姓名</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="请输入您的姓名"
                    className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none"
                    style={{ background: '#fafaf9', border: '1.5px solid #e5e5e5', color: '#1f1f1f' }}
                  />
                </div>
              </>
            )}
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

            <button
              type="submit"
              disabled={loading || !email || !password || (mode === 'register' && (!companyName || !name))}
              className="w-full rounded-xl py-3.5 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#404040', color: 'white' }}
            >
              {loading ? (mode === 'login' ? '登录中...' : '注册中...') : (mode === 'login' ? '登录' : '注册并开始试用')}
            </button>
          </form>
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            className="w-full mt-5 text-sm transition-colors"
            style={{ color: '#737373' }}
          >
            {mode === 'login' ? '没有账号？注册新公司' : '已有账号？返回登录'}
          </button>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs tracking-wider" style={{ color: '#d4d4d4' }}>
            FRIES INTERNAL SYSTEM v2.0
          </p>
        </div>
      </div>
    </div>
  )
}
