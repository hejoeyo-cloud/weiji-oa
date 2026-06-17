import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { useAuth } from './hooks/useAuth'
import TicketList from './pages/TicketList'
import TicketCreate from './pages/TicketCreate'
import TicketDetail from './pages/TicketDetail'
import UserManage from './pages/UserManage'
import KnowledgeList from './pages/KnowledgeList'
import KnowledgeDetail from './pages/KnowledgeDetail'
import KnowledgeEdit from './pages/KnowledgeEdit'
import ReturnExchangeList from './pages/ReturnExchangeList'
import RepairList from './pages/RepairList'
import GiftList from './pages/GiftList'
import GiftCashbackList from './pages/GiftCashbackList'
import AuditLogPage from './pages/AuditLogPage'
import AnnouncementPage from './pages/AnnouncementPage'
import ApprovalPage from './pages/ApprovalPage'
import SchedulePage from './pages/SchedulePage'
import GiftResendList from './pages/GiftResendList'
import ProfilePage from './pages/Profile'
import WarehousePage from './pages/Warehouse/WarehousePage'
import FinancePage from './pages/FinancePage'
import AttendancePage from './pages/AttendancePage'
import TaskBoard from './pages/TaskBoard'
import ReportsPage from './pages/ReportsPage'
import ModuleSettingsPage from './pages/ModuleSettingsPage'
import MessagesPage from './pages/MessagesPage'
import ApprovalRulesPage from './pages/ApprovalRulesPage'
import { MODULE_REGISTRY } from './config/moduleRegistry'

function isTokenExpired(): boolean {
  const token = localStorage.getItem('token')
  if (!token) return true
  try {
    // JWT payload 在第二段（base64url 编码）
    const payload = JSON.parse(atob(token.split('.')[1]))
    const now = Math.floor(Date.now() / 1000)
    return payload.exp ? payload.exp < now : false
  } catch {
    return true // 解析失败视为过期
  }
}

// ── 模块路由映射（页面组件需手动关联） ──
const moduleRoutes: Record<string, React.ComponentType> = {
  return_exchange: ReturnExchangeList,
  repair: RepairList,
  gift: GiftList,
  gift_cashback: GiftCashbackList,
  gift_resend: GiftResendList,
}

// 从注册表动态生成模块路由
const dynamicModuleRoutes = Object.values(MODULE_REGISTRY)
  .filter(mod => moduleRoutes[mod.moduleKey])
  .map(mod => {
    const Component = moduleRoutes[mod.moduleKey]
    const routePath = mod.routePath.replace(/^\//, '')
    return <Route key={mod.moduleKey} path={routePath} element={<Component />} />
  })

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token || isTokenExpired()) {
    if (token) {
      // token 已过期，清除以免后续请求反复 401
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function DashboardRoute() {
  const { hasPermission, user } = useAuth()
  if (!user) return <Dashboard />
  if (hasPermission('dashboard:view')) return <Dashboard />
  // 无工作台权限，跳转到第一个有权限的模块
  const fallbackRoutes = [
    { perm: 'tickets:view', path: '/tickets' },
    { perm: 'return_exchange:view', path: '/return-exchange' },
    { perm: 'repair:view', path: '/repair' },
    { perm: 'gifts:view', path: '/gifts' },
    { perm: 'gift_cashback:view', path: '/gift-cashback' },
    { perm: 'gift_resend:view', path: '/gift-resend' },
    { perm: 'warehouse_products:view', path: '/warehouse' },
    { perm: 'finance_invoice_request:view', path: '/finance' },
    { perm: 'attendance:view', path: '/attendance' },
    { perm: 'tasks:view', path: '/tasks' },
    { perm: 'messages:view', path: '/messages' },
    { perm: 'announcements:view', path: '/announcements' },
    { perm: 'approvals:view', path: '/approvals' },
    { perm: 'schedule:view', path: '/schedule' },
  ]
  const target = fallbackRoutes.find(r => hasPermission(r.perm))
  return <Navigate to={target?.path || '/profile'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardRoute />} />
          <Route path="/tickets" element={<TicketList />} />
          <Route path="/tickets/create" element={<TicketCreate />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/users" element={<UserManage />} />
          <Route path="/knowledge" element={<KnowledgeList />} />
          <Route path="/knowledge/new" element={<KnowledgeEdit />} />
          <Route path="/knowledge/:id" element={<KnowledgeDetail />} />
          <Route path="/knowledge/:id/edit" element={<KnowledgeEdit />} />
          {dynamicModuleRoutes}
          <Route path="/warehouse" element={<WarehousePage />} />
          <Route path="/announcements" element={<AnnouncementPage />} />
          <Route path="/approvals" element={<ApprovalPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/audit-logs" element={<AuditLogPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/tasks" element={<TaskBoard />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/module-settings" element={<ModuleSettingsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/approval-rules" element={<ApprovalRulesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
