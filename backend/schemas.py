from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    company_name: str
    email: str
    username: str = ""
    password: str
    name: str


class SubscriptionInfo(BaseModel):
    status: str = "trial"
    trial_end_at: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    grace_end_at: Optional[datetime] = None
    is_writable: bool = True
    days_remaining: int = 0


class LoginResponse(BaseModel):
    token: str
    user: "UserInfo"


class UserInfo(BaseModel):
    id: int
    company_id: Optional[int] = None
    company_name: str = ""
    is_platform_admin: bool = False
    email: str = ""
    username: str
    name: str
    note: str
    role: str
    role_label: str = ""           # 角色显示名称
    role_color: str = "#1677FF"    # 角色颜色
    permissions: List[str] = []    # 权限列表
    department_id: Optional[int] = None
    is_manager: bool = False
    created_at: Optional[datetime] = None
    subscription: Optional[SubscriptionInfo] = None

    class Config:
        from_attributes = True


class CreateUserRequest(BaseModel):
    email: str = ""
    username: str = ""
    password: str
    name: str
    note: str = ""
    role: str = "customer"
    department_id: Optional[int] = None
    is_manager: bool = False


class TicketCreate(BaseModel):
    platform: str = ""
    customer_id: str = ""
    description: str = ""
    images: List[str] = []
    remote_tool: str = "netease"
    remote_code: str = ""
    verify_code: str = ""
    priority: str = "medium"
    diagnosis_result: str = ""
    diagnosis_log: List[dict] = []


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[int] = None
    diagnosis_result: Optional[str] = None


class FeedbackCreate(BaseModel):
    content: str = ""
    feedback_type: str = "progress"


class TicketFeedbackOut(BaseModel):
    id: int
    ticket_id: int
    user_id: int
    content: str
    feedback_type: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


class TicketOut(BaseModel):
    id: int
    platform: str
    customer_id: str
    description: str
    images: List[str]
    remote_tool: str
    remote_code: str
    verify_code: str
    priority: str
    status: str
    diagnosis_result: str
    diagnosis_log: List[dict]
    created_by: int
    assigned_to: Optional[int]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    completed_at: Optional[datetime]
    creator_name: str = ""
    assignee_name: Optional[str] = ""
    feedbacks: List[TicketFeedbackOut] = []

    class Config:
        from_attributes = True


class NotificationOut(BaseModel):
    id: int
    user_id: int
    ticket_id: Optional[int]
    resource_type: str = ""
    resource_id: Optional[int] = None
    title: str
    content: str
    is_read: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class KnowledgeCategoryCreate(BaseModel):
    name: str
    icon: str = ""
    sort_order: int = 0


class KnowledgeCategoryOut(BaseModel):
    id: int
    name: str
    icon: str
    sort_order: int
    article_count: int = 0

    class Config:
        from_attributes = True


class KnowledgeArticleCreate(BaseModel):
    category_id: int
    title: str
    problem_desc: str = ""
    solution_steps: List[str] = []
    keywords: str = ""
    images: List[str] = []


class KnowledgeArticleUpdate(BaseModel):
    category_id: Optional[int] = None
    title: Optional[str] = None
    problem_desc: Optional[str] = None
    solution_steps: Optional[List[str]] = None
    keywords: Optional[str] = None
    images: Optional[List[str]] = None


class KnowledgeArticleOut(BaseModel):
    id: int
    category_id: int
    category_name: str = ""
    title: str
    problem_desc: str
    solution_steps: List[str]
    keywords: str
    images: List[str] = []
    created_by: Optional[int]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


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
class DepartmentCreate(BaseModel):
    name: str
    description: str = ""
    sort_order: int = 0


class DepartmentOut(BaseModel):
    id: int
    name: str
    description: str
    sort_order: int
    member_count: int = 0

    class Config:
        from_attributes = True


