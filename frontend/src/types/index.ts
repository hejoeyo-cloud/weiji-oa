export interface User {
  id: number
  company_id?: number
  company_name?: string
  is_platform_admin?: boolean
  email: string
  username: string
  name: string
  note: string
  role: string
  role_label: string
  role_color: string
  permissions: string[]
  department_id?: number
  department_name?: string
  is_manager?: boolean
  dingtalk_user_id?: string
  created_at?: string
}

export interface Company {
  id: number
  name: string
  status: string
  user_count: number
  created_at?: string
}

export interface Ticket {
  id: number
  platform: string
  customer_id: string
  description: string
  images: string[]
  remote_tool: string
  remote_code: string
  verify_code: string
  priority: string
  status: string
  diagnosis_result: string
  diagnosis_log: any[]
  created_by: number
  assigned_to?: number
  created_at?: string
  updated_at?: string
  completed_at?: string
  creator_name: string
  assignee_name?: string
  feedbacks: TicketFeedback[]
}

export interface TicketFeedback {
  id: number
  ticket_id: number
  user_id: number
  content: string
  feedback_type: string
  created_at?: string
  user_name: string
}

export interface Notification {
  id: number
  user_id: number
  ticket_id?: number
  resource_type?: string
  resource_id?: number
  title: string
  content: string
  is_read: boolean
  created_at?: string
}

export interface KnowledgeCategory {
  id: number
  name: string
  icon: string
  sort_order: number
  article_count: number
}

export interface KnowledgeArticle {
  id: number
  category_id: number
  category_name: string
  title: string
  problem_desc: string
  solution_steps: string[]
  keywords: string
  images: string[]
  created_by?: number
  created_at?: string
  updated_at?: string
}

// ── 部门 ─────────────────────────────────────────────────────────────
export interface Department {
  id: number
  name: string
  description: string
  sort_order: number
  member_count: number
}

// ── 售后登记 ─────────────────────────────────────────────────────────
export interface AfterSalesRecord {
  id: number
  apply_date: string
  order_no: string
  return_reason: string
  size: string
  model: string
  config: string
  computer_price: number
  quantity: number
  accessories: string
  accessories_price: number
  customer_info: string
  return_tracking: string
  send_tracking: string
  handle_result: string
  progress: string  // pending | processing | completed
  charge_required: boolean
  charge_status: string
  current_expected_amount: number
  current_paid_amount: number
  last_charge_request_id?: number
  disassembly_feedback: string
  shipping_fee: number
  remark: string
  record_type: string  // 登记类型：return(退货)/exchange(换货)
  created_by?: number
  creator_name: string
  created_at?: string
  updated_at?: string
}

// ── 店铺 ─────────────────────────────────────────────────────────────
export interface Shop {
  id: number
  name: string
  created_at?: string
}

// ── 退换登记 ─────────────────────────────────────────────────────────
export interface GiftBrief {
  id: number
  date: string
  model: string
  config: string
  color: string
  quantity: number
  accessories: string
  send_tracking: string
  order_amount: number
  gift_costs: { name: string; amount: number }[]
  status: string
}

export interface ReturnExchangeRecord {
  id: number
  apply_date: string
  shop_name: string
  order_no: string
  return_reason: string
  size: string
  model: string
  config: string
  computer_price: number
  quantity: number
  accessories: string
  accessories_price: number
  customer_info: string
  return_tracking: string
  send_tracking: string
  handle_result: string
  progress: string  // pending | processing | completed
  record_type: string  // 登记类型：return(退货)/exchange(换货)
  disassembly_feedback: string
  shipping_fee: number
  remark: string
  has_damage: boolean
  damage_items: { name: string; amount: number; desc: string }[]
  total_damage_amount: number
  claim_status: string  // none | pending | claimed
  created_by?: number
  creator_name: string
  created_at?: string
  updated_at?: string
  duplicate_count?: number
  matched_gift?: GiftBrief | null
}

