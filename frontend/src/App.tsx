import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import TicketList from './pages/TicketList'
import TicketCreate from './pages/TicketCreate'
import TicketDetail from './pages/TicketDetail'
import UserManage from './pages/UserManage'
import KnowledgeList from './pages/KnowledgeList'
import KnowledgeDetail from './pages/KnowledgeDetail'
import KnowledgeEdit from './pages/KnowledgeEdit'
import AfterSalesList from './pages/AfterSalesList'
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
import BillingPage from './pages/BillingPage'
import PlatformPage from './pages/PlatformPage'
import AttendancePage from './pages/AttendancePage'
import TaskBoard from './pages/TaskBoard'
import ReportsPage from './pages/ReportsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
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
          <Route path="/" element={<Dashboard />} />
          <Route path="/tickets" element={<TicketList />} />
          <Route path="/tickets/create" element={<TicketCreate />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/users" element={<UserManage />} />
          <Route path="/knowledge" element={<KnowledgeList />} />
          <Route path="/knowledge/new" element={<KnowledgeEdit />} />
          <Route path="/knowledge/:id" element={<KnowledgeDetail />} />
          <Route path="/knowledge/:id/edit" element={<KnowledgeEdit />} />
          <Route path="/after-sales" element={<AfterSalesList />} />
          <Route path="/return-exchange" element={<ReturnExchangeList />} />
          <Route path="/repair" element={<RepairList />} />
          <Route path="/gifts" element={<GiftList />} />
          <Route path="/gift-cashback" element={<GiftCashbackList />} />
          <Route path="/gift-resend" element={<GiftResendList />} />
          <Route path="/warehouse" element={<WarehousePage />} />
          <Route path="/announcements" element={<AnnouncementPage />} />
          <Route path="/approvals" element={<ApprovalPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/platform" element={<PlatformPage />} />
          <Route path="/audit-logs" element={<AuditLogPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/tasks" element={<TaskBoard />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
