import { useEffect, useState } from 'react'
import { Save, RefreshCw, ExternalLink } from 'lucide-react'
import { getDingtalkConfig, saveDingtalkConfig, syncDingtalk } from '../api/dingtalk'
import type { DingtalkConfig } from '../types'

export default function DingtalkConfigPage() {
  const [config, setConfig] = useState<DingtalkConfig | null>(null)
  const [appKey, setAppKey] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState('')
  const [syncResult, setSyncResult] = useState('')

  const load = async () => {
    try {
      const data = await getDingtalkConfig()
      setConfig(data)
      if (data) {
        setAppKey(data.app_key || '')
        setEnabled(data.enabled)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    try {
      await saveDingtalkConfig({
        app_key: appKey,
        app_secret: appSecret || undefined,
        enabled,
      })
      setMsg('保存成功')
      setAppSecret('')
      load()
    } catch (err: any) {
      setMsg(err.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult('')
    try {
      const res = await syncDingtalk()
      setSyncResult(`同步完成：新增 ${res.synced} 条，跳过 ${res.skipped} 条`)
    } catch (err: any) {
      setSyncResult(err.response?.data?.detail || '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h2 className="text-xl font-semibold text-gray-800">钉钉考勤配置</h2>

      {/* 说明卡片 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm space-y-3" style={{ color: '#1e40af' }}>
        <p className="font-semibold text-base">如何获取钉钉 AppKey 和 AppSecret</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            打开
            <a href="https://open-dev.dingtalk.com" target="_blank" rel="noreferrer"
              className="mx-1 underline inline-flex items-center gap-0.5">
              钉钉开放平台 <ExternalLink size={12} />
            </a>
            ，用公司钉钉管理员账号登录
          </li>
          <li>点击「应用开发」→「企业内部应用」→「创建应用」</li>
          <li>填写应用名称（如「Fries OA考勤同步」），选择「小程序+H5微应用」</li>
          <li>创建完成后，在「凭证与基础信息」页面找到 <b>AppKey</b> 和 <b>AppSecret</b></li>
          <li>在「权限管理」中搜索并申请以下权限：
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li>企业员工手机号信息</li>
              <li>考勤组管理</li>
              <li>考勤打卡记录</li>
            </ul>
          </li>
          <li>将 AppKey 和 AppSecret 填入下方，点击保存</li>
          <li>员工在「个人中心」绑定自己的钉钉用户ID</li>
        </ol>
        <p className="text-xs opacity-75 mt-2">
          * 钉钉用户ID获取方式：钉钉管理后台 → 通讯录 → 点击员工 → 员工详情页的 UserID 字段
        </p>
      </div>

      {/* 配置表单 */}
      <div className="bg-white border rounded-xl p-5 space-y-4" style={{ borderColor: '#f0f0f0' }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">启用钉钉考勤同步</span>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">AppKey</label>
          <input
            value={appKey}
            onChange={e => setAppKey(e.target.value)}
            placeholder="粘贴 AppKey"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            AppSecret {config?.app_secret_masked && <span className="text-gray-400 ml-1">(当前: {config.app_secret_masked})</span>}
          </label>
          <input
            type="password"
            value={appSecret}
            onChange={e => setAppSecret(e.target.value)}
            placeholder="粘贴 AppSecret（留空则不修改）"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? '保存中...' : '保存配置'}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || !enabled}
            className="px-5 py-2 border text-sm rounded-lg flex items-center gap-2 disabled:opacity-50"
            style={{ borderColor: '#e5e5e5', color: '#404040' }}
          >
            <RefreshCw size={14} /> {syncing ? '同步中...' : '手动同步'}
          </button>
        </div>

        {msg && <p className="text-sm text-green-600">{msg}</p>}
        {syncResult && <p className="text-sm text-gray-600">{syncResult}</p>}
        {config?.last_sync_at && (
          <p className="text-xs text-gray-400">上次同步: {new Date(config.last_sync_at).toLocaleString('zh-CN')}</p>
        )}
      </div>
    </div>
  )
}