# ── 用户（扩展，带部门信息） ─────────────────────────────────────────
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
class AfterSalesCreate(BaseModel):
    apply_date: str = ""
    order_no: str = ""
    return_reason: str = ""
    size: str = ""
    model: str = ""
    config: str = ""
    computer_price: float = 0
    quantity: int = 1
    accessories: str = ""
    accessories_price: float = 0
    customer_info: str = ""
    return_tracking: str = ""
    send_tracking: str = ""
    handle_result: str = ""
    progress: str = "pending"
    charge_required: bool = False
    charge_status: str = "none"
    current_expected_amount: float = 0
    current_paid_amount: float = 0
    last_charge_request_id: Optional[int] = None
    disassembly_feedback: str = ""
    shipping_fee: float = 0
    remark: str = ""
    record_type: str = ""


class AfterSalesUpdate(BaseModel):
    apply_date: Optional[str] = None
    order_no: Optional[str] = None
    return_reason: Optional[str] = None
    size: Optional[str] = None
    model: Optional[str] = None
    config: Optional[str] = None
    computer_price: Optional[float] = None
    quantity: Optional[int] = None
    accessories: Optional[str] = None
    accessories_price: Optional[float] = None
    customer_info: Optional[str] = None
    return_tracking: Optional[str] = None
    send_tracking: Optional[str] = None
    handle_result: Optional[str] = None
    progress: Optional[str] = None
    charge_required: Optional[bool] = None
    charge_status: Optional[str] = None
    current_expected_amount: Optional[float] = None
    current_paid_amount: Optional[float] = None
    last_charge_request_id: Optional[int] = None
    disassembly_feedback: Optional[str] = None
    shipping_fee: Optional[float] = None
    remark: Optional[str] = None
    record_type: Optional[str] = None


class AfterSalesOut(BaseModel):
    id: int
    apply_date: str = ""
    order_no: str = ""
    return_reason: str = ""
    size: str = ""
    model: str = ""
    config: str = ""
    computer_price: float = 0
    quantity: int = 1
    accessories: str = ""
    accessories_price: float = 0
    customer_info: str = ""
    return_tracking: str = ""
    send_tracking: str = ""
    handle_result: str = ""
    progress: str = "pending"
    charge_required: bool = False
    charge_status: str = "none"
    current_expected_amount: float = 0
    current_paid_amount: float = 0
    last_charge_request_id: Optional[int] = None
    disassembly_feedback: str = ""
    shipping_fee: float = 0
    remark: str = ""
    record_type: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AfterSalesFeedbackCreate(BaseModel):
    content: str = ""


class AfterSalesFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


class AfterSalesChargeRequestCreate(BaseModel):
    expected_amount: float = 0
    charge_note: str = ""


class AfterSalesChargeRequestPaid(BaseModel):
    paid_amount: float = 0
    amount_change_note: str = ""


class AfterSalesChargeRequestCancel(BaseModel):
    reason: str = ""


class AfterSalesChargeRequestOut(BaseModel):
    id: int
    after_sales_record_id: int
    status: str
    expected_amount: float = 0
    paid_amount: float = 0
    charge_note: str = ""
    amount_change_note: str = ""
    created_by: int
    created_by_name: str = ""
    paid_by: Optional[int] = None
    paid_by_name: str = ""
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 发货登记（原赠品登记） ──────────────────────────────────────────
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
class GiftCashbackCreate(BaseModel):
    order_no: str = ""
    cashback_amount: float = 0
    reason: str = ""
    remark: str = ""
    applicant: str = ""


class GiftCashbackUpdate(BaseModel):
    order_no: Optional[str] = None
    cashback_amount: Optional[float] = None
    reason: Optional[str] = None
    remark: Optional[str] = None
    applicant: Optional[str] = None


class GiftCashbackOut(BaseModel):
    id: int
    order_no: str = ""
    cashback_amount: float = 0
    reason: str = ""
    remark: str = ""
    applicant: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GiftFeedbackCreate(BaseModel):
    content: str = ""


class GiftFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


# ── 礼品补发登记 ─────────────────────────────────────────────────────
class GiftResendCreate(BaseModel):
    apply_date: str = ""
    order_no: str = ""
    shop_name: str = ""
    type: str = ""
    gift_detail: str = ""
    customer_info: str = ""
    express_company: str = ""
    tracking_no: str = ""
    remark: str = ""


class GiftResendUpdate(BaseModel):
    apply_date: Optional[str] = None
    order_no: Optional[str] = None
    shop_name: Optional[str] = None
    type: Optional[str] = None
    gift_detail: Optional[str] = None
    customer_info: Optional[str] = None
    express_company: Optional[str] = None
    tracking_no: Optional[str] = None
    remark: Optional[str] = None


