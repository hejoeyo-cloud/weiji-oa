import { useState, useEffect } from 'react'
import { updateUser } from '../api/users'
import { useAuth } from '../hooks/useAuth'

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // user 异步加载完成后同步到 state
  useEffect(() => {
    if (user) {
      setUsername(user.username || '')
      setName(user.name || '')
    }
  }, [user])

  const handleSave = async () => {
    if (!name.trim()) { setError('姓名不能为空'); return }
    setError('')
    setSaving(true)
    try {
      const payload: any = {
        name: name.trim(),
      }
      if (password) payload.password = password
      const res = await updateUser(user!.id, payload)
      const updatedData = res.data
      const updatedUser = { ...user!, username: updatedData.username, name: updatedData.name }
      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))
      setMsg('保存成功')
      setPassword('')
      setTimeout(() => setMsg(''), 2500)
    } catch (e: any) {
      setError(e.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
              {user?.name?.[0] || '?'}
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800">{user?.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{user?.email || ''}</p>
              <p className="text-xs text-gray-400">@{user?.username}</p>
            </div>
          </div>
        </div>

        {/* 表单 */}
        <div className="p-6 space-y-5">
          {msg && (
            <div className="px-4 py-2.5 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100">
              ✓ {msg}
            </div>
          )}
          {error && (
            <div className="px-4 py-2.5 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">登录账号</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              value={username}
              readOnly
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">显示姓名</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="输入姓名"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">新密码</label>
            <input
              type="password"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="留空则不修改密码"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60 mt-2"
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  )
}