export interface ReturnExchangeFeedback {
  id: number
  record_id: number
  user_id: number
  content: string
  created_at?: string
  user_name: string
}

// ── 维修登记 ─────────────────────────────────────────────────────────
export interface RepairRecord {
  id: number
  apply_date: string
  shop_name: string
  order_no: string
  return_reason: string  // 故障描述
  model: string
  config: string
  quantity: number
  accessories: string
  customer_info: string
  return_tracking: string
  send_tracking: string
  handle_result: string
  repair_status: string  // pending_repair | processing_repair | completed_repair
  charge_required: boolean
  charge_status: string
  current_expected_amount: number
  current_paid_amount: number
  last_charge_request_id?: number
  disassembly_feedback: string
  shipping_fee: number
  remark: string
  created_by?: number
  creator_name: string
  created_at?: string
  updated_at?: string
  duplicate_count?: number
}

export interface RepairFeedback {
  id: number
  record_id: number
  user_id: number
  content: string
  created_at?: string
  user_name: string
}

export interface RepairChargeRequest {
  id: number
  repair_record_id: number
  status: string
  expected_amount: number
  paid_amount: number
  charge_note: string
  amount_change_note: string
  created_by: number
  created_by_name: string
  paid_by?: number
  paid_by_name: string
  created_at?: string
  paid_at?: string
  updated_at?: string
}

// ── 发货登记 ─────────────────────────────────────────────────────────
export interface GiftCostItem {
  name: string
  amount: number
}

export interface GiftRecord {
  id: number
  date: string
  shop_id?: number
  shop_name: string
  order_no: string
  product: string
  size: string
  model: string
  config: string
  color: string
  quantity: number
  accessories: string
  customer_info: string
  send_tracking: string
  shipping_fee: number
  order_amount: number   // 订单金额（有权限时显示）
  cost: number          // 产品成本（有权限时显示）
  gift_costs: GiftCostItem[] // 礼品成本列表
  total_gift_cost: number // 礼品成本合计
  total_cashback: number // 自动汇总的返现金额（来自返现表）
  profit: number        // 利润 = 订单金额 - 产品成本 - 礼品合计 - 返现
  remark: string
  ship_date: string
  status: string  // pending | sent
  created_by?: number
  creator_name: string
  created_at?: string
  updated_at?: string
  duplicate_count?: number
}

// ── 返现登记 ─────────────────────────────────────────────────────────
export interface GiftCashback {
  id: number
  shop_name: string
  order_no: string
  cashback_amount: number
  reason: string
  remark: string
  applicant: string
  created_by?: number
  creator_name: string
  created_at?: string
  updated_at?: string
  duplicate_count?: number
}

// ── 礼品补发登记 ─────────────────────────────────────────────────────
export interface GiftResendItem {
  name: string
  quantity: number
  amount: number
}

export interface GiftResendRecord {
  id: number
  apply_date: string
  order_no: string
  shop_name: string
  type: string
  gift_detail: string
  gift_items: GiftResendItem[]
  customer_info: string
  express_company: string
  tracking_no: string
  status: string
  remark: string
  created_by?: number
  creator_name: string
  created_at?: string
  updated_at?: string
  duplicate_count?: number
}

// ── 三种处理记录类型 ─────────────────────────────────────────────────
export interface AfterSalesFeedback {
  id: number
  record_id: number
  user_id: number
  content: string
  created_at?: string
  user_name: string
}

export interface AfterSalesChargeRequest {
  id: number
  after_sales_record_id: number
  status: string
  expected_amount: number
  paid_amount: number
  charge_note: string
  amount_change_note: string
  created_by: number
  created_by_name: string
  paid_by?: number
  paid_by_name: string
  created_at?: string
  paid_at?: string
  updated_at?: string
}

