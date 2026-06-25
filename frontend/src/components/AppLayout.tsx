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
import { getSidebarBadges, type SidebarBadges } from '../api/sidebarBadges'
import type { Notification, Announcement } from '../types'
import { getModuleConfigs } from '../api/moduleConfig'
import { MODULE_REGISTRY, ICON_MAP } from '../config/moduleRegistry'
import LicenseBanner from './LicenseBanner'

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
      { path: '/', label: '工作台', icon: LayoutDashboard, permission: ['dashboard:view'] },
      { path: '/reports', label: '数据报表', icon: BarChart3, permission: ['reports:view'] },
      { path: '/knowledge', label: '知识库', icon: BookOpen, permission: ['knowledge:view'] },
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
    permission: ['users:view', 'departments:view', 'audit_logs:view', 'module_settings:view'],
    items: [
      { path: '/users', label: '人员管理', icon: Users, permission: ['users:view'] },
      { path: '/module-settings', label: '模块配置', icon: Settings, permission: ['module_settings:view'] },
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
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [unreadAnnCount, setUnreadAnnCount] = useState(0)
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)
  const [badges, setBadges] = useState<SidebarBadges>({
    pending_my_approval: 0, pending_tasks: 0, unread_messages: 0,
    pending_tickets: 0, pending_delivery: 0, pending_return_exchange: 0,
    pending_repair: 0, pending_finance: 0, pending_schedule: 0,
  })
  const [announcementPopup, setAnnouncementPopup] = useState<Announcement | null>(null)
  const [moduleItems, setModuleItems] = useState<{ path: string; label: string; icon: React.ElementType; permission: string[] }[]>([])
  const [warehouseModuleItems, setWarehouseModuleItems] = useState<{ path: string; label: string; icon: React.ElementType; permission: string[] }[]>([])
  const [mainModuleItems, setMainModuleItems] = useState<{ path: string; label: string; icon: React.ElementType; permission: string[] }[]>([])
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
              : (reg?.permissions || []),
            navigationGroup: navGroup,
          }
        })

      // 按 navigation_group 分组，而不是硬编码路由前缀
      setModuleItems(items.filter(i => i.navigationGroup === '客服业务'))
      setWarehouseModuleItems(items.filter(i => i.navigationGroup === '仓储业务'))
      setMainModuleItems(items.filter(i => i.navigationGroup === '主要功能'))
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

  // 侧边栏红点：轮询待处理数量
  useEffect(() => {
    if (!user?.id) return
    const fetchBadges = () => {
      getSidebarBadges().then(setBadges).catch(console.error)
    }
    fetchBadges()
    const timer = setInterval(fetchBadges, 60000)
    return () => clearInterval(timer)
  }, [user?.id])

  const visibleGroups = navGroups
    .filter(g => !g.permission || hasPermission(...g.permission))
    .map(g => {
      let items = [...g.items]
      // Merge dynamic module items into 主要功能 / 客服业务 / 仓储业务
      if (g.label === '主要功能') {
        items = [...items, ...mainModuleItems]
      } else if (g.label === '客服业务') {
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
        items: items.filter(item => {
          // 如果工单模块被禁用，隐藏工单池和创建工单
          if (!ticketsEnabled && (item.path === '/tickets' || item.path === '/tickets/create')) {
            return false
          }
          return (!item.platformOnly || user?.is_platform_admin) && (!item.permission || hasPermission(...item.permission))
        }),
      }
    })
    .filter(g => g.items.length > 0)

  // 通知跳转路径构建
  const getNotifPath = (n: Notification): string => {
    const hid = n.resource_id || n.ticket_id
    if (n.resource_type === 'return_exchange' && n.resource_id) return `/return-exchange?highlight=${n.resource_id}`
    if (n.resource_type === 'repair' && n.resource_id) return `/repair?highlight=${n.resource_id}`
    if (n.resource_type === 'gift' && n.resource_id) return `/gifts?highlight=${n.resource_id}`
    if (n.resource_type === 'gift_resend' && n.resource_id) return `/gift-resend?highlight=${n.resource_id}`
    if (n.resource_type === 'invoice_request' && n.resource_id) return `/finance?highlight=${n.resource_id}`
    if (n.resource_type === 'message' && n.resource_id) return `/messages?highlight=${n.resource_id}`
    if (n.resource_type === 'announcement' && n.resource_id) return `/announcements?highlight=${n.resource_id}`
    if (n.resource_type === 'task' && n.resource_id) return `/tasks?highlight=${n.resource_id}`
    if (n.ticket_id) return `/tickets/${n.ticket_id}?highlight=${n.ticket_id}`
    return '/'
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#fafaf9' }}>
      {/* Sidebar */}
      <style>{`
        :root {
          --sb-bg: #17171b;
          --sb-text: #ffffff;
          --sb-text-dim: #a1a1aa;
          --sb-text-muted: #7f7f7f;
          --sb-hover: rgba(255,255,255,0.06);
          --sb-active: rgba(255,255,255,0.1);
          --sb-accent: #ffffff;
        }
        .sidebar-nav::-webkit-scrollbar { width: 4px; }
        .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .sidebar-nav::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
        .nav-item-active { position: relative; }
        .nav-item-active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          border-radius: 0 3px 3px 0;
          background: var(--sb-accent);
        }
        @keyframes sidebarItemIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .nav-item-enter { animation: sidebarItemIn 0.2s ease-out both; }
      `}</style>
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col transform transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] lg:relative lg:translate-x-0 lg:h-screen lg:sticky lg:top-0 lg:self-start
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${sidebarCollapsed ? 'w-[60px]' : 'w-[180px]'}`}
        style={{ background: 'var(--sb-bg)', color: 'white' }}>

        {/* Logo 区域 */}
        <div className="relative flex items-center flex-shrink-0 px-3" style={{ height: '64px' }}>
          {sidebarCollapsed ? (
            <button
              onClick={toggleSidebarCollapse}
              className="mx-auto p-2 rounded-xl transition-all duration-200 hover:scale-105"
              style={{ color: 'var(--sb-text-dim)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sb-text-dim)' }}
              title="展开侧边栏"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #404040 0%, #2a2a2e 100%)', boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                <Store className="w-4 h-4" style={{ color: 'var(--sb-text)' }} />
              </div>
              <div className="ml-2.5 min-w-0">
                <h1 className="text-[13px] font-semibold tracking-tight leading-tight truncate" style={{ color: 'var(--sb-accent)' }}>
                  {user?.company_name || '微迹OA'}
                </h1>
                <p className="text-[10px] tracking-wider" style={{ color: 'var(--sb-text-muted)' }}>INTERNAL SYSTEM</p>
              </div>
              <button
                onClick={toggleSidebarCollapse}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all duration-200"
                style={{ color: 'var(--sb-text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sb-text-muted)' }}
                title="折叠侧边栏"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* 分隔线 */}
        <div className="mx-4 flex-shrink-0" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />

        {/* Nav */}
        <nav className="sidebar-nav flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {visibleGroups.map((group, groupIdx) => {
            const isCollapsed = collapsedGroups.has(group.label)
            return (
              <div key={group.label} className={groupIdx > 0 ? 'mt-4' : 'mt-1'}>
                {/* 分组标题 */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center justify-between text-[12px] font-semibold tracking-widest uppercase mb-1.5 rounded-md transition-all duration-200 ${sidebarCollapsed ? 'justify-center px-0 py-1.5' : 'px-2.5 py-1.5'}`}
                  style={{ color: 'var(--sb-text-muted)', letterSpacing: '0.08em' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--sb-text-dim)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--sb-text-muted)'}
                >
                  {!sidebarCollapsed && <span>{group.label}</span>}
                  {!sidebarCollapsed && (
                    <ChevronDown size={10} style={{ color: 'var(--sb-text-muted)', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.25s cubic-bezier(0.25,0.1,0.25,1)' }} />
                  )}
                </button>

                {/* 导航项 */}
                {!isCollapsed && group.items.map((item, idx) => {
                  const isActive = item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.path
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end
                      onClick={() => setSidebarOpen(false)}
                      className={`nav-item-enter flex items-center rounded-lg text-[13px] mb-0.5 transition-all duration-200 group/nav
                        ${isActive ? 'nav-item-active font-medium' : ''}
                        ${sidebarCollapsed ? 'justify-center px-0 py-2 w-full' : 'gap-2.5 px-2.5 py-[7px]'}`}
                      style={{
                        animationDelay: `${(groupIdx * 4 + idx) * 20}ms`,
                        background: isActive ? 'var(--sb-active)' : 'transparent',
                        color: isActive ? 'var(--sb-accent)' : 'var(--sb-text)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--sb-hover)'
                          e.currentTarget.style.color = 'var(--sb-accent)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--sb-text)'
                        }
                      }}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <item.icon className="w-[15px] h-[15px] flex-shrink-0 transition-transform duration-200 group-hover/nav:scale-110" strokeWidth={isActive ? 2 : 1.5} />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      {item.path === '/announcements' && unreadAnnCount > 0 && !sidebarCollapsed && (
                        <span className="ml-auto min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold"
                          style={{ background: '#dc2626', color: 'white', boxShadow: '0 0 0 2px var(--sb-bg)' }}>
                          {unreadAnnCount > 9 ? '9+' : unreadAnnCount}
                        </span>
                      )}
                      {item.path === '/approvals' && pendingApprovalCount > 0 && !sidebarCollapsed && (
                        <span className="ml-auto min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold"
                          style={{ background: '#dc2626', color: 'white', boxShadow: '0 0 0 2px var(--sb-bg)' }}>
                          {pendingApprovalCount > 9 ? '9+' : pendingApprovalCount}
                        </span>
                      )}
                      {(() => {
                        const badgeMap: Record<string, number> = {
                          '/tickets': badges.pending_tickets,
                          '/tasks': badges.pending_tasks,
                          '/messages': badges.unread_messages,
                          '/gifts': badges.pending_delivery,
                          '/return-exchange': badges.pending_return_exchange,
                          '/repair': badges.pending_repair,
                          '/finance': badges.pending_finance,
                          '/schedule': badges.pending_schedule,
                        }
                        const count = badgeMap[item.path]
                        if (!count || count <= 0 || sidebarCollapsed) return null
                        return (
                          <span className="ml-auto min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold"
                            style={{ background: '#dc2626', color: 'white', boxShadow: '0 0 0 2px var(--sb-bg)' }}>
                            {count > 9 ? '9+' : count}
                          </span>
                        )
                      })()}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* 分隔线 */}
        <div className="mx-4 flex-shrink-0" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />

        {/* User Info */}
        <div className={`flex-shrink-0 ${sidebarCollapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold ring-1"
                style={{ background: 'var(--sb-hover)', color: 'var(--sb-text-dim)', '--tw-ring-color': 'rgba(255,255,255,0.1)' } as React.CSSProperties}>
                {user?.name?.[0] || '?'}
              </div>
              <button onClick={handleLogout}
                className="p-1.5 rounded-lg transition-all duration-200"
                style={{ color: 'var(--sb-text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sb-text-muted)'; e.currentTarget.style.background = 'transparent' }}
                title="退出登录"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 mb-2.5 px-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold ring-1"
                  style={{ background: 'var(--sb-hover)', color: 'var(--sb-text)', '--tw-ring-color': 'rgba(255,255,255,0.1)' } as React.CSSProperties}>
                  {user?.name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--sb-accent)' }}>{user?.name}</p>
                  <p className="text-[10px]" style={{ color: 'var(--sb-text-muted)' }}>{user?.role_label || ROLE_LABELS[user?.role || ''] || user?.role}</p>
                </div>
              </div>

              <NavLink to="/profile"
                className="flex items-center gap-2 text-[12px] mb-1 px-2 py-1.5 rounded-md transition-all duration-200"
                style={{ color: 'var(--sb-text-dim)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sb-text-dim)' }}
              >
                <User size={13} strokeWidth={1.5} />
                个人中心
              </NavLink>
              <button onClick={handleLogout}
                className="flex items-center gap-2 text-[12px] w-full px-2 py-1.5 rounded-md transition-all duration-200"
                style={{ color: 'var(--sb-text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sb-text-muted)' }}
              >
                <LogOut size={13} strokeWidth={1.5} />
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
                          // 弹出详情弹窗
                          setSelectedNotif(n)
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

        {/* 授权状态提示 */}
        <LicenseBanner />

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

      {/* 通知详情弹窗 */}
      {selectedNotif && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center gap-3 p-5 border-b" style={{ borderColor: '#f0f0f0' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#dbeafe' }}>
                <Bell className="w-5 h-5" style={{ color: '#2563eb' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: '#1f1f1f' }}>通知详情</p>
                <p className="text-xs mt-0.5" style={{ color: '#a3a3a3' }}>
                  {selectedNotif.created_at?.slice(0, 16).replace('T', ' ')}
                </p>
              </div>
              <button onClick={() => setSelectedNotif(null)}
                className="p-1 rounded-lg transition-colors"
                style={{ color: '#a3a3a3' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="p-5 min-w-0">
              <h4 className="text-lg font-semibold mb-3 break-words" style={{ color: '#1f1f1f' }}>{selectedNotif.title}</h4>
              <p className="text-sm whitespace-pre-wrap break-words max-h-60 overflow-y-auto" style={{ color: '#737373' }}>{selectedNotif.content}</p>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t" style={{ borderColor: '#f0f0f0' }}>
              <button
                onClick={() => setSelectedNotif(null)}
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ color: '#737373' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                关闭
              </button>
              <button
                onClick={() => {
                  const path = getNotifPath(selectedNotif)
                  navigate(path)
                  setSelectedNotif(null)
                }}
                className="px-5 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ background: '#2563eb', color: 'white' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
              >
                查看详情
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