class GiftResendOut(BaseModel):
    id: int
    apply_date: str = ""
    order_no: str = ""
    shop_name: str = ""
    type: str = ""
    gift_detail: str = ""
    customer_info: str = ""
    express_company: str = ""
    tracking_no: str = ""
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GiftResendFeedbackCreate(BaseModel):
    content: str = ""


class GiftResendFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


# ── 仓储业务 ─────────────────────────────────────────────────────────
class WarehouseProductCreate(BaseModel):
    code: str
    category: str = ""
    name: str
    spec: str = ""
    location: str = ""
    initial_qty: int = 0
    unit: str = "个"
    remark: str = ""


class WarehouseProductUpdate(BaseModel):
    code: Optional[str] = None
    category: Optional[str] = None
    name: Optional[str] = None
    spec: Optional[str] = None
    location: Optional[str] = None
    initial_qty: Optional[int] = None
    unit: Optional[str] = None
    remark: Optional[str] = None


class WarehouseInboundCreate(BaseModel):
    date: str = ""
    product_id: int
    quantity: int
    operator: str = ""
    remark: str = ""


class WarehouseInboundUpdate(BaseModel):
    date: Optional[str] = None
    quantity: Optional[int] = None
    operator: Optional[str] = None
    remark: Optional[str] = None


class WarehouseInboundOut(BaseModel):
    id: int
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    operator: str = ""
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WarehouseOutboundCreate(BaseModel):
    date: str = ""
    product_id: int
    quantity: int
    operator: str = ""
    remark: str = ""


class WarehouseOutboundUpdate(BaseModel):
    date: Optional[str] = None
    quantity: Optional[int] = None
    operator: Optional[str] = None
    remark: Optional[str] = None


class WarehouseOutboundOut(BaseModel):
    id: int
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    operator: str = ""
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 操作日志 ─────────────────────────────────────────────────────────
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
class AnnouncementCreate(BaseModel):
    title: str
    content: str = ""
    is_pinned: bool = False
    target_departments: List[int] = []  # 目标部门ID列表，空列表表示全员


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_active: Optional[bool] = None
    target_departments: Optional[List[int]] = None


class AnnouncementOut(BaseModel):
    id: int
    title: str
    content: str
    is_pinned: bool
    is_active: bool
    target_departments: List[int] = []
    target_department_names: str = ""   # 逗号分隔的部门名称
    created_by: Optional[int]
    author_name: str = ""
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    is_read: bool = False          # 当前用户是否已读

    class Config:
        from_attributes = True


# ── 审批流程 ─────────────────────────────────────────────────────────
class ApprovalStepOut(BaseModel):
    id: int
    step_order: int
    approver_id: Optional[int]
    approver_name: str = ""
    status: str
    comment: str
    approved_at: Optional[datetime]

    class Config:
        from_attributes = True


class ApprovalRequestCreate(BaseModel):
    type: str = "leave"           # leave / reimbursement / purchase
    title: str = ""
    description: str = ""
    amount: Optional[float] = None
    start_date: str = ""
    end_date: str = ""
    attachments: List[str] = []
    approver_ids: List[int] = []  # 审批人列表（按顺序）


class ApprovalRequestOut(BaseModel):
    id: int
    type: str
    title: str
    description: str
    amount: Optional[float]
    start_date: str
    end_date: str
    attachments: List[str] = []
    status: str
    applicant_id: Optional[int]
    applicant_name: str = ""
    steps: List[ApprovalStepOut] = []
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ApprovalAction(BaseModel):
    action: str = "approve"   # approve / reject / return / countersign / reassign
    comment: str = ""
    reassign_to: Optional[int] = None


# ── 排班管理 ─────────────────────────────────────────────────────────
class ScheduleShiftCreate(BaseModel):
    name: str
    short_name: str = ""
    color: str = "#1677FF"
    start_time: str = ""
    end_time: str = ""
    sort_order: int = 0
    is_rest: bool = False


class ScheduleShiftUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    color: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    sort_order: Optional[int] = None
    is_rest: Optional[bool] = None