export interface GiftFeedback {
  id: number
  record_id: number
  user_id: number
  content: string
  created_at?: string
  user_name: string
}

export interface GiftResendFeedback {
  id: number
  record_id: number
  user_id: number
  content: string
  created_at?: string
  user_name: string
}

// ── 操作日志 ─────────────────────────────────────────────────────────
export interface AuditLog {
  id: number
  user_id?: number
  username: string
  user_name: string
  action: string
  resource_type: string
  resource_id?: number
  detail: string
  ip_address: string
  created_at?: string
}

// ── 公告 ─────────────────────────────────────────────────────────────
export interface Announcement {
  id: number
  title: string
  content: string
  is_pinned: boolean
  is_active: boolean
  target_departments: number[]
  target_department_names: string
  created_by?: number
  author_name: string
  created_at?: string
  updated_at?: string
  is_read?: boolean
}

// ── 审批流程 ─────────────────────────────────────────────────────────
export interface ApprovalStep {
  id: number
  step_order: number
  approver_id?: number
  approver_name: string
  status: string  // pending | waiting | approve | reject
  comment: string
  approved_at?: string
}

export interface ApprovalRequest {
  id: number
  type: string  // leave | reimbursement | purchase
  title: string
  description: string
  amount?: number
  start_date: string
  end_date: string
  attachments: string[]
  status: string  // pending | approved | rejected | cancelled
  applicant_id?: number
  applicant_name: string
  steps: ApprovalStep[]
  created_at?: string
  updated_at?: string
}

// ── 排班管理 ─────────────────────────────────────────────────────────
export interface ScheduleShift {
  id: number
  name: string
  short_name: string
  color: string
  start_time: string
  end_time: string
  sort_order: number
  is_rest: boolean
}

export interface ScheduleSlot {
  id: number
  user_id: number
  user_name: string
  date: string
  shift_id: number
  shift_name: string
  shift_short_name: string
  shift_color: string
  shift_is_rest: boolean
}

export interface ShiftSwapRequest {
  id: number
  applicant_id: number
  applicant_name: string
  target_user_id: number
  target_user_name: string
  applicant_date: string
  target_date: string
  reason: string
  status: string  // pending | approved | rejected | cancelled
  reviewer_id?: number
  reviewer_name: string
  review_comment: string
  reviewed_at?: string
  created_at?: string
}

// ── 仓储管理 ─────────────────────────────────────────────────────────
export interface WarehouseProduct {
  id: number
  code: string
  category: string
  name: string
  spec: string
  location: string
  initial_qty: number
  unit: string
  remark: string
  inbound_qty: number
  outbound_qty: number
  current_qty: number
  created_by?: number
  creator_name: string
  created_at?: string
  updated_at?: string
}

export interface WarehouseInbound {
  id: number
  date: string
  product_id: number
  product_code: string
  category: string
  product_name: string
  spec: string
  location: string
  quantity: number
  operator: string
  remark: string
  created_by?: number
  creator_name: string
  created_at?: string
  updated_at?: string
}

export interface WarehouseOutbound {
  id: number
  date: string
  product_id: number
  product_code: string
  category: string
  product_name: string
  spec: string
  location: string
  quantity: number
  operator: string
  remark: string
  created_by?: number
  creator_name: string
  created_at?: string
  updated_at?: string
}

export interface WarehouseStats {
  total_products: number
  total_inbound: number
  total_outbound: number
  current_qty: number
  low_stock_count: number
  low_stock_items: {
    id: number
    code: string
    name: string
    current_qty: number
    unit: string
  }[]
}

// ── 仓储处理记录 ─────────────────────────────────────────────────────────
export interface WarehouseInboundFeedback {
  id: number
  record_id: number
  user_id: number
  content: string
  created_at?: string
  user_name: string
}

export interface WarehouseOutboundFeedback {
  id: number
  record_id: number
  user_id: number
  content: string
  created_at?: string
  user_name: string
}

