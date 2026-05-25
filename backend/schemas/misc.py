from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class SubscriptionInfo(BaseModel):
    status: str = "trial"
    trial_end_at: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    grace_end_at: Optional[datetime] = None
    is_writable: bool = True
    days_remaining: int = 0

class CreateUserRequest(BaseModel):
    email: str = ""
    username: str = ""
    password: str
    name: str
    note: str = ""
    role: str = "customer"
    department_id: Optional[int] = None
    is_manager: bool = False

class FeedbackCreate(BaseModel):
    content: str = ""
    feedback_type: str = "progress"

class TroubleshootCategoryOut(BaseModel):
    id: int
    name: str
    icon: str
    sort_order: int
    step_count: int = 0

    class Config:
        from_attributes = True

class TroubleshootStepOut(BaseModel):
    id: int
    parent_id: Optional[int]
    category_id: Optional[int]
    title: str
    instruction: str
    is_hardware: bool
    solution: str
    sort_order: int
    children: List["TroubleshootStepOut"] = []

    class Config:
        from_attributes = True


# ── 部门 ─────────────────────────────────────────────────────────────

class UserInfoFull(BaseModel):
    id: int
    company_id: Optional[int] = None
    company_name: str = ""
    is_platform_admin: bool = False
    email: str = ""
    username: str
    name: str
    note: str
    role: str
    role_label: str = ""
    role_color: str = "#1677FF"
    role_id: Optional[int] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    is_manager: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    name: Optional[str] = None
    note: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[int] = None
    is_manager: Optional[bool] = None
    password: Optional[str] = None


# ── 售后登记 ─────────────────────────────────────────────────────────

class GiftRecordCreate(BaseModel):
    date: str = ""
    order_no: str = ""
    size: str = ""
    model: str = ""
    config: str = ""
    color: str = ""
    quantity: int = 1
    accessories: str = ""
    customer_info: str = ""
    send_tracking: str = ""
    shipping_fee: float = 0
    order_amount: float = 0
    cost: float = 0
    remark: str = ""
    ship_date: str = ""
    status: str = "pending"

class GiftRecordUpdate(BaseModel):
    date: Optional[str] = None
    order_no: Optional[str] = None
    size: Optional[str] = None
    model: Optional[str] = None
    config: Optional[str] = None
    color: Optional[str] = None
    quantity: Optional[int] = None
    accessories: Optional[str] = None
    customer_info: Optional[str] = None
    send_tracking: Optional[str] = None
    shipping_fee: Optional[float] = None
    order_amount: Optional[float] = None
    cost: Optional[float] = None
    remark: Optional[str] = None
    ship_date: Optional[str] = None
    status: Optional[str] = None

class GiftRecordOut(BaseModel):
    id: int
    date: str = ""
    order_no: str = ""
    size: str = ""
    model: str = ""
    config: str = ""
    color: str = ""
    quantity: int = 1
    accessories: str = ""
    customer_info: str = ""
    send_tracking: str = ""
    shipping_fee: float = 0
    order_amount: float = 0
    cost: float = 0
    total_cashback: float = 0      # 自动汇总的返现金额（来自返现表）
    profit: float = 0              # 利润 = 订单金额 - 成本 - 返现
    remark: str = ""
    ship_date: str = ""
    status: str = "pending"
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 返现登记 ─────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    username: str
    action: str
    resource_type: str
    resource_id: Optional[int]
    detail: str
    ip_address: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── 公告 ─────────────────────────────────────────────────────────────

class ScheduleSlotBatchCreate(BaseModel):
    """批量设置排班：同一天多个人的同一班次"""
    user_ids: List[int]
    date: str
    shift_id: int

class ScheduleSlotBatchRangeCreate(BaseModel):
    """批量设置排班：一个人连续多天同一班次"""
    user_id: int
    start_date: str            # YYYY-MM-DD
    end_date: str              # YYYY-MM-DD
    shift_id: int

class ShiftSwapAction(BaseModel):
    action: str = "approve"    # approve / reject
    comment: str = ""

class CompanyOut(BaseModel):
    id: int
    name: str
    status: str
    user_count: int = 0
    subscription: Optional[SubscriptionInfo] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PaymentOrderOut(BaseModel):
    id: int
    order_no: str
    company_id: int
    company_name: str = ""
    plan_type: str
    amount: float
    years: int
    status: str
    alipay_trade_no: str = ""
    paid_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CreatePaymentOrderRequest(BaseModel):
    years: int = 1

class ManualSubscriptionUpdate(BaseModel):
    status: Optional[str] = None
    extend_days: int = 0


# ═══════════════════════════════════════════════════════════════════════
# 退换登记 Schema
# ═══════════════════════════════════════════════════════════════════════

class CheckInRequest(BaseModel):
    location: str = ""
    remark: str = ""

class MonthlyAttendanceStats(BaseModel):
    total_days: int = 0
    normal_days: int = 0
    late_days: int = 0
    early_days: int = 0
    absent_days: int = 0


# ── 任务看板 ─────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "normal"
    assignee_id: Optional[int] = None
    due_date: str = ""

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[str] = None
    sort_order: Optional[int] = None

class TaskOut(BaseModel):
    id: int
    company_id: Optional[int] = None
    title: str
    description: str = ""
    status: str = "todo"
    priority: str = "normal"
    assignee_id: Optional[int] = None
    assignee_name: str = ""
    due_date: str = ""
    sort_order: int = 0
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 统计报表 ─────────────────────────────────────────────────────────

class TicketTrendItem(BaseModel):
    month: str
    count: int

class ModuleDistributionItem(BaseModel):
    name: str
    count: int

class DashboardStatsOut(BaseModel):
    ticket_trend: list[TicketTrendItem] = []
    module_distribution: list[ModuleDistributionItem] = []
    ticket_status_distribution: list[ModuleDistributionItem] = []
    today_attendance: int = 0
    total_tasks: int = 0
    pending_tasks: int = 0


# ── 钉钉考勤 ─────────────────────────────────────────────────────────

class DingtalkConfigIn(BaseModel):
    app_key: Optional[str] = None
    app_secret: Optional[str] = None
    enabled: Optional[bool] = None