class ScheduleShiftOut(BaseModel):
    id: int
    name: str
    short_name: str
    color: str
    start_time: str
    end_time: str
    sort_order: int
    is_rest: bool

    class Config:
        from_attributes = True


class ScheduleSlotCreate(BaseModel):
    user_id: int
    date: str                  # YYYY-MM-DD
    shift_id: int


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


class ScheduleSlotOut(BaseModel):
    id: int
    user_id: int
    user_name: str = ""
    date: str
    shift_id: int
    shift_name: str = ""
    shift_short_name: str = ""
    shift_color: str = "#1677FF"
    shift_is_rest: bool = False

    class Config:
        from_attributes = True


class ShiftSwapRequestCreate(BaseModel):
    target_user_id: int
    applicant_date: str        # 申请人想换出的日期
    target_date: str           # 目标人的日期
    reason: str = ""


class ShiftSwapAction(BaseModel):
    action: str = "approve"    # approve / reject
    comment: str = ""


class ShiftSwapRequestOut(BaseModel):
    id: int
    applicant_id: int
    applicant_name: str = ""
    target_user_id: int
    target_user_name: str = ""
    applicant_date: str
    target_date: str
    reason: str
    status: str                # pending/approved/rejected/cancelled
    reviewer_id: Optional[int] = None
    reviewer_name: str = ""
    review_comment: str = ""
    reviewed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 仓储业务 ─────────────────────────────────────────────────────────
class WarehouseProductCreate(BaseModel):
    code: str = ""
    category: str = ""
    name: str = ""
    spec: str = ""
    location: str = ""
    initial_qty: int = 0
    unit: str = "个"
    remark: str = ""


class WarehouseProductUpdate(BaseModel):
    code: Optional[str] = None
    category: Optional[str] = None
    name: Optional[str] = None
    spec: Optional[str] = None
    location: Optional[str] = None
    initial_qty: Optional[int] = None
    unit: Optional[str] = None
    remark: Optional[str] = None


class WarehouseProductOut(BaseModel):
    id: int
    code: str = ""
    category: str = ""
    name: str = ""
    spec: str = ""
    location: str = ""
    initial_qty: int = 0
    unit: str = "个"
    remark: str = ""
    inbound_qty: int = 0       # 计算字段：累计入库
    outbound_qty: int = 0      # 计算字段：累计出库
    current_qty: int = 0       # 计算字段：当前库存 = initial + inbound - outbound
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WarehouseInboundCreate(BaseModel):
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    operator: str = ""
    remark: str = ""


class WarehouseInboundUpdate(BaseModel):
    date: Optional[str] = None
    product_id: Optional[int] = None
    product_code: Optional[str] = None
    category: Optional[str] = None
    product_name: Optional[str] = None
    spec: Optional[str] = None
    location: Optional[str] = None
    quantity: Optional[int] = None
    operator: Optional[str] = None
    remark: Optional[str] = None


class WarehouseInboundOut(BaseModel):
    id: int
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    operator: str = ""
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WarehouseOutboundCreate(BaseModel):
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    operator: str = ""
    remark: str = ""


class WarehouseOutboundUpdate(BaseModel):
    date: Optional[str] = None
    product_id: Optional[int] = None
    product_code: Optional[str] = None
    category: Optional[str] = None
    product_name: Optional[str] = None
    spec: Optional[str] = None
    location: Optional[str] = None
    quantity: Optional[int] = None
    operator: Optional[str] = None
    remark: Optional[str] = None


class WarehouseOutboundOut(BaseModel):
    id: int
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    operator: str = ""
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 仓储处理记录（入库） ─────────────────────────────────────────────────
class WarehouseInboundFeedbackCreate(BaseModel):
    content: str = ""


class WarehouseInboundFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


# ── 仓储处理记录（出库） ─────────────────────────────────────────────────
class WarehouseOutboundFeedbackCreate(BaseModel):
    content: str = ""


class WarehouseOutboundFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


# ── 角色管理 ─────────────────────────────────────────────────────────
class RoleCreate(BaseModel):
    name: str                           # 角色标识（如 warehouse）
    label: str                          # 显示名称（如 仓库管理）
    color: str = "#1677FF"              # 显示颜色
    permissions: List[str] = []         # 权限列表