// ── 返厂出库 ─────────────────────────────────────────────────────────

export interface WarehouseReturnToFactory {
  id: number
  date: string
  product_id: number
  product_code: string
  category: string
  product_name: string
  spec: string
  location: string
  quantity: number
  reason: string
  status: string
  repaired_at?: string
  operator: string
  remark: string
  created_by?: number
  creator_name: string
  created_at?: string
  updated_at?: string
}

export interface WarehouseReturnToFactoryFeedback {
  id: number
  record_id: number
  user_id: number
  content: string
  created_at?: string
  user_name: string
}

// ── 角色管理 ─────────────────────────────────────────────────────────
export interface Role {
  id: number
  name: string
  label: string
  color: string
  permissions: string[]
  bound_shops: number[]
  is_builtin: boolean
  sort_order: number
  user_count: number
}

export interface DashboardUserSummary {
  name: string
  role: string
  role_label: string
  department_name: string
  is_manager: boolean
}

export interface DashboardAnnouncementItem {
  id: number
  title: string
  content: string
  author_name: string
  created_at?: string
  is_pinned: boolean
  is_read: boolean
}

export interface DashboardScheduleShift {
  id: number
  name: string
  short_name: string
  color: string
  start_time: string
  end_time: string
  is_rest: boolean
}

export interface DashboardScheduleSlot {
  id: number
  date: string
  shift_id: number
  shift_name: string
  shift_short_name: string
  shift_color: string
  shift_is_rest: boolean
}

export interface DashboardOverviewCard {
  key: string
  title: string
  value: string | number
  subtext: string
  status: string
  path?: string
}

export interface DashboardShortcut {
  key: string
  label: string
  description: string
  path: string
  icon: string
}

export interface DashboardRecentActivityItem {
  key: string
  kind: string
  title: string
  description: string
  time?: string
  path: string
}

export interface DashboardResponse {
  user_summary: DashboardUserSummary
  announcement_summary: {
    unread_count: number
    has_pinned: boolean
    items: DashboardAnnouncementItem[]
  }
  schedule_summary: {
    year_month: string
    today: string
    tomorrow: string
    today_slot?: DashboardScheduleSlot | null
    tomorrow_slot?: DashboardScheduleSlot | null
    shifts: DashboardScheduleShift[]
    slots: DashboardScheduleSlot[]
  }
  overview_cards: DashboardOverviewCard[]
  shortcuts: DashboardShortcut[]
  recent_activity: DashboardRecentActivityItem[]
  unread_messages?: any[]
  my_todo?: { type: string; label: string; title: string; time: string; path: string }[]
}

// ── 考勤打卡 ─────────────────────────────────────────────────────────
export interface AttendanceRecord {
  id: number
  company_id?: number
  user_id: number
  user_name: string
  department_name: string
  date: string
  check_in?: string
  check_out?: string
  status: string
  source: string
  location: string
  remark: string
  scheduled_start: string
  scheduled_end: string
  created_at?: string
}

export interface MonthlyAttendanceStats {
  total_days: number
  normal_days: number
  late_days: number
  early_days: number
  absent_days: number
}

// ── 任务看板 ─────────────────────────────────────────────────────────
export interface TaskItem {
  id: number
  company_id?: number
  title: string
  description: string
  status: string  // todo / in_progress / done
  priority: string
  assignee_id?: number
  assignee_name: string
  due_date: string
  sort_order: number
  created_by?: number
  creator_name: string
  created_at?: string
  updated_at?: string
}

// ── 统计报表 ─────────────────────────────────────────────────────────
export interface TicketTrendItem {
  month: string
  count: number
}

export interface ModuleDistributionItem {
  name: string
  count: number
}

export interface DashboardStats {
  ticket_trend: TicketTrendItem[]
  module_distribution: ModuleDistributionItem[]
  ticket_status_distribution: ModuleDistributionItem[]
  today_attendance: number
  total_tasks: number
  pending_tasks: number
}

