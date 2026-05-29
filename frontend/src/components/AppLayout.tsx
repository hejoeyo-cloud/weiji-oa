import React, { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Ticket, FilePlus, Users, BookOpen,
  Bell, LogOut, Menu, ClipboardList, Gift, DollarSign,
  Megaphone, CheckSquare, Shield, ChevronDown, Calendar, PackageCheck, User, Store,
  ChevronLeft, ChevronRight, Warehouse, RotateCcw, Wrench, Receipt,
  Fingerprint, Kanban, BarChart3, Settings, Mail, GanttChartSquare
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useWebSocket } from '../hooks/useWebSocket'
import { markNotificationRead, markAllNotificationsRead, getNotifications } from '../api/notifications'
import { getUnreadAnnouncementCount, getAnnouncements, markAnnouncementRead } from '../api/announcements'
import { getApprovals } from '../api/approvals'
import type { Notification, Announcement } from '../types'
import { getModuleConfigs } from '../api/moduleConfig'
import { MODULE_REGISTRY, ICON_MAP } from '../config/moduleRegistry'

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员', technician: '技术员', customer: '客服',
}

type NavGroup = {
  label: string
  items: { path: string; label: string; icon: React.ElementType; permission?: string[]; platformOnly?: boolean }[]
  permission?: string[]
}

const navGroups: NavGroup[] = [
  {
    label: '主要功能',
    items: [
      { path: '/', label: '工作台', icon: LayoutDashboard },
      { path: '/reports', label: '数据报表', icon: BarChart3 },
      { path: '/knowledge', label: '知识库', icon: BookOpen },
    ],
  },
  {
    label: '客服业务',
    items: [
      { path: '/tickets', label: '工单池', icon: Ticket, permission: ['tickets:view'] },
      { path: '/tickets/create', label: '创建工单', icon: FilePlus, permission: ['tickets:create'] },
    ],
  },
  {
    label: '仓储业务',
    items: [
      { path: '/warehouse', label: '仓储管理', icon: Warehouse, permission: ['warehouse_products:view', 'warehouse_inbound:view', 'warehouse_outbound:view'] },
    ],
  },
  {
    label: '财务业务',
    items: [
      { path: '/finance', label: '财务管理', icon: Receipt, permission: ['finance_invoice_request:view', 'finance_sales_invoice:view', 'finance_purchase_invoice:view', 'finance_expense_invoice:view'] },
    ],
  },
  {
    label: '内部协作',
    items: [
      { path: '/attendance', label: '考勤打卡', icon: Fingerprint, permission: ['attendance:view'] },
      { path: '/tasks', label: '任务看板', icon: Kanban, permission: ['tasks:view'] },
      { path: '/messages', label: '内部邮件', icon: Mail, permission: ['messages:view'] },
      { path: '/announcements', label: '公告通知', icon: Megaphone, permission: ['announcements:view'] },
      { path: '/approvals', label: '审批管理', icon: CheckSquare, permission: ['approvals:view'] },
      { path: '/schedule', label: '排班表', icon: Calendar, permission: ['schedule:view'] },
    ],
  },
  {
    label: '系统管理',
    permission: ['users:view', 'departments:view', 'audit_logs:view'],
    items: [
      { path: '/users', label: '人员管理', icon: Users, permission: ['users:view'] },
      { path: '/module-settings', label: '模块配置', icon: Settings },
      { path: '/approval-rules', label: '审批规则', icon: GanttChartSquare, permission: ['approval_rules:view'] },
      { path: '/audit-logs', label: '操作日志', icon: Shield, permission: ['audit_logs:view'] },
    ],
  },
]