class RoleUpdate(BaseModel):
    label: Optional[str] = None
    color: Optional[str] = None
    permissions: Optional[List[str]] = None


class RoleOut(BaseModel):
    id: int
    name: str
    label: str
    color: str
    permissions: List[str] = []
    is_builtin: bool = False
    sort_order: int = 0
    user_count: int = 0                 # 使用此角色的用户数

    class Config:
        from_attributes = True


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

class ReturnExchangeCreate(BaseModel):
    apply_date: str = ""
    order_no: str = ""
    return_reason: str = ""
    size: str = ""
    model: str = ""
    config: str = ""
    computer_price: float = 0
    quantity: int = 1
    accessories: str = ""
    accessories_price: float = 0
    customer_info: str = ""
    return_tracking: str = ""
    send_tracking: str = ""
    handle_result: str = ""
    progress: str = "pending"
    disassembly_feedback: str = ""
    shipping_fee: float = 0
    remark: str = ""
    record_type: str = ""


class ReturnExchangeUpdate(BaseModel):
    apply_date: Optional[str] = None
    order_no: Optional[str] = None
    return_reason: Optional[str] = None
    size: Optional[str] = None
    model: Optional[str] = None
    config: Optional[str] = None
    computer_price: Optional[float] = None
    quantity: Optional[int] = None
    accessories: Optional[str] = None
    accessories_price: Optional[float] = None
    customer_info: Optional[str] = None
    return_tracking: Optional[str] = None
    send_tracking: Optional[str] = None
    handle_result: Optional[str] = None
    progress: Optional[str] = None
    disassembly_feedback: Optional[str] = None
    shipping_fee: Optional[float] = None
    remark: Optional[str] = None
    record_type: Optional[str] = None


class ReturnExchangeOut(BaseModel):
    id: int
    apply_date: str = ""
    order_no: str = ""
    return_reason: str = ""
    size: str = ""
    model: str = ""
    config: str = ""
    computer_price: float = 0
    quantity: int = 1
    accessories: str = ""
    accessories_price: float = 0
    customer_info: str = ""
    return_tracking: str = ""
    send_tracking: str = ""
    handle_result: str = ""
    progress: str = "pending"
    disassembly_feedback: str = ""
    shipping_fee: float = 0
    remark: str = ""
    record_type: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReturnExchangeFeedbackCreate(BaseModel):
    content: str = ""


class ReturnExchangeFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════
# 维修登记 Schema
# ═══════════════════════════════════════════════════════════════════════

class RepairCreate(BaseModel):
    apply_date: str = ""
    order_no: str = ""
    return_reason: str = ""          # 故障描述
    model: str = ""
    config: str = ""
    quantity: int = 1
    accessories: str = ""
    customer_info: str = ""
    return_tracking: str = ""
    send_tracking: str = ""
    handle_result: str = ""
    repair_status: str = "pending_repair"  # pending_repair/processing_repair/completed_repair
    charge_required: bool = False
    charge_status: str = "none"
    current_expected_amount: float = 0
    current_paid_amount: float = 0
    last_charge_request_id: Optional[int] = None
    disassembly_feedback: str = ""
    shipping_fee: float = 0
    remark: str = ""


class RepairUpdate(BaseModel):
    apply_date: Optional[str] = None
    order_no: Optional[str] = None
    return_reason: Optional[str] = None
    model: Optional[str] = None
    config: Optional[str] = None
    quantity: Optional[int] = None
    accessories: Optional[str] = None
    customer_info: Optional[str] = None
    return_tracking: Optional[str] = None
    send_tracking: Optional[str] = None
    handle_result: Optional[str] = None
    repair_status: Optional[str] = None
    charge_required: Optional[bool] = None
    charge_status: Optional[str] = None
    current_expected_amount: Optional[float] = None
    current_paid_amount: Optional[float] = None
    last_charge_request_id: Optional[int] = None
    disassembly_feedback: Optional[str] = None
    shipping_fee: Optional[float] = None
    remark: Optional[str] = None