// ── 新报表 ─────────────────────────────────────────────────────────

export interface MonthValue { month: string; value: number }
export interface NameValue { name: string; value: number }

export interface OverviewCard { label: string; value: number; change: number }
export interface OverviewData {
  cards: OverviewCard[]
  shipping_vs_return: { month: string; shipping_qty: number; return_qty: number; return_rate: number }[]
  module_distribution: NameValue[]
}

export interface ProfitItem {
  month: string; revenue: number; cost: number; gift_cost: number; cashback: number; shipping_fee: number; profit: number
}
export interface ShippingData {
  qty_trend: MonthValue[]
  amount_trend: { month: string; order_amount: number; cost: number; shipping_fee: number }[]
  profit_trend: ProfitItem[]
  top_configs: NameValue[]
  top_models: NameValue[]
  color_preference: NameValue[]
}

export interface AftersalesData {
  return_exchange_trend: { month: string; return_count: number; exchange_count: number }[]
  return_reasons: NameValue[]
  repair_trend: MonthValue[]
  repair_charge_rate: number
  damage_count: number
  damage_amount: number
  status_distribution: NameValue[]
}

export interface FinanceData {
  income_expense_trend: { month: string; income: number; expense: number }[]
  cashback_trend: MonthValue[]
  cashback_reasons: NameValue[]
  invoice_status: NameValue[]
  invoice_type_amount: NameValue[]
}

export interface ShopRankItem {
  shop_name: string; shipping_qty: number; return_qty: number; return_rate: number; order_amount: number; repair_count: number
}
export interface ShopData {
  shipping_rank: NameValue[]
  return_rate_rank: NameValue[]
  amount_rank: NameValue[]
  detail_table: ShopRankItem[]
}

// ── 钉钉 ─────────────────────────────────────────────────────────
export interface DingtalkConfig {
  id: number
  company_id: number
  app_key: string
  app_secret_masked: string
  enabled: boolean
  last_sync_at?: string
}

// ── 模块配置 ─────────────────────────────────────────────────────────
export interface ModuleConfigItem {
  id: number
  module_key: string
  enabled: boolean
  display_name: string
  sort_order: number
  // ── v2.0 新增字段 ──
  icon: string
  route_path: string
  navigation_group: string
  permissions: string          // JSON 字符串，前端使用时需 parse
  fields_schema: string        // JSON 字符串，前端使用时需 parse
  // ────────────────
}

export interface FieldLabel {
  id: number
  module_key: string
  field_name: string
  label: string
}

export interface FieldDef {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  options: string[]
  required: boolean
  sort_order: number
}

// ── 内部邮件 ─────────────────────────────────────────────────────────
export interface Message {
  id: number; sender_id: number; sender_name: string;
  recipient_id: number; recipient_name: string;
  subject: string; content: string;
  is_read: boolean; is_draft: boolean;
  is_starred: boolean; is_forward: boolean;
  has_attachments: boolean;
  thread_id?: number; reply_to_id?: number;
  created_at?: string;
}

export interface UserBrief {
  id: number
  name: string
  email?: string
}

// ── 审批规则 ─────────────────────────────────────────────────────────
export interface ApprovalRule {
  id: number; name: string; target_module: string
  condition_field: string; condition_op: string; condition_value: string
  sign_mode: string; approver_ids: string; approver_names: string
  enabled: boolean; sort_order: number
}

// ── 产品概览 ─────────────────────────────────────────────────────────
export interface Product {
  id: number
  company_id?: number
  name: string
  model_number: string
  images: string[]
  cpu: string
  ram: string
  ram_freq: string
  storage: string
  display: string
  gpu: string
  ports: string[]
  battery: string
  weight: string
  description: string
  status: string
  created_by?: number
  creator_name: string
  created_at?: string
  updated_at?: string
}