export default function AppLayout() {
  const { user, setUser, loading: authLoading, hasPermission } = useAuth()
  const { unreadCount, setUnreadCount, showPanel, setShowPanel, refreshUnread } = useWebSocket(user?.id)
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  // 路由切换时自动将内容区滚动到顶部
  useEffect(() => {
    // 用 rAF 确保在浏览器完成渲染后再滚动
    requestAnimationFrame(() => {
      const el = mainRef.current
      if (el) {
        el.scrollTop = 0
      }
      window.scrollTo(0, 0)
    })
  }, [location.pathname])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved === 'true'
  })
  const [notifList, setNotifList] = useState<Notification[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [unreadAnnCount, setUnreadAnnCount] = useState(0)
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)
  const [announcementPopup, setAnnouncementPopup] = useState<Announcement | null>(null)
  const [moduleItems, setModuleItems] = useState<{ path: string; label: string; icon: React.ElementType; permission: string[] }[]>([])
  const [warehouseModuleItems, setWarehouseModuleItems] = useState<{ path: string; label: string; icon: React.ElementType; permission: string[] }[]>([])
  const [ticketsEnabled, setTicketsEnabled] = useState(true)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    navigate('/login')
  }

  const handleNotifPanel = async () => {
    if (!showPanel) {
      getNotifications({ page: 1, page_size: 10, unread_only: true })
        .then(res => setNotifList(res.data.items))
        .catch(console.error)
    }
    setShowPanel(!showPanel)
  }

  const handleMarkAllRead = async () => {
    markAllNotificationsRead().then(() => {
      setNotifList([])
      refreshUnread()
    }).catch(console.error)
  }

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('sidebarCollapsed', String(!prev))
      return !prev
    })
  }

  // 仅在认证就绪（user 已加载）后才请求模块配置
  useEffect(() => {
    if (authLoading || !user) return
    getModuleConfigs().then(mods => {
      // 检查工单系统开关
      const ticketsMod = mods.find(m => m.module_key === 'tickets')
      setTicketsEnabled(ticketsMod ? ticketsMod.enabled : true)

      const items = mods
        .filter(m => m.enabled && m.module_key !== 'tickets')
        .map(m => {
          // 优先使用数据库值，回退到注册表默认值
          const reg = MODULE_REGISTRY[m.module_key]
          const icon = ICON_MAP[m.icon || reg?.icon || 'PackageCheck'] || PackageCheck
          const routePath = m.route_path || reg?.routePath || `/module/${m.module_key}`
          const navGroup = m.navigation_group || reg?.navigationGroup || ''
          const displayName = m.display_name || reg?.displayName || m.module_key

          return {
            path: routePath,
            label: displayName,
            icon,
            permission: m.permissions && m.permissions !== '[]'
              ? JSON.parse(m.permissions)
              : [`${m.module_key}:view`],
            navigationGroup: navGroup,
          }
        })

      // 按 navigation_group 分组，而不是硬编码路由前缀
      setModuleItems(items.filter(i => i.navigationGroup === '客服业务'))
      setWarehouseModuleItems(items.filter(i => i.navigationGroup === '仓储业务'))
    }).catch(() => {})
  }, [authLoading, user])

  // 获取未读公告数量（仅登录时）
  useEffect(() => {
    if (!user?.id) return
    getUnreadAnnouncementCount()
      .then(data => {
        setUnreadAnnCount(data.unread_count || 0)
        if ((data.unread_count || 0) > 0 && location.pathname === '/') {
          getAnnouncements({ page: 1, page_size: 5, active_only: true })
            .then(res => {
              const unread = (res.items || []).find(a => !a.is_read)
              if (unread) setAnnouncementPopup(unread)
            })
            .catch(console.error)
        }
      })
      .catch(console.error)
  }, [user?.id])

  // 仅在路由切换到首页时检查是否需要弹公告
  useEffect(() => {
    if (location.pathname === '/' && unreadAnnCount > 0) {
      getAnnouncements({ page: 1, page_size: 5, active_only: true })
        .then(res => {
          const unread = (res.items || []).find(a => !a.is_read)
          if (unread) setAnnouncementPopup(unread)
        })
        .catch(console.error)
    }
  }, [location.pathname, unreadAnnCount])

  useEffect(() => {
    if (!user?.id) return
    getApprovals({ page: 1, page_size: 50, pending_my_approval: true })
      .then(data => setPendingApprovalCount(data.total || 0))
      .catch(console.error)
  }, [user?.id])

  const visibleGroups = navGroups
    .filter(g => !g.permission || hasPermission(...g.permission))
    .map(g => {
      let items = [...g.items]
      // Merge dynamic module items into 客服业务 / 仓储业务
      if (g.label === '客服业务') {
        items = [...items, ...moduleItems]
        // 工单系统开关：关闭时隐藏工单池和创建工单
        if (!ticketsEnabled) {
          items = items.filter(i => i.path !== '/tickets' && i.path !== '/tickets/create')
        }
      } else if (g.label === '仓储业务') {
        items = [...items, ...warehouseModuleItems]
      }
      return {
        ...g,
        items: items.filter(item => (!item.platformOnly || user?.is_platform_admin) && (!item.permission || hasPermission(...item.permission))),
      }
    })
    .filter(g => g.items.length > 0)

  return (
    <div className="min-h-screen flex" style={{ background: '#fafaf9' }}>
      {/* Sidebar - 深灰/近黑色背景 */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col transform transition-all duration-300 lg:relative lg:translate-x-0 lg:h-screen lg:sticky lg:top-0 lg:self-start
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${sidebarCollapsed ? 'w-16' : 'w-48'}`}
        style={{ background: '#27272a', color: 'white' }}>
        {/* Logo 区域 */}
        <div className="relative flex items-center py-5 border-b flex-shrink-0 px-3" style={{ borderColor: '#27272a' }}>
          {sidebarCollapsed ? (
            <button
              onClick={toggleSidebarCollapse}
              className="mx-auto p-1.5 rounded-lg transition-colors"
              style={{ color: '#71717a' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#3f3f46'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title="展开侧边栏"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#3f3f46' }}>
                <Store className="w-5 h-5 text-white" />
              </div>
              <div className="ml-3 min-w-0">
                <h1 className="text-sm font-bold text-white leading-tight line-clamp-2 break-all">
                  {user?.company_name || '微迹OA'}
                </h1>
                <p className="text-[10px]" style={{ color: '#71717a' }}>内部数字化管理系统</p>
              </div>
              <button
                onClick={toggleSidebarCollapse}
                className="absolute right-3 top-5 p-1.5 rounded-lg transition-colors"
                style={{ color: '#71717a' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#3f3f46'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                title="折叠侧边栏"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide py-4 px-3 space-y-1">
          {visibleGroups.map(group => {
            const isCollapsed = collapsedGroups.has(group.label)
            return (
              <div key={group.label} className="mb-3">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-sm font-semibold mb-2 rounded transition-colors hover:bg-white/5 ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                  style={{ color: '#a1a1aa', letterSpacing: '0.02em', background: 'rgba(255,255,255,0.04)' }}
                >
                  {!sidebarCollapsed && <span>{group.label}</span>}
                  <ChevronDown size={12} style={{ color: '#52525b', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </button>

                {!isCollapsed && group.items.map(item => {
                  const isActive = item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.path
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-all duration-200 ${
                        isActive ? 'font-medium' : ''
                      } ${sidebarCollapsed ? 'justify-center px-0 w-full' : ''}`}
                      style={isActive ? {
                        background: '#3f3f46',
                        color: 'white',
                      } : {
                        color: 'white',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = '#3f3f46'
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent'
                      }}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <item.icon className="w-[16px] h-[16px] flex-shrink-0" />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                      {item.path === '/announcements' && unreadAnnCount > 0 && !sidebarCollapsed && (
                        <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ background: '#ef4444', color: 'white' }}>
                          {unreadAnnCount > 9 ? '9+' : unreadAnnCount}
                        </span>
                      )}
                      {item.path === '/approvals' && pendingApprovalCount > 0 && !sidebarCollapsed && (
                        <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ background: '#ef4444', color: 'white' }}>
                          {pendingApprovalCount > 9 ? '9+' : pendingApprovalCount}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* User Info */}
        <div className={`px-4 py-4 border-t flex-shrink-0 ${sidebarCollapsed ? 'px-2' : ''}`} style={{ borderColor: '#27272a' }}>
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: '#3f3f46', color: 'white' }}>
                {user?.name?.[0] || '?'}
              </div>
              <button onClick={handleLogout}
                className="p-2 rounded-lg transition-colors"
                style={{ color: '#71717a' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#71717a'}
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: '#3f3f46', color: 'white' }}>
                  {user?.name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-white">{user?.name}</p>
                  <p className="text-[11px]" style={{ color: '#71717a' }}>{user?.role_label || ROLE_LABELS[user?.role || ''] || user?.role}</p>
                </div>
              </div>

              <NavLink to="/profile"
                className="flex items-center gap-2 text-sm mb-2 px-1 transition-colors"
                style={{ color: '#a1a1aa' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#a1a1aa'}
              >
                <User size={14} />
                个人中心
              </NavLink>
              <div className="h-px mb-2" style={{ background: '#27272a' }} />
              <button onClick={handleLogout}
                className="flex items-center gap-2 text-sm w-full px-1 transition-colors"
                style={{ color: '#71717a' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#71717a'}
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b flex items-center justify-between px-4 lg:px-6"
          style={{ borderColor: '#f0f0f0' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg transition-colors"
              style={{ color: '#737373' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f4'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <button
              onClick={handleNotifPanel}
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: '#737373' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f4'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showPanel && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border overflow-hidden"
                style={{ borderColor: '#f0f0f0', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor: '#f0f0f0', background: '#fafaf9' }}>
                  <span className="text-sm font-semibold" style={{ color: '#1f1f1f' }}>通知</span>
                  {notifList.length > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs transition-colors"
                      style={{ color: '#404040' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#000'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#404040'}
                    >
                      全部已读
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifList.length === 0 ? (
                    <p className="text-center text-sm py-8" style={{ color: '#a3a3a3' }}>暂无未读通知</p>
                  ) : (
                    notifList.map((n) => (
                      <div
                        key={n.id}
                        className="px-4 py-3 border-b cursor-pointer transition-colors"
                        style={{ borderColor: '#fafaf9' }}
                        onClick={async (e) => {
                          e.stopPropagation()
                          // 标记已读
                          await markNotificationRead(n.id)
                          setUnreadCount(prev => Math.max(0, prev - 1))
                          // 构建跳转路径（带高亮参数）
                          let path = '/'
                          const highlightId = n.resource_id || n.ticket_id
                          if (n.resource_type === 'return_exchange' && n.resource_id) {
                            path = `/return-exchange?highlight=${n.resource_id}`
                          } else if (n.resource_type === 'repair' && n.resource_id) {
                            path = `/repair?highlight=${n.resource_id}`
                          } else if (n.resource_type === 'gift' && n.resource_id) {
                            path = `/gifts?highlight=${n.resource_id}`
                          } else if (n.resource_type === 'gift_resend' && n.resource_id) {
                            path = `/gift-resend?highlight=${n.resource_id}`
                          } else if (n.ticket_id) {
                            path = `/tickets/${n.ticket_id}?highlight=${n.ticket_id}`
                          }
                          navigate(path)
                          setShowPanel(false)
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#fafaf9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <p className="text-sm font-medium" style={{ color: '#1f1f1f' }}>{n.title}</p>
                        <p className="text-xs mt-1" style={{ color: '#a3a3a3' }}>{n.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content - key 确保路由切换时内容区重新挂载，滚动位置自动归零 */}
        <main key={location.pathname} ref={mainRef} className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* 公告弹窗提醒 */}
      {announcementPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center gap-3 p-5 border-b" style={{ borderColor: '#f0f0f0' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#fef3c7' }}>
                <Megaphone className="w-5 h-5" style={{ color: '#d97706' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold truncate" style={{ color: '#1f1f1f' }}>新公告通知</h3>
                <p className="text-xs" style={{ color: '#a3a3a3' }}>
                  {announcementPopup.author_name} · {announcementPopup.created_at?.slice(0, 16).replace('T', ' ')}
                </p>
              </div>
            </div>
            <div className="p-5 min-w-0">
              <h4 className="text-lg font-semibold mb-3 break-words" style={{ color: '#1f1f1f' }}>{announcementPopup.title}</h4>
              <p className="text-sm whitespace-pre-wrap break-words max-h-60 overflow-y-auto" style={{ color: '#737373' }}>{announcementPopup.content}</p>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t" style={{ borderColor: '#f0f0f0' }}>
              <button
                onClick={() => {
                  markAnnouncementRead(announcementPopup.id).catch(console.error)
                  setAnnouncementPopup(null)
                  setUnreadAnnCount(c => Math.max(0, c - 1))
                }}
                className="px-5 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ background: '#404040', color: 'white' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#262626'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#404040'}
              >
                我已知晓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