class RepairOut(BaseModel):
    id: int
    apply_date: str = ""
    order_no: str = ""
    return_reason: str = ""
    model: str = ""
    config: str = ""
    quantity: int = 1
    accessories: str = ""
    customer_info: str = ""
    return_tracking: str = ""
    send_tracking: str = ""
    handle_result: str = ""
    repair_status: str = "pending_repair"
    charge_required: bool = False
    charge_status: str = "none"
    current_expected_amount: float = 0
    current_paid_amount: float = 0
    last_charge_request_id: Optional[int] = None
    disassembly_feedback: str = ""
    shipping_fee: float = 0
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RepairFeedbackCreate(BaseModel):
    content: str = ""


class RepairFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


class RepairChargeRequestCreate(BaseModel):
    expected_amount: float = 0
    charge_note: str = ""


class RepairChargeRequestPaid(BaseModel):
    paid_amount: float = 0
    amount_change_note: str = ""


class RepairChargeRequestCancel(BaseModel):
    reason: str = ""


class RepairChargeRequestOut(BaseModel):
    id: int
    repair_record_id: int
    status: str
    expected_amount: float = 0
    paid_amount: float = 0
    charge_note: str = ""
    amount_change_note: str = ""
    created_by: int
    created_by_name: str = ""
    paid_by: Optional[int] = None
    paid_by_name: str = ""
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 财务业务 Schemas ──────────────────────────────────────────────────────

# 客户开票申请
class CustomerInvoiceRequestCreate(BaseModel):
    apply_date: str = ""
    order_no: str = ""
    shop_name: str = ""
    customer_name: str = ""
    tax_id: str = ""
    register_address: str = ""
    bank_account: str = ""
    invoice_type: str = "普通发票"
    invoice_content: str = ""
    amount: float = 0
    tax_rate: float = 0.03
    tax_amount: float = 0
    email: str = ""
    mail_address: str = ""
    status: str = "pending"
    remark: str = ""
    handler: str = ""
    sales_invoice_id: Optional[int] = None


class CustomerInvoiceRequestUpdate(BaseModel):
    apply_date: Optional[str] = None
    order_no: Optional[str] = None
    shop_name: Optional[str] = None
    customer_name: Optional[str] = None
    tax_id: Optional[str] = None
    register_address: Optional[str] = None
    bank_account: Optional[str] = None
    invoice_type: Optional[str] = None
    invoice_content: Optional[str] = None
    amount: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    email: Optional[str] = None
    mail_address: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    handler: Optional[str] = None
    sales_invoice_id: Optional[int] = None
    invoice_file: Optional[str] = None
    invoice_filename: Optional[str] = None


class CustomerInvoiceRequestOut(BaseModel):
    id: int
    apply_date: str = ""
    order_no: str = ""
    shop_name: str = ""
    customer_name: str = ""
    tax_id: str = ""
    register_address: str = ""
    bank_account: str = ""
    invoice_type: str = ""
    invoice_content: str = ""
    amount: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    email: str = ""
    mail_address: str = ""
    status: str = ""
    remark: str = ""
    handler: str = ""
    sales_invoice_id: Optional[int] = None
    invoice_file: str = ""
    invoice_filename: str = ""
    created_by: int
    created_by_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# 销项发票台账
class SalesInvoiceCreate(BaseModel):
    invoice_date: str = ""
    invoice_code: str = ""
    invoice_no: str = ""
    invoice_type: str = "普通发票"
    buyer_name: str = ""
    buyer_tax_id: str = ""
    invoice_content: str = ""
    amount: float = 0
    tax_rate: float = 0.03
    tax_amount: float = 0
    total_amount: float = 0
    order_no: str = ""
    shop_name: str = ""
    handler: str = ""
    remark: str = ""


class SalesInvoiceUpdate(BaseModel):
    invoice_date: Optional[str] = None
    invoice_code: Optional[str] = None
    invoice_no: Optional[str] = None
    invoice_type: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_tax_id: Optional[str] = None
    invoice_content: Optional[str] = None
    amount: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    order_no: Optional[str] = None
    shop_name: Optional[str] = None
    handler: Optional[str] = None
    remark: Optional[str] = None


