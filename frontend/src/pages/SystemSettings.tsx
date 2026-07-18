import React, { useState, useEffect, useCallback } from 'react'
import {
  Settings, RefreshCw, Download, CheckCircle, AlertTriangle,
  Clock, Info, ExternalLink,
} from 'lucide-react'
import { getSystemStatus, checkUpdate, applyUpdate, type SystemStatus, type UpdateCheckResult } from '../api/system'
import { useAuth } from '../hooks/useAuth'

type PageState =
  | { step: 'idle' }
  | { step: 'checking' }
  | { step: 'up_to_date'; current: string }
  | { step: 'update_available'; info: UpdateCheckResult }
  | { step: 'installing' }
  | { step: 'error'; message: string }

export default function SystemSettings() {
  const { user, hasPermission } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canUpdate = isAdmin || hasPermission('departments:view')
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [pageState, setPageState] = useState<PageState>({ step: 'idle' })
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    getSystemStatus()
      .then(setStatus)
      .catch(() => setStatus({ version: 'unknown', release_date: '', server_time: '', auto_update_enabled: false, auto_update_interval_hours: 0 }))
  }, [])

  const handleCheckUpdate = useCallback(async () => {
    setChecking(true)
    setPageState({ step: 'checking' })
    try {
      const result = await checkUpdate()
      if (result.has_update) {
        setPageState({ step: 'update_available', info: result })
      } else {
        setPageState({ step: 'up_to_date', current: result.current_version })
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || '检查更新失败'
      setPageState({ step: 'error', message: msg })
    } finally {
      setChecking(false)
    }
  }, [])

  const handleApplyUpdate = useCallback(async () => {
    if (pageState.step !== 'update_available') return
    const { info } = pageState
    setInstalling(true)
    try {
      await applyUpdate(info.download_url, info.sha256)
      setPageState({ step: 'installing' })
      // 轮询：先等服务器挂掉（updater 杀旧进程），再等服务器恢复（新版本启动）
      let retries = 0
      let serverWentDown = false
      const poll = setInterval(() => {
        retries++
        getSystemStatus()
          .then(() => {
            if (serverWentDown) {
              // 服务器恢复，更新完成
              clearInterval(poll)
              window.location.reload()
            }
            // 还没挂，继续等
          })
          .catch(() => {
            // 服务器挂了（或网络错误），说明 updater 已开始工作
            serverWentDown = true
            if (retries > 90) {
              clearInterval(poll)
              setPageState({ step: 'error', message: '更新超时，请手动检查系统是否已启动' })
            }
          })
      }, 2000)
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || '启动更新失败'
      setPageState({ step: 'error', message: msg })
      setInstalling(false)
    }
  }, [pageState])

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* 页头 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
          <Settings size={20} className="text-slate-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: '#1f1f1f' }}>系统设置</h1>
          <p className="text-sm" style={{ color: '#a3a3a3' }}>版本管理与自动更新</p>
        </div>
      </div>

      {/* 系统信息卡片 */}
      <div className="bg-white rounded-xl border p-5 space-y-3" style={{ borderColor: '#f0f0f0' }}>
        <div className="flex items-center gap-2">
          <Info size={16} className="text-slate-500" />
          <span className="text-sm font-medium" style={{ color: '#737373' }}>系统信息</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span style={{ color: '#a3a3a3' }}>当前版本</span>
            <p className="font-mono font-semibold mt-0.5" style={{ color: '#1f1f1f' }}>
              v{status?.version || '...'}
            </p>
          </div>
          <div>
            <span style={{ color: '#a3a3a3' }}>发布日期</span>
            <p className="mt-0.5" style={{ color: '#737373' }}>
              {status?.release_date || '...'}
            </p>
          </div>
          <div>
            <span style={{ color: '#a3a3a3' }}>服务器时间</span>
            <p className="mt-0.5" style={{ color: '#737373' }}>
              {status?.server_time ? new Date(status.server_time).toLocaleString('zh-CN') : '...'}
            </p>
          </div>
          <div>
            <span style={{ color: '#a3a3a3' }}>更新源</span>
            <p className="mt-0.5" style={{ color: '#737373' }}>
              国内+国外源（自动选择可用源）
            </p>
          </div>
          <div>
            <span style={{ color: '#a3a3a3' }}>自动更新</span>
            <p className="mt-0.5" style={{ color: '#737373' }}>
              {status?.auto_update_enabled
                ? `每 ${status.auto_update_interval_hours} 小时自动检测并更新`
                : '未启用'}
            </p>
          </div>
        </div>
      </div>

      {/* 更新操作区 */}
      <div className="bg-white rounded-xl border p-5 space-y-4" style={{ borderColor: '#f0f0f0' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className={`text-slate-500 ${checking ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium" style={{ color: '#737373' }}>版本更新</span>
          </div>

          {/* 状态标签 */}
          {pageState.step === 'up_to_date' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: '#dcfce7', color: '#16a34a' }}>
              <CheckCircle size={12} /> 已是最新
            </div>
          )}
          {pageState.step === 'update_available' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: '#fef3c7', color: '#d97706' }}>
              <AlertTriangle size={12} /> 有新版本
            </div>
          )}
          {pageState.step === 'installing' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: '#dbeafe', color: '#2563eb' }}>
              <RefreshCw size={12} className="animate-spin" /> 更新中
            </div>
          )}
        </div>

        {/* idle / checking */}
        {(pageState.step === 'idle' || pageState.step === 'checking') && (
          <div>
            <button
              onClick={handleCheckUpdate}
              disabled={checking || !canUpdate}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#404040', color: 'white' }}
              onMouseEnter={e => { if (!checking && canUpdate) e.currentTarget.style.background = '#262626' }}
              onMouseLeave={e => { if (!checking && canUpdate) e.currentTarget.style.background = '#404040' }}
            >
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              {checking ? '正在检查...' : '检查更新'}
            </button>
            {!canUpdate && (
              <p className="text-xs mt-2" style={{ color: '#a3a3a3' }}>仅管理员或部门管理者可执行更新操作</p>
            )}
          </div>
        )}

        {/* up_to_date */}
        {pageState.step === 'up_to_date' && (
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: '#fafaf9' }}>
            <CheckCircle size={16} style={{ color: '#16a34a' }} />
            <span className="text-sm" style={{ color: '#737373' }}>
              当前版本 <span className="font-mono font-semibold" style={{ color: '#1f1f1f' }}>v{pageState.current}</span> 已是最新版本
            </span>
          </div>
        )}

        {/* update_available */}
        {pageState.step === 'update_available' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg space-y-3" style={{ background: '#fafaf9' }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm" style={{ color: '#737373' }}>可升级至</span>
                  <span className="ml-2 font-mono font-semibold text-lg" style={{ color: '#1f1f1f' }}>
                    v{pageState.info.latest_version}
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#e5e5e5', color: '#737373' }}>
                  来源: {pageState.info.source}
                </span>
              </div>
              <div>
                <span className="text-xs" style={{ color: '#a3a3a3' }}>发布日期: {pageState.info.release_date}</span>
              </div>
              {pageState.info.changelog && (
                <div>
                  <span className="text-xs font-medium" style={{ color: '#737373' }}>更新内容：</span>
                  <pre className="mt-1 text-sm whitespace-pre-wrap" style={{ color: '#525252', fontFamily: 'inherit' }}>
                    {pageState.info.changelog}
                  </pre>
                </div>
              )}
            </div>
            {canUpdate && (
              <button
                onClick={handleApplyUpdate}
                disabled={installing}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ background: '#2563eb', color: 'white' }}
                onMouseEnter={e => { if (!installing) e.currentTarget.style.background = '#1d4ed8' }}
                onMouseLeave={e => { if (!installing) e.currentTarget.style.background = '#2563eb' }}
              >
                <Download size={14} />
                {installing ? '正在准备更新...' : '立即更新'}
              </button>
            )}
          </div>
        )}

        {/* installing */}
        {pageState.step === 'installing' && (
          <div className="p-4 rounded-lg space-y-3" style={{ background: '#eff6ff' }}>
            <div className="flex items-center gap-2">
              <RefreshCw size={16} className="animate-spin" style={{ color: '#2563eb' }} />
              <span className="text-sm font-medium" style={{ color: '#1e40af' }}>系统正在更新...</span>
            </div>
            <p className="text-sm" style={{ color: '#3b82f6' }}>
              正在下载并安装新版本，系统将在数秒后自动重启。页面会自动刷新，请稍候。
            </p>
          </div>
        )}

        {/* error */}
        {pageState.step === 'error' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: '#fef2f2' }}>
              <AlertTriangle size={16} style={{ color: '#dc2626' }} />
              <span className="text-sm" style={{ color: '#991b1b' }}>{pageState.message}</span>
            </div>
            <button
              onClick={handleCheckUpdate}
              disabled={checking}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ background: '#404040', color: 'white' }}
              onMouseEnter={e => e.currentTarget.style.background = '#262626'}
              onMouseLeave={e => e.currentTarget.style.background = '#404040'}
            >
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              重试
            </button>
          </div>
        )}
      </div>

      {/* 说明 */}
      <div className="bg-white rounded-xl border p-5 space-y-2" style={{ borderColor: '#f0f0f0' }}>
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-slate-500" />
          <span className="text-sm font-medium" style={{ color: '#737373' }}>关于自动更新</span>
        </div>
        <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: '#a3a3a3' }}>
          <li>更新前系统会自动备份当前版本，出问题可手动回滚</li>
          <li>更新过程中系统会短暂不可用（约 10-20 秒）</li>
          <li>更新不会影响数据库、上传文件、授权文件等数据</li>
        </ul>
      </div>
    </div>
  )
}