class SalesInvoiceOut(BaseModel):
    id: int
    invoice_date: str = ""
    invoice_code: str = ""
    invoice_no: str = ""
    invoice_type: str = ""
    buyer_name: str = ""
    buyer_tax_id: str = ""
    invoice_content: str = ""
    amount: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    total_amount: float = 0
    order_no: str = ""
    shop_name: str = ""
    handler: str = ""
    remark: str = ""
    created_by: int
    created_by_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# 进项发票台账
class PurchaseInvoiceCreate(BaseModel):
    receive_date: str = ""
    invoice_date: str = ""
    invoice_code: str = ""
    invoice_no: str = ""
    invoice_type: str = "专用发票"
    seller_name: str = ""
    seller_tax_id: str = ""
    invoice_content: str = ""
    amount: float = 0
    tax_rate: float = 0.13
    tax_amount: float = 0
    total_amount: float = 0
    is_certified: bool = False
    certified_date: str = ""
    certification_result: str = ""
    due_date: str = ""
    related_contract: str = ""
    receiver: str = ""
    remark: str = ""


class PurchaseInvoiceUpdate(BaseModel):
    receive_date: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_code: Optional[str] = None
    invoice_no: Optional[str] = None
    invoice_type: Optional[str] = None
    seller_name: Optional[str] = None
    seller_tax_id: Optional[str] = None
    invoice_content: Optional[str] = None
    amount: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    is_certified: Optional[bool] = None
    certified_date: Optional[str] = None
    certification_result: Optional[str] = None
    due_date: Optional[str] = None
    related_contract: Optional[str] = None
    receiver: Optional[str] = None
    remark: Optional[str] = None


class PurchaseInvoiceOut(BaseModel):
    id: int
    receive_date: str = ""
    invoice_date: str = ""
    invoice_code: str = ""
    invoice_no: str = ""
    invoice_type: str = ""
    seller_name: str = ""
    seller_tax_id: str = ""
    invoice_content: str = ""
    amount: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    total_amount: float = 0
    is_certified: bool = False
    certified_date: str = ""
    certification_result: str = ""
    due_date: str = ""
    related_contract: str = ""
    receiver: str = ""
    remark: str = ""
    created_by: int
    created_by_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# 报销发票台账
class ExpenseInvoiceCreate(BaseModel):
    invoice_no: str = ""
    invoice_date: str = ""
    invoice_type: str = "普通发票"
    seller_name: str = ""
    summary: str = ""
    amount: float = 0
    tax_rate: float = 0.03
    tax_amount: float = 0
    reimbursement_amount: float = 0
    reimbursement_date: str = ""
    reimburser: str = ""
    department: str = ""
    is_paid: bool = False
    approval_id: Optional[int] = None
    remark: str = ""


class ExpenseInvoiceUpdate(BaseModel):
    invoice_no: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_type: Optional[str] = None
    seller_name: Optional[str] = None
    summary: Optional[str] = None
    amount: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    reimbursement_amount: Optional[float] = None
    reimbursement_date: Optional[str] = None
    reimburser: Optional[str] = None
    department: Optional[str] = None
    is_paid: Optional[bool] = None
    approval_id: Optional[int] = None
    remark: Optional[str] = None


class ExpenseInvoiceOut(BaseModel):
    id: int
    invoice_no: str = ""
    invoice_date: str = ""
    invoice_type: str = ""
    seller_name: str = ""
    summary: str = ""
    amount: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    reimbursement_amount: float = 0
    reimbursement_date: str = ""
    reimburser: str = ""
    department: str = ""
    is_paid: bool = False
    is_duplicate: bool = False
    approval_id: Optional[int] = None
    remark: str = ""
    created_by: int
    created_by_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 考勤打卡 ─────────────────────────────────────────────────────────
class CheckInRequest(BaseModel):
    location: str = ""
    remark: str = ""


class AttendanceRecordOut(BaseModel):
    id: int
    company_id: Optional[int] = None
    user_id: int
    user_name: str = ""
    date: str
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: str = "normal"
    source: str = "manual"
    location: str = ""
    remark: str = ""
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


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


class DingtalkConfigOut(BaseModel):
    id: int
    company_id: int
    app_key: str = ""
    app_secret_masked: str = ""
    enabled: bool = False
    last_sync_at: Optional[datetime] = None

    class Config:
        from_attributes = True
