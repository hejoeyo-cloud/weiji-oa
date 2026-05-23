from datetime import datetime, timedelta
import json

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Float,
    ForeignKey, TypeDecorator, create_engine
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from config import DATABASE_URL


# ── 权限常量（细粒度，模块:操作） ─────────────────────────────────────
# 所有可分配的权限 key，前端和后端共用
ALL_PERMISSIONS = [
    # 工单
    "tickets:view", "tickets:create", "tickets:edit", "tickets:delete",
    # 知识库
    "knowledge:view", "knowledge:create", "knowledge:edit", "knowledge:delete",
    # 退换登记（原售后登记拆分）
    "return_exchange:view", "return_exchange:create", "return_exchange:edit", "return_exchange:delete", "return_exchange:process",
    # 维修登记
    "repair:view", "repair:create", "repair:edit", "repair:delete", "repair:process",
    # 发货登记
    "gifts:view", "gifts:create", "gifts:edit", "gifts:delete", "gifts:cost_view",
    # 返现登记
    "gift_cashback:view", "gift_cashback:create", "gift_cashback:edit", "gift_cashback:delete",
    # 礼品补发
    "gift_resend:view", "gift_resend:create", "gift_resend:edit", "gift_resend:delete",
    # 仓储业务 - 货品管理
    "warehouse_products:view", "warehouse_products:create", "warehouse_products:edit", "warehouse_products:delete",
    # 仓储业务 - 入库管理
    "warehouse_inbound:view", "warehouse_inbound:create", "warehouse_inbound:edit", "warehouse_inbound:delete",
    # 仓储业务 - 出库管理
    "warehouse_outbound:view", "warehouse_outbound:create", "warehouse_outbound:edit", "warehouse_outbound:delete",
    # 公告
    "announcements:view", "announcements:create", "announcements:edit",
    # 审批
    "approvals:view", "approvals:create", "approvals:process",
    # 排班
    "schedule:view", "schedule:create", "schedule:edit",
    # 人员管理
    "users:view", "users:create", "users:edit", "users:delete",
    # 部门管理
    "departments:view", "departments:create", "departments:edit", "departments:delete",
    # 操作日志
    "audit_logs:view",
    # 财务管理 - 客户开票申请
    "finance_invoice_request:view", "finance_invoice_request:create", "finance_invoice_request:edit", "finance_invoice_request:delete",
    # 财务管理 - 销项发票台账
    "finance_sales_invoice:view", "finance_sales_invoice:create", "finance_sales_invoice:edit", "finance_sales_invoice:delete",
    # 财务管理 - 进项发票台账
    "finance_purchase_invoice:view", "finance_purchase_invoice:create", "finance_purchase_invoice:edit", "finance_purchase_invoice:delete",
    # 财务管理 - 报销发票
    "finance_expense_invoice:view", "finance_expense_invoice:create", "finance_expense_invoice:edit", "finance_expense_invoice:delete",
    # 考勤打卡
    "attendance:view", "attendance:manage",
    # 任务看板
    "tasks:view", "tasks:create", "tasks:edit", "tasks:delete",
]

# 模块分组（用于 UI 展示）
PERMISSION_GROUPS = [
    {"key": "tickets", "label": "工单管理", "perms": ["view", "create", "edit", "delete"]},
    {"key": "knowledge", "label": "知识库", "perms": ["view", "create", "edit", "delete"]},
    {"key": "return_exchange", "label": "退换登记", "perms": ["view", "create", "edit", "delete", "process"]},
    {"key": "repair", "label": "维修登记", "perms": ["view", "create", "edit", "delete", "process"]},
    {"key": "gifts", "label": "发货登记", "perms": ["view", "create", "edit", "delete", "cost_view"]},
    {"key": "gift_cashback", "label": "返现登记", "perms": ["view", "create", "edit", "delete"]},
    {"key": "gift_resend", "label": "礼品补发", "perms": ["view", "create", "edit", "delete"]},
    {"key": "warehouse_products", "label": "仓储-货品管理", "perms": ["view", "create", "edit", "delete"]},
    {"key": "warehouse_inbound", "label": "仓储-入库管理", "perms": ["view", "create", "edit", "delete"]},
    {"key": "warehouse_outbound", "label": "仓储-出库管理", "perms": ["view", "create", "edit", "delete"]},
    {"key": "announcements", "label": "公告通知", "perms": ["view", "create", "edit"]},
    {"key": "approvals", "label": "审批管理", "perms": ["view", "create", "process"]},
    {"key": "schedule", "label": "排班管理", "perms": ["view", "create", "edit"]},
    {"key": "users", "label": "人员管理", "perms": ["view", "create", "edit", "delete"]},
    {"key": "departments", "label": "部门管理", "perms": ["view", "create", "edit", "delete"]},
    {"key": "audit_logs", "label": "操作日志", "perms": ["view"]},
    {"key": "finance_invoice_request", "label": "财务-开票申请", "perms": ["view", "create", "edit", "delete"]},
    {"key": "finance_sales_invoice", "label": "财务-销项台账", "perms": ["view", "create", "edit", "delete"]},
    {"key": "finance_purchase_invoice", "label": "财务-进项台账", "perms": ["view", "create", "edit", "delete"]},
    {"key": "finance_expense_invoice", "label": "财务-报销发票", "perms": ["view", "create", "edit", "delete"]},
    {"key": "attendance", "label": "考勤打卡", "perms": ["view", "manage"]},
    {"key": "tasks", "label": "任务看板", "perms": ["view", "create", "edit", "delete"]},
]

# 默认角色种子数据（仅 admin 为内置角色，不可删除；其他角色可自由编辑和删除）
DEFAULT_ROLES = [
    {
        "name": "admin", "label": "超级管理员", "color": "#722ED1", "is_builtin": True,
        "permissions": ALL_PERMISSIONS.copy(),
    },
    {
        "name": "technician", "label": "技术员", "color": "#1677FF", "is_builtin": False,
        "permissions": [
            "tickets:view", "tickets:create", "tickets:edit",
            "knowledge:view", "knowledge:create", "knowledge:edit", "knowledge:delete",
            "return_exchange:view", "return_exchange:create", "return_exchange:edit", "return_exchange:process",
            "repair:view", "repair:create", "repair:edit", "repair:process",
            "gifts:view", "gifts:create", "gifts:edit", "gifts:cost_view",
            "gift_cashback:view", "gift_cashback:create", "gift_cashback:edit",
            "gift_resend:view", "gift_resend:create", "gift_resend:edit",
            "warehouse_products:view", "warehouse_products:create", "warehouse_products:edit",
            "warehouse_inbound:view", "warehouse_inbound:create", "warehouse_inbound:edit",
            "warehouse_outbound:view", "warehouse_outbound:create", "warehouse_outbound:edit",
            "announcements:view",
            "approvals:view", "approvals:create",
            "schedule:view",
            "attendance:view",
            "tasks:view", "tasks:create", "tasks:edit",
        ],
    },
    {
        "name": "customer", "label": "客服", "color": "#52C41A", "is_builtin": False,
        "permissions": [
            "tickets:view", "tickets:create",
            "knowledge:view",
            "return_exchange:view", "return_exchange:create",
            "repair:view", "repair:create",
            "gifts:view", "gifts:create",
            "gift_cashback:view", "gift_cashback:create",
            "gift_resend:view", "gift_resend:create",
            "warehouse_products:view",
            "warehouse_inbound:view", "warehouse_inbound:create",
            "warehouse_outbound:view", "warehouse_outbound:create",
            "announcements:view",
            "approvals:view", "approvals:create",
            "schedule:view",
            "attendance:view",
            "tasks:view",
        ],
    },
]


class JSONType(TypeDecorator):
    """Custom JSON type that ensures proper serialization for SQLite."""
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(value, ensure_ascii=False)
        return None

    def process_result_value(self, value, dialect):
        if value is not None and isinstance(value, str):
            return json.loads(value)
        return value

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, use_insertmanyvalues=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── SaaS 公司与订阅 ──────────────────────────────────────────────────
class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    status = Column(String(30), default="active")          # active/disabled
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    users = relationship("User", back_populates="company")
    subscription = relationship("Subscription", back_populates="company", uselist=False)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), unique=True, nullable=False, index=True)
    status = Column(String(30), default="trial")           # trial/active/grace/expired/disabled
    trial_start_at = Column(DateTime, nullable=True)
    trial_end_at = Column(DateTime, nullable=True)
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    grace_end_at = Column(DateTime, nullable=True)
    first_paid_at = Column(DateTime, nullable=True)
    last_paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    company = relationship("Company", back_populates="subscription")
    orders = relationship("PaymentOrder", back_populates="subscription")


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(64), unique=True, nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    plan_type = Column(String(30), default="first_year")   # first_year/renewal
    amount = Column(Float, default=0)
    years = Column(Integer, default=1)
    status = Column(String(30), default="pending")         # pending/paid/cancelled/failed
    alipay_trade_no = Column(String(100), default="")
    alipay_payload = Column(Text, default="")
    paid_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    company = relationship("Company")
    subscription = relationship("Subscription", back_populates="orders")
    creator = relationship("User", foreign_keys=[created_by])


# ── 角色（需在 User 之前定义） ────────────────────────────────────────
class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(50), unique=True, nullable=False)   # 角色标识（如 admin / technician）
    label = Column(String(50), nullable=False)               # 显示名称（如 超级管理员）
    color = Column(String(20), default="#1677FF")            # 显示颜色
    permissions = Column(JSONType, default=list)             # 权限列表
    is_builtin = Column(Boolean, default=False)              # 内置角色不可删除
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)

    # 反向关系：拥有此角色的用户
    users = relationship("User", back_populates="role_obj")


# ── 部门（需在 User 之前定义，因 User 有 FK 引用） ────────────────────
class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    description = Column(String(200), default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)

    members = relationship("User", back_populates="department", foreign_keys="User.department_id")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    is_platform_admin = Column(Boolean, default=False)
    email = Column(String(120), unique=True, nullable=True, index=True)  # 登录邮箱（可为空兼容旧数据）
    username = Column(String(50), nullable=False)                        # 公司内昵称
    password_hash = Column(String(128), nullable=False)
    name = Column(String(50), nullable=False)
    note = Column(String(200), default="")
    role = Column(String(50), default="customer")
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    is_manager = Column(Boolean, default=False)
    dingtalk_user_id = Column(String(64), nullable=True)            # 钉钉用户ID，用于考勤数据匹配
    created_at = Column(DateTime, default=datetime.now)

    company = relationship("Company", back_populates="users", foreign_keys=[company_id])
    role_obj = relationship("Role", back_populates="users", foreign_keys=[role_id])
    department = relationship("Department", back_populates="members", foreign_keys=[department_id])


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    platform = Column(String(20), default="")
    customer_id = Column(String(50), default="")
    description = Column(Text, default="")
    images = Column(JSONType, default=list)
    remote_tool = Column(String(30), default="netease")
    remote_code = Column(String(50), default="")
    verify_code = Column(String(50), default="")
    priority = Column(String(20), default="medium")
    status = Column(String(20), default="pending")
    diagnosis_result = Column(String(20), default="")
    diagnosis_log = Column(JSONType, default=list)
    created_by = Column(Integer, ForeignKey("users.id"))
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    completed_at = Column(DateTime, nullable=True)

    creator = relationship("User", foreign_keys=[created_by])
    assignee = relationship("User", foreign_keys=[assigned_to])
    feedbacks = relationship("TicketFeedback", back_populates="ticket", cascade="all, delete-orphan")


class TicketFeedback(Base):
    __tablename__ = "ticket_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    feedback_type = Column(String(20), default="progress")
    created_at = Column(DateTime, default=datetime.now)

    ticket = relationship("Ticket", back_populates="feedbacks")
    user = relationship("User")


# ── 售后登记处理记录 ─────────────────────────────────────────────────
class AfterSalesFeedback(Base):
    """售后登记的处理记录（工作留痕）"""
    __tablename__ = "after_sales_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("after_sales_records.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("AfterSalesRecord", back_populates="feedbacks")
    user = relationship("User")


# ── 发货登记处理记录 ─────────────────────────────────────────────────
class GiftFeedback(Base):
    """发货登记的处理记录（工作留痕）"""
    __tablename__ = "gift_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("gift_records.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("GiftRecord", back_populates="feedbacks")
    user = relationship("User")


# ── 礼品补发处理记录 ─────────────────────────────────────────────────
class GiftResendFeedback(Base):
    """礼品补发的处理记录（工作留痕）"""
    __tablename__ = "gift_resend_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("gift_resend_records.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("GiftResendRecord", back_populates="feedbacks")
    user = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=True)
    resource_type = Column(String(50), default="")
    resource_id = Column(Integer, nullable=True)
    title = Column(String(100), default="")
    content = Column(Text, default="")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)


class KnowledgeCategory(Base):
    __tablename__ = "knowledge_categories"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(50), nullable=False)
    icon = Column(String(50), default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)

    articles = relationship("KnowledgeArticle", back_populates="category", cascade="all, delete-orphan")


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("knowledge_categories.id"), nullable=False)
    title = Column(String(200), nullable=False)
    problem_desc = Column(Text, default="")
    solution_steps = Column(JSONType, default=list)
    keywords = Column(String(200), default="")
    images = Column(JSONType, default=list)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    category = relationship("KnowledgeCategory", back_populates="articles")
    author = relationship("User")


class TroubleshootCategory(Base):
    __tablename__ = "troubleshoot_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    icon = Column(String(50), default="")
    sort_order = Column(Integer, default=0)


class TroubleshootStep(Base):
    __tablename__ = "troubleshoot_steps"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("troubleshoot_steps.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("troubleshoot_categories.id"), nullable=True)
    title = Column(String(200), nullable=False)
    instruction = Column(Text, default="")
    is_hardware = Column(Boolean, default=False)
    solution = Column(Text, default="")
    sort_order = Column(Integer, default=0)

    children = relationship(
        "TroubleshootStep",
        backref="parent",
        remote_side="TroubleshootStep.id",
        cascade="all, delete-orphan",
        single_parent=True,
    )


# ── 售后登记 ─────────────────────────────────────────────────────────
class AfterSalesRecord(Base):
    __tablename__ = "after_sales_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    apply_date = Column(String(20), default="")          # 申请日期
    order_no = Column(String(100), default="")           # 订单编号
    return_reason = Column(Text, default="")             # 退货原因
    size = Column(String(50), default="")                # 尺寸
    model = Column(String(200), default="")              # 型号
    config = Column(String(200), default="")             # 配置
    computer_price = Column(Float, default=0)             # 电脑价格
    quantity = Column(Integer, default=1)                # 数量
    accessories = Column(String(500), default="")        # 配件
    accessories_price = Column(Float, default=0)          # 配件价格
    customer_info = Column(Text, default="")             # 客户信息（姓名/手机/地址合并）
    return_tracking = Column(String(100), default="")    # 寄回单号
    send_tracking = Column(String(100), default="")      # 寄出新单号
    handle_result = Column(Text, default="")             # 处理结果
    progress = Column(String(50), default="pending")     # 处理进度 pending/processing/completed
    charge_required = Column(Boolean, default=False)     # 是否需要收费维修
    charge_status = Column(String(30), default="none")   # none/pending_charge/paid
    current_expected_amount = Column(Float, default=0)
    current_paid_amount = Column(Float, default=0)
    last_charge_request_id = Column(Integer, nullable=True)
    disassembly_feedback = Column(Text, default="")      # 拆件反馈
    shipping_fee = Column(Float, default=0)              # 运费
    remark = Column(Text, default="")                    # 备注
    record_type = Column(String(20), default="")          # 登记类型：return(退货)/exchange(换货)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    feedbacks = relationship("AfterSalesFeedback", back_populates="record", cascade="all, delete-orphan")
    charge_requests = relationship("AfterSalesChargeRequest", back_populates="record", cascade="all, delete-orphan")


# ── 退换登记 ─────────────────────────────────────────────────────────
class ReturnExchangeRecord(Base):
    """退换登记表（退货/换货）"""
    __tablename__ = "return_exchange_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    apply_date = Column(String(20), default="")          # 申请日期
    order_no = Column(String(100), default="")           # 订单编号
    return_reason = Column(Text, default="")             # 退货原因
    size = Column(String(50), default="")                # 尺寸
    model = Column(String(200), default="")              # 型号
    config = Column(String(200), default="")             # 配置
    computer_price = Column(Float, default=0)            # 电脑价格
    quantity = Column(Integer, default=1)                # 数量
    accessories = Column(String(500), default="")         # 配件
    accessories_price = Column(Float, default=0)         # 配件价格
    customer_info = Column(Text, default="")              # 客户信息（姓名/手机/地址合并）
    return_tracking = Column(String(100), default="")    # 寄回单号
    send_tracking = Column(String(100), default="")      # 寄出新单号
    handle_result = Column(Text, default="")             # 处理结果
    progress = Column(String(50), default="pending")     # 处理进度 pending/processing/completed
    disassembly_feedback = Column(Text, default="")      # 拆件反馈
    shipping_fee = Column(Float, default=0)              # 运费
    remark = Column(Text, default="")                    # 备注
    record_type = Column(String(20), default="")          # 登记类型：return(退货)/exchange(换货)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    feedbacks = relationship("ReturnExchangeFeedback", back_populates="record", cascade="all, delete-orphan")


class ReturnExchangeFeedback(Base):
    """退换登记的处理记录（工作留痕）"""
    __tablename__ = "return_exchange_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("return_exchange_records.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("ReturnExchangeRecord", back_populates="feedbacks")
    user = relationship("User")


# ── 维修登记 ─────────────────────────────────────────────────────────
class RepairRecord(Base):
    """维修登记表"""
    __tablename__ = "repair_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    apply_date = Column(String(20), default="")          # 申请日期
    order_no = Column(String(100), default="")           # 订单编号
    return_reason = Column(Text, default="")             # 故障描述
    model = Column(String(200), default="")              # 型号
    config = Column(String(200), default="")             # 配置
    quantity = Column(Integer, default=1)                # 数量
    accessories = Column(String(500), default="")         # 配件
    customer_info = Column(Text, default="")              # 客户信息（姓名/手机/地址合并）
    return_tracking = Column(String(100), default="")    # 寄回单号
    send_tracking = Column(String(100), default="")      # 寄出新单号
    handle_result = Column(Text, default="")             # 维修结果
    repair_status = Column(String(50), default="pending_repair")  # 维修状态 pending_repair/processing_repair/completed_repair
    charge_required = Column(Boolean, default=False)     # 是否需要收费
    charge_status = Column(String(30), default="none")   # none/pending_charge/paid
    current_expected_amount = Column(Float, default=0)
    current_paid_amount = Column(Float, default=0)
    last_charge_request_id = Column(Integer, nullable=True)
    disassembly_feedback = Column(Text, default="")      # 拆件反馈
    shipping_fee = Column(Float, default=0)              # 运费
    remark = Column(Text, default="")                    # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    feedbacks = relationship("RepairFeedback", back_populates="record", cascade="all, delete-orphan")
    charge_requests = relationship("RepairChargeRequest", back_populates="record", cascade="all, delete-orphan")


class RepairFeedback(Base):
    """维修登记的处理记录（工作留痕）"""
    __tablename__ = "repair_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("repair_records.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("RepairRecord", back_populates="feedbacks")
    user = relationship("User")


class RepairChargeRequest(Base):
    """维修收费请求"""
    __tablename__ = "repair_charge_requests"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    repair_record_id = Column(Integer, ForeignKey("repair_records.id"), nullable=False)
    status = Column(String(30), default="pending_charge")    # pending_charge/paid/cancelled
    expected_amount = Column(Float, default=0)
    paid_amount = Column(Float, default=0)
    charge_note = Column(Text, default="")
    amount_change_note = Column(Text, default="")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    paid_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    paid_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    record = relationship("RepairRecord", back_populates="charge_requests")
    creator = relationship("User", foreign_keys=[created_by])
    payer = relationship("User", foreign_keys=[paid_by])


class AfterSalesChargeRequest(Base):
    __tablename__ = "after_sales_charge_requests"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    after_sales_record_id = Column(Integer, ForeignKey("after_sales_records.id"), nullable=False)
    status = Column(String(30), default="pending_charge")    # pending_charge/paid/cancelled
    expected_amount = Column(Float, default=0)
    paid_amount = Column(Float, default=0)
    charge_note = Column(Text, default="")
    amount_change_note = Column(Text, default="")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    paid_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    paid_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    record = relationship("AfterSalesRecord", back_populates="charge_requests")
    creator = relationship("User", foreign_keys=[created_by])
    payer = relationship("User", foreign_keys=[paid_by])


# ── 赠品登记 ─────────────────────────────────────────────────────────
class GiftRecord(Base):
    """发货登记（原赠品登记）"""
    __tablename__ = "gift_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    date = Column(String(20), default="")               # 日期
    order_no = Column(String(100), default="")           # 订单编号
    size = Column(String(50), default="")                # 尺寸
    model = Column(String(200), default="")              # 型号
    config = Column(String(200), default="")             # 配置
    color = Column(String(50), default="")               # 颜色
    quantity = Column(Integer, default=1)                # 数量
    accessories = Column(String(500), default="")        # 配件
    customer_info = Column(Text, default="")             # 客户信息（姓名/手机/地址合并）
    send_tracking = Column(String(100), default="")      # 发出单号
    shipping_fee = Column(Float, default=0)              # 运费
    order_amount = Column(Float, default=0)              # 订单金额
    cost = Column(Float, default=0)                       # 产品成本
    remark = Column(Text, default="")                    # 备注
    ship_date = Column(String(20), default="")           # 出货日期
    status = Column(String(20), default="pending")       # pending/sent
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    feedbacks = relationship("GiftFeedback", back_populates="record", cascade="all, delete-orphan")


# ── 返现登记 ─────────────────────────────────────────────────────────
class GiftCashback(Base):
    """返现登记表（关联发货订单）"""
    __tablename__ = "gift_cashbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    order_no = Column(String(100), default="", index=True)   # 关联订单号
    cashback_amount = Column(Float, default=0)              # 返现金额
    reason = Column(Text, default="")                        # 返现原因
    remark = Column(Text, default="")                       # 备注
    applicant = Column(String(100), default="")             # 申请人
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])


# ── 操作日志 ─────────────────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    username = Column(String(50), default="")        # 冗余存储，防止用户删除后丢失
    action = Column(String(50), default="")          # create/update/delete
    resource_type = Column(String(50), default="")   # ticket/user/knowledge/after_sales/gift/announcement/approval
    resource_id = Column(Integer, nullable=True)
    detail = Column(Text, default="")                # JSON 格式的详细变更信息
    ip_address = Column(String(50), default="")
    created_at = Column(DateTime, default=datetime.now)

    user = relationship("User", foreign_keys=[user_id])


# ── 公告 ─────────────────────────────────────────────────────────────
class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, default="")
    is_pinned = Column(Boolean, default=False)       # 置顶
    is_active = Column(Boolean, default=True)
    target_departments = Column(Text, default="")   # 目标部门ID列表，JSON格式，空字符串表示全员
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    author = relationship("User", foreign_keys=[created_by])


class Message(Base):
    """内部邮件"""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, default="")
    is_read = Column(Boolean, default=False)
    is_draft = Column(Boolean, default=False)
    reply_to_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])


class GiftResendRecord(Base):
    """礼品补发登记"""
    __tablename__ = "gift_resend_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    apply_date = Column(String(20), default="")          # 申请时间
    order_no = Column(String(100), default="")           # 订单编号
    shop_name = Column(String(200), default="")          # 店铺名称
    type = Column(String(100), default="")               # 类型
    gift_detail = Column(Text, default="")               # 礼品明细
    customer_info = Column(Text, default="")             # 客户信息
    express_company = Column(String(100), default="")    # 快递公司
    tracking_no = Column(String(100), default="")        # 礼品寄出单号
    remark = Column(Text, default="")                    # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    feedbacks = relationship("GiftResendFeedback", back_populates="record", cascade="all, delete-orphan")


class AnnouncementRead(Base):
    """公告已读记录"""
    __tablename__ = "announcement_reads"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    read_at = Column(DateTime, default=datetime.now)

    announcement = relationship("Announcement")
    user = relationship("User")


# ── 审批流程 ─────────────────────────────────────────────────────────
class ApprovalRequest(Base):
    """审批申请（请假/报销/采购）"""
    __tablename__ = "approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    type = Column(String(20), default="leave")       # leave/reimbursement/purchase
    title = Column(String(200), default="")
    description = Column(Text, default="")
    amount = Column(Float, nullable=True)            # 金额（报销/采购用）
    start_date = Column(String(20), default="")      # 日期字符串（请假起止）
    end_date = Column(String(20), default="")
    attachments = Column(JSONType, default=list)     # 附件图片
    status = Column(String(20), default="pending")   # pending/approved/rejected/cancelled
    applicant_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    applicant = relationship("User", foreign_keys=[applicant_id])
    steps = relationship("ApprovalStep", back_populates="request", cascade="all, delete-orphan")


class ApprovalStep(Base):
    """审批步骤（支持多级）"""
    __tablename__ = "approval_steps"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    request_id = Column(Integer, ForeignKey("approval_requests.id"), nullable=False)
    step_order = Column(Integer, default=1)          # 第几级审批
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 审批人
    status = Column(String(20), default="pending")   # pending/approved/rejected
    comment = Column(Text, default="")
    approved_at = Column(DateTime, nullable=True)

    request = relationship("ApprovalRequest", back_populates="steps")
    approver = relationship("User", foreign_keys=[approver_id])


# ── 排班管理 ─────────────────────────────────────────────────────────
class ScheduleShift(Base):
    """班次类型（管理员自定义）"""
    __tablename__ = "schedule_shifts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(50), nullable=False)            # 班次名称，如 早班/中班/晚班/休息
    short_name = Column(String(10), default="")           # 简称，用于排班表显示
    color = Column(String(20), default="#1677FF")         # 显示颜色
    start_time = Column(String(10), default="")           # 开始时间，如 09:00
    end_time = Column(String(10), default="")             # 结束时间，如 18:00
    sort_order = Column(Integer, default=0)
    is_rest = Column(Boolean, default=False)              # 是否为休息班次
    created_at = Column(DateTime, default=datetime.now)


class ScheduleSlot(Base):
    """排班记录（某人某天某班次）"""
    __tablename__ = "schedule_slots"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(String(10), nullable=False)             # 日期 YYYY-MM-DD
    shift_id = Column(Integer, ForeignKey("schedule_shifts.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    user = relationship("User", foreign_keys=[user_id])
    shift = relationship("ScheduleShift", foreign_keys=[shift_id])
    creator = relationship("User", foreign_keys=[created_by])


class ShiftSwapRequest(Base):
    """换班申请"""
    __tablename__ = "shift_swap_requests"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    applicant_id = Column(Integer, ForeignKey("users.id"), nullable=False)   # 申请人
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False) # 目标换班人
    applicant_date = Column(String(10), nullable=False)  # 申请人想换出的日期
    target_date = Column(String(10), nullable=False)     # 目标人的日期（换入）
    reason = Column(Text, default="")                    # 换班原因
    status = Column(String(20), default="pending")       # pending/approved/rejected/cancelled
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)    # 审批人（管理员）
    review_comment = Column(Text, default="")            # 审批意见
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    applicant = relationship("User", foreign_keys=[applicant_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])


# ── 仓储业务 ─────────────────────────────────────────────────────────
class WarehouseProduct(Base):
    """货品信息"""
    __tablename__ = "warehouse_products"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    code = Column(String(50), unique=True, nullable=False)   # 产品编码
    category = Column(String(50), default="")               # 类别
    name = Column(String(200), nullable=False)               # 产品名称
    spec = Column(String(200), default="")                  # 产品规格
    location = Column(String(100), default="")              # 货架/位置
    initial_qty = Column(Integer, default=0)                 # 期初库存
    unit = Column(String(20), default="个")                  # 单位
    remark = Column(Text, default="")                       # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])


class WarehouseInbound(Base):
    """入库明细"""
    __tablename__ = "warehouse_inbound"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    date = Column(String(20), default="")                    # 日期
    product_id = Column(Integer, ForeignKey("warehouse_products.id"), nullable=False)
    product_code = Column(String(50), default="")           # 产品编码（冗余，方便查询）
    category = Column(String(50), default="")               # 类别
    product_name = Column(String(200), default="")          # 产品名称
    spec = Column(String(200), default="")                  # 产品规格
    location = Column(String(100), default="")              # 位置
    quantity = Column(Integer, default=0)                    # 入库数量
    operator = Column(String(50), default="")               # 入库人
    remark = Column(Text, default="")                       # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    product = relationship("WarehouseProduct", foreign_keys=[product_id])
    feedbacks = relationship("WarehouseInboundFeedback", back_populates="record", cascade="all, delete-orphan")


class WarehouseOutbound(Base):
    """出库明细"""
    __tablename__ = "warehouse_outbound"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    date = Column(String(20), default="")                    # 日期
    product_id = Column(Integer, ForeignKey("warehouse_products.id"), nullable=False)
    product_code = Column(String(50), default="")           # 产品编码（冗余）
    category = Column(String(50), default="")               # 类别
    product_name = Column(String(200), default="")          # 产品名称
    spec = Column(String(200), default="")                  # 产品规格
    location = Column(String(100), default="")              # 位置
    quantity = Column(Integer, default=0)                    # 出库数量
    operator = Column(String(50), default="")               # 出库人
    remark = Column(Text, default="")                       # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    product = relationship("WarehouseProduct", foreign_keys=[product_id])
    feedbacks = relationship("WarehouseOutboundFeedback", back_populates="record", cascade="all, delete-orphan")


# ── 仓储处理记录 ─────────────────────────────────────────────────────────
class WarehouseInboundFeedback(Base):
    """入库记录的处理记录（工作留痕）"""
    __tablename__ = "warehouse_inbound_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("warehouse_inbound.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("WarehouseInbound", back_populates="feedbacks")
    user = relationship("User")


class WarehouseOutboundFeedback(Base):
    """出库记录的处理记录（工作留痕）"""
    __tablename__ = "warehouse_outbound_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("warehouse_outbound.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("WarehouseOutbound", back_populates="feedbacks")
    user = relationship("User")


# ── 财务业务 ─────────────────────────────────────────────────────────────
class CustomerInvoiceRequest(Base):
    """电商客户开票申请台账"""
    __tablename__ = "customer_invoice_requests"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    apply_date = Column(String(20), default="")           # 申请日期
    order_no = Column(String(100), default="")            # 订单编号
    shop_name = Column(String(100), default="")           # 店铺名称
    # 客户信息
    customer_name = Column(String(100), default="")       # 客户名称（抬头）
    tax_id = Column(String(50), default="")               # 纳税人识别号
    register_address = Column(String(200), default="")    # 注册地址（专票用）
    bank_account = Column(String(200), default="")        # 开户行及账号（专票用）
    # 发票信息
    invoice_type = Column(String(20), default="普通发票") # 普通发票/专用发票/电子发票
    invoice_content = Column(String(200), default="")     # 开票内容（品名）
    amount = Column(Float, default=0)                     # 开票金额（含税）
    tax_rate = Column(Float, default=0.03)                # 税率
    tax_amount = Column(Float, default=0)                 # 税额
    # 收票信息
    email = Column(String(100), default="")               # 邮箱（电子发票）
    mail_address = Column(String(200), default="")        # 邮寄地址（实体）
    # 状态
    status = Column(String(20), default="pending")        # pending/processing/issued/mailed/signed
    remark = Column(Text, default="")                     # 备注
    handler = Column(String(50), default="")              # 经手人
    # 关联销项发票
    sales_invoice_id = Column(Integer, ForeignKey("sales_invoices.id"), nullable=True)
    # 发票附件
    invoice_file = Column(String(500), default="")            # 发票文件路径
    invoice_filename = Column(String(255), default="")        # 发票原始文件名
    # 创建信息
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    sales_invoice = relationship("SalesInvoice", foreign_keys=[sales_invoice_id])


class SalesInvoice(Base):
    """销项发票台账（已开具发票的正式登记）"""
    __tablename__ = "sales_invoices"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    invoice_date = Column(String(20), default="")         # 开票日期
    invoice_code = Column(String(50), default="")         # 发票代码
    invoice_no = Column(String(50), default="", index=True)  # 发票号码
    invoice_type = Column(String(20), default="普通发票") # 普通发票/专用发票/电子发票
    # 受票方
    buyer_name = Column(String(100), default="")          # 购方名称
    buyer_tax_id = Column(String(50), default="")         # 购方纳税人识别号
    # 金额
    invoice_content = Column(String(200), default="")     # 开票内容
    amount = Column(Float, default=0)                     # 不含税金额
    tax_rate = Column(Float, default=0.03)                # 税率
    tax_amount = Column(Float, default=0)                 # 税额
    total_amount = Column(Float, default=0)               # 价税合计
    # 关联
    order_no = Column(String(100), default="")            # 关联订单号
    shop_name = Column(String(100), default="")           # 关联店铺
    handler = Column(String(50), default="")              # 经手人
    remark = Column(Text, default="")                     # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    invoice_requests = relationship("CustomerInvoiceRequest", back_populates="sales_invoice")


class PurchaseInvoice(Base):
    """进项发票台账（公司收到的发票）"""
    __tablename__ = "purchase_invoices"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    receive_date = Column(String(20), default="")         # 收票日期
    invoice_date = Column(String(20), default="")         # 开票日期
    invoice_code = Column(String(50), default="")         # 发票代码
    invoice_no = Column(String(50), default="", index=True)  # 发票号码
    invoice_type = Column(String(20), default="专用发票") # 普通发票/专用发票/电子发票
    # 开票方
    seller_name = Column(String(100), default="")         # 销方名称
    seller_tax_id = Column(String(50), default="")        # 销方纳税人识别号
    # 金额
    invoice_content = Column(String(200), default="")     # 发票内容
    amount = Column(Float, default=0)                     # 不含税金额
    tax_rate = Column(Float, default=0.13)                # 税率
    tax_amount = Column(Float, default=0)                 # 税额
    total_amount = Column(Float, default=0)               # 价税合计
    # 认证抵扣
    is_certified = Column(Boolean, default=False)         # 是否认证
    certified_date = Column(String(20), default="")       # 认证日期
    certification_result = Column(String(20), default="") # 认证结果：认证成功/认证失败/认证中
    due_date = Column(String(20), default="")             # 抵扣到期日
    # 其他
    related_contract = Column(String(100), default="")    # 关联合同
    receiver = Column(String(50), default="")             # 收票人
    remark = Column(Text, default="")                     # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])


class ExpenseInvoice(Base):
    """费用报销发票台账（防重复报销）"""
    __tablename__ = "expense_invoices"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    invoice_no = Column(String(50), default="", index=True)  # 发票号码（用于查重）
    invoice_date = Column(String(20), default="")         # 开票日期
    invoice_type = Column(String(20), default="普通发票") # 普通发票/专用发票/电子发票
    seller_name = Column(String(100), default="")         # 开票方名称
    # 金额
    summary = Column(String(200), default="")             # 摘要/用途
    amount = Column(Float, default=0)                     # 不含税金额
    tax_rate = Column(Float, default=0.03)                # 税率
    tax_amount = Column(Float, default=0)                 # 税额
    reimbursement_amount = Column(Float, default=0)       # 报销金额（价税合计）
    # 报销信息
    reimbursement_date = Column(String(20), default="")   # 报销日期
    reimburser = Column(String(50), default="")           # 报销人
    department = Column(String(100), default="")          # 报销部门
    is_paid = Column(Boolean, default=False)              # 是否已支付
    # 重复校验（由系统自动计算）
    is_duplicate = Column(Boolean, default=False)         # 是否重复
    # 关联审批
    approval_id = Column(Integer, ForeignKey("approval_requests.id"), nullable=True)
    remark = Column(Text, default="")                     # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    approval = relationship("ApprovalRequest", foreign_keys=[approval_id])


# ── 考勤打卡 ─────────────────────────────────────────────────────
class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(String(20), nullable=False, index=True)          # YYYY-MM-DD
    check_in = Column(DateTime, nullable=True)                     # 签到时间
    check_out = Column(DateTime, nullable=True)                    # 签退时间
    status = Column(String(20), default="normal")                  # normal/late/early/absent
    source = Column(String(20), default="manual")                  # manual / dingtalk
    location = Column(String(200), default="")                     # 打卡地点
    remark = Column(String(200), default="")                       # 备注
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    user = relationship("User", foreign_keys=[user_id])


# ── 钉钉配置 ─────────────────────────────────────────────────────
class DingtalkConfig(Base):
    __tablename__ = "dingtalk_configs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, unique=True, index=True)
    app_key = Column(String(100), default="")
    app_secret = Column(String(200), default="")
    enabled = Column(Boolean, default=False)
    last_sync_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    company = relationship("Company")


# ── 任务看板

# ── 模块配置 ─────────────────────────────────────────────────────
class ModuleConfig(Base):
    __tablename__ = "module_configs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    module_key = Column(String(50), nullable=False)
    enabled = Column(Boolean, default=True)
    display_name = Column(String(50), default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    company = relationship("Company")


class FieldLabel(Base):
    """字段别名 — 公司可自定义每个模块字段的显示名"""
    __tablename__ = "field_labels"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    module_key = Column(String(50), nullable=False)
    field_name = Column(String(50), nullable=False)
    label = Column(String(50), default="")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    company = relationship("Company")


# ─────────────────────────────────────────────────────
class TaskBoard(Base):
    __tablename__ = "task_boards"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    status = Column(String(20), default="todo")                    # todo / in_progress / done
    priority = Column(String(20), default="normal")                # low / normal / high / urgent
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    due_date = Column(String(20), nullable=True)                   # YYYY-MM-DD
    sort_order = Column(Integer, default=0)                        # 看板内排序
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    assignee = relationship("User", foreign_keys=[assignee_id])
    creator = relationship("User", foreign_keys=[created_by])


def _migrate_db():
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    tenant_tables = [
        "roles", "departments", "users", "tickets", "ticket_feedbacks",
        "after_sales_feedbacks", "gift_feedbacks", "gift_resend_feedbacks",
        "notifications", "knowledge_categories", "knowledge_articles",
        "after_sales_records", "return_exchange_records", "return_exchange_feedbacks",
        "repair_records", "repair_feedbacks", "repair_charge_requests",
        "after_sales_charge_requests", "gift_records", "gift_cashbacks",
        "audit_logs", "announcements", "gift_resend_records", "announcement_reads",
        "approval_requests", "approval_steps", "schedule_shifts", "schedule_slots",
        "shift_swap_requests", "warehouse_products", "warehouse_inbound",
        "warehouse_outbound", "warehouse_inbound_feedbacks",
        "warehouse_outbound_feedbacks", "customer_invoice_requests",
        "sales_invoices", "purchase_invoices", "expense_invoices",
        "attendance_records", "task_boards",
    ]

    if "companies" not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE companies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    status VARCHAR(30) DEFAULT 'active',
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    if "subscriptions" not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE subscriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),
                    status VARCHAR(30) DEFAULT 'trial',
                    trial_start_at DATETIME,
                    trial_end_at DATETIME,
                    current_period_start DATETIME,
                    current_period_end DATETIME,
                    grace_end_at DATETIME,
                    first_paid_at DATETIME,
                    last_paid_at DATETIME,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    if "payment_orders" not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE payment_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_no VARCHAR(64) NOT NULL UNIQUE,
                    company_id INTEGER NOT NULL REFERENCES companies(id),
                    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
                    plan_type VARCHAR(30) DEFAULT 'first_year',
                    amount REAL DEFAULT 0,
                    years INTEGER DEFAULT 1,
                    status VARCHAR(30) DEFAULT 'pending',
                    alipay_trade_no VARCHAR(100) DEFAULT '',
                    alipay_payload TEXT DEFAULT '',
                    paid_at DATETIME,
                    created_by INTEGER REFERENCES users(id),
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    if "attendance_records" not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE attendance_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER REFERENCES companies(id),
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    date VARCHAR(20) NOT NULL,
                    check_in DATETIME,
                    check_out DATETIME,
                    status VARCHAR(20) DEFAULT 'normal',
                    location VARCHAR(200) DEFAULT '',
                    remark VARCHAR(200) DEFAULT '',
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()
        # Re-get existing_tables after creating new table
        existing_tables = inspector.get_table_names()

    if "task_boards" not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE task_boards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER REFERENCES companies(id),
                    title VARCHAR(200) NOT NULL,
                    description TEXT DEFAULT '',
                    status VARCHAR(20) DEFAULT 'todo',
                    priority VARCHAR(20) DEFAULT 'normal',
                    assignee_id INTEGER REFERENCES users(id),
                    due_date VARCHAR(20),
                    sort_order INTEGER DEFAULT 0,
                    created_by INTEGER REFERENCES users(id),
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    with engine.connect() as conn:
        default_company = conn.execute(text("SELECT id FROM companies WHERE name = '默认公司'")).fetchone()
        if not default_company:
            now = datetime.now()
            conn.execute(
                text("INSERT INTO companies (name, status, created_at, updated_at) VALUES ('默认公司', 'active', :now, :now)"),
                {"now": now},
            )
            conn.commit()
            default_company = conn.execute(text("SELECT id FROM companies WHERE name = '默认公司'")).fetchone()
        default_company_id = default_company[0]

    existing_tables = inspect(engine).get_table_names()
    for table_name in tenant_tables:
        if table_name in existing_tables:
            columns = [c["name"] for c in inspect(engine).get_columns(table_name)]
            if "company_id" not in columns:
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN company_id INTEGER REFERENCES companies(id)"))
                    conn.commit()
            with engine.connect() as conn:
                conn.execute(text(f"UPDATE {table_name} SET company_id = :company_id WHERE company_id IS NULL"), {"company_id": default_company_id})
                conn.commit()

    if "users" in existing_tables:
        columns = [c["name"] for c in inspect(engine).get_columns("users")]
        if "is_platform_admin" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_platform_admin INTEGER DEFAULT 0"))
                conn.commit()
        with engine.connect() as conn:
            conn.execute(text("UPDATE users SET is_platform_admin = 1 WHERE username = 'admin'"))
            conn.commit()

        if "email" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(120)"))
                conn.commit()
            with engine.connect() as conn:
                conn.execute(text("UPDATE users SET email = 'admin@fries-oa.local' WHERE username = 'admin' AND email IS NULL"))
                conn.commit()
            # 尝试移除 username 的全局唯一约束，改为添加联合唯一索引
            try:
                with engine.connect() as conn:
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_company_username ON users (company_id, username)"))
                    conn.commit()
            except:
                pass

        if "dingtalk_user_id" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN dingtalk_user_id VARCHAR(64)"))
                conn.commit()

    if "attendance_records" in existing_tables:
        columns = [c["name"] for c in inspect(engine).get_columns("attendance_records")]
        if "source" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE attendance_records ADD COLUMN source VARCHAR(20) DEFAULT 'manual'"))
                conn.commit()

    new_tables = inspect(engine).get_table_names()
    if "dingtalk_configs" not in new_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE dingtalk_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),
                    app_key VARCHAR(100) DEFAULT '',
                    app_secret VARCHAR(200) DEFAULT '',
                    enabled INTEGER DEFAULT 0,
                    last_sync_at DATETIME,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    if "module_configs" not in new_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE module_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL REFERENCES companies(id),
                    module_key VARCHAR(50) NOT NULL,
                    enabled INTEGER DEFAULT 1,
                    display_name VARCHAR(50) DEFAULT '',
                    sort_order INTEGER DEFAULT 0,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()
        new_tables = inspector.get_table_names()

    if "field_labels" not in new_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE field_labels (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL REFERENCES companies(id),
                    module_key VARCHAR(50) NOT NULL,
                    field_name VARCHAR(50) NOT NULL,
                    label VARCHAR(50) DEFAULT '',
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE dingtalk_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),
                    app_key VARCHAR(100) DEFAULT '',
                    app_secret VARCHAR(200) DEFAULT '',
                    enabled INTEGER DEFAULT 0,
                    last_sync_at DATETIME,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    with engine.connect() as conn:
        sub = conn.execute(text("SELECT id FROM subscriptions WHERE company_id = :company_id"), {"company_id": default_company_id}).fetchone()
        if not sub:
            now = datetime.now()
            period_end = now + timedelta(days=3650)
            grace_end = period_end + timedelta(days=7)
            conn.execute(text("""
                INSERT INTO subscriptions (
                    company_id, status, trial_start_at, trial_end_at,
                    current_period_start, current_period_end, grace_end_at,
                    first_paid_at, last_paid_at, created_at, updated_at
                ) VALUES (
                    :company_id, 'active', :now, :period_end,
                    :now, :period_end, :grace_end,
                    :now, :now, :now, :now
                )
            """), {"company_id": default_company_id, "now": now, "period_end": period_end, "grace_end": grace_end})
            conn.commit()

    # 旧迁移：knowledge_articles.images 列
    if 'knowledge_articles' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('knowledge_articles')]
        if 'images' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE knowledge_articles ADD COLUMN images TEXT DEFAULT '[]'"))
                conn.commit()

    # 新迁移：users 表新增 department_id 列
    if 'users' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'department_id' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN department_id INTEGER REFERENCES departments(id)"))
                conn.commit()

    # 新迁移：users 表新增 is_manager 列
    if 'users' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'is_manager' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_manager INTEGER DEFAULT 0"))
                conn.commit()
        # 将 admin 用户的 is_manager 设为 True
        with engine.connect() as conn:
            conn.execute(text("UPDATE users SET is_manager = 1 WHERE username = 'admin' AND is_manager = 0"))
            conn.commit()

    # ── 售后登记表重构迁移 ──────────────────────────────────────────
    # 旧字段：customer_name, customer_phone, platform, product_name, issue_desc,
    #         handle_result, status, images, customer_address, customer_id
    # 新字段：apply_date, return_reason, size, model, config, computer_price,
    #         quantity, accessories, accessories_price, customer_info,
    #         return_tracking, send_tracking, progress, disassembly_feedback,
    #         shipping_fee, remark
    if 'after_sales_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('after_sales_records')]
        # 如果存在旧字段 customer_name 说明还是旧结构，需要重建
        if 'customer_name' in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE after_sales_records RENAME TO after_sales_records_old"))
                conn.execute(text("""
                    CREATE TABLE after_sales_records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        apply_date VARCHAR(20) DEFAULT '',
                        order_no VARCHAR(100) DEFAULT '',
                        return_reason TEXT DEFAULT '',
                        size VARCHAR(50) DEFAULT '',
                        model VARCHAR(200) DEFAULT '',
                        config VARCHAR(200) DEFAULT '',
                        computer_price REAL DEFAULT 0,
                        quantity INTEGER DEFAULT 1,
                        accessories VARCHAR(500) DEFAULT '',
                        accessories_price REAL DEFAULT 0,
                        customer_info TEXT DEFAULT '',
                        return_tracking VARCHAR(100) DEFAULT '',
                        send_tracking VARCHAR(100) DEFAULT '',
                        handle_result TEXT DEFAULT '',
                        progress VARCHAR(50) DEFAULT 'pending',
                        disassembly_feedback TEXT DEFAULT '',
                        shipping_fee REAL DEFAULT 0,
                        remark TEXT DEFAULT '',
                        created_by INTEGER REFERENCES users(id),
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                """))
                conn.execute(text("DROP TABLE after_sales_records_old"))
                conn.commit()
        columns = [c['name'] for c in inspector.get_columns('after_sales_records')]
        after_sales_add_columns = {
            'charge_required': "ALTER TABLE after_sales_records ADD COLUMN charge_required INTEGER DEFAULT 0",
            'charge_status': "ALTER TABLE after_sales_records ADD COLUMN charge_status VARCHAR(30) DEFAULT 'none'",
            'current_expected_amount': "ALTER TABLE after_sales_records ADD COLUMN current_expected_amount REAL DEFAULT 0",
            'current_paid_amount': "ALTER TABLE after_sales_records ADD COLUMN current_paid_amount REAL DEFAULT 0",
            'last_charge_request_id': "ALTER TABLE after_sales_records ADD COLUMN last_charge_request_id INTEGER",
            'record_type': "ALTER TABLE after_sales_records ADD COLUMN record_type VARCHAR(20) DEFAULT ''",
        }
        for column_name, sql in after_sales_add_columns.items():
            if column_name not in columns:
                with engine.connect() as conn:
                    conn.execute(text(sql))
                    conn.commit()

    if 'after_sales_charge_requests' not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE after_sales_charge_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    after_sales_record_id INTEGER NOT NULL REFERENCES after_sales_records(id),
                    status VARCHAR(30) DEFAULT 'pending_charge',
                    expected_amount REAL DEFAULT 0,
                    paid_amount REAL DEFAULT 0,
                    charge_note TEXT DEFAULT '',
                    amount_change_note TEXT DEFAULT '',
                    created_by INTEGER NOT NULL REFERENCES users(id),
                    paid_by INTEGER REFERENCES users(id),
                    created_at DATETIME,
                    paid_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    # ── 退换登记表 record_type 字段迁移 ───────────────────────────
    if 'return_exchange_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('return_exchange_records')]
        if 'record_type' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE return_exchange_records ADD COLUMN record_type VARCHAR(20) DEFAULT ''"))
                conn.commit()

    # ── 发货登记表重构迁移（原赠品登记） ────────────────────────────
    # 旧字段：customer_name, customer_phone, platform, gift_name, gift_qty,
    #         activity_name, remark, status, customer_address, customer_id
    # 新字段：date, size, model, config, color, quantity, accessories,
    #         customer_info, send_tracking, shipping_fee, ship_date, order_amount, cost
    if 'gift_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('gift_records')]
        # 如果存在旧字段 customer_name 说明还是旧结构，需要重建
        if 'customer_name' in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE gift_records RENAME TO gift_records_old"))
                conn.execute(text("""
                    CREATE TABLE gift_records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date VARCHAR(20) DEFAULT '',
                        order_no VARCHAR(100) DEFAULT '',
                        size VARCHAR(50) DEFAULT '',
                        model VARCHAR(200) DEFAULT '',
                        config VARCHAR(200) DEFAULT '',
                        color VARCHAR(50) DEFAULT '',
                        quantity INTEGER DEFAULT 1,
                        accessories VARCHAR(500) DEFAULT '',
                        customer_info TEXT DEFAULT '',
                        send_tracking VARCHAR(100) DEFAULT '',
                        shipping_fee REAL DEFAULT 0,
                        order_amount REAL DEFAULT 0,
                        cost REAL DEFAULT 0,
                        remark TEXT DEFAULT '',
                        ship_date VARCHAR(20) DEFAULT '',
                        status VARCHAR(20) DEFAULT 'pending',
                        created_by INTEGER REFERENCES users(id),
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                """))
                conn.execute(text("DROP TABLE gift_records_old"))
                conn.commit()
        # 如果存在 cashback 或 profit 列，需要移除（现在有独立的返现表了）
        columns = [c['name'] for c in inspector.get_columns('gift_records')]
        if 'cashback' in columns or 'profit' in columns:
            # SQLite 不支持 DROP COLUMN，需要重建表
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE gift_records RENAME TO gift_records_old2"))
                conn.execute(text("""
                    CREATE TABLE gift_records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date VARCHAR(20) DEFAULT '',
                        order_no VARCHAR(100) DEFAULT '',
                        size VARCHAR(50) DEFAULT '',
                        model VARCHAR(200) DEFAULT '',
                        config VARCHAR(200) DEFAULT '',
                        color VARCHAR(50) DEFAULT '',
                        quantity INTEGER DEFAULT 1,
                        accessories VARCHAR(500) DEFAULT '',
                        customer_info TEXT DEFAULT '',
                        send_tracking VARCHAR(100) DEFAULT '',
                        shipping_fee REAL DEFAULT 0,
                        order_amount REAL DEFAULT 0,
                        cost REAL DEFAULT 0,
                        remark TEXT DEFAULT '',
                        ship_date VARCHAR(20) DEFAULT '',
                        status VARCHAR(20) DEFAULT 'pending',
                        created_by INTEGER REFERENCES users(id),
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                """))
                # 复制数据
                conn.execute(text("""
                    INSERT INTO gift_records (id, date, order_no, size, model, config, color, quantity,
                        accessories, customer_info, send_tracking, shipping_fee, order_amount, cost,
                        remark, ship_date, status, created_by, created_at, updated_at)
                    SELECT id, date, order_no, size, model, config, color, quantity,
                        accessories, customer_info, send_tracking, shipping_fee,
                        COALESCE(order_amount, 0), COALESCE(cost, 0),
                        remark, ship_date, status, created_by, created_at, updated_at
                    FROM gift_records_old2
                """))
                conn.execute(text("DROP TABLE gift_records_old2"))
                conn.commit()

    # 创建返现登记表
    if 'gift_cashbacks' not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE gift_cashbacks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_no VARCHAR(100) DEFAULT '',
                    cashback_amount REAL DEFAULT 0,
                    reason TEXT DEFAULT '',
                    remark TEXT DEFAULT '',
                    applicant VARCHAR(100) DEFAULT '',
                    created_by INTEGER REFERENCES users(id),
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    # ── 迁移：users 表新增 role_id 列 ──────────────────────────────
    if 'users' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'role_id' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id)"))
                conn.commit()
            # 将现有用户的 role 字符串关联到对应的 Role 记录
            _sync_user_role_ids()

    if 'notifications' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('notifications')]
        notification_add_columns = {
            'resource_type': "ALTER TABLE notifications ADD COLUMN resource_type VARCHAR(50) DEFAULT ''",
            'resource_id': "ALTER TABLE notifications ADD COLUMN resource_id INTEGER",
        }
        for column_name, sql in notification_add_columns.items():
            if column_name not in columns:
                with engine.connect() as conn:
                    conn.execute(text(sql))
                    conn.commit()

    # ── 迁移：announcements 表新增 target_departments 列 ───────────────
    if 'announcements' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('announcements')]
        if 'target_departments' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE announcements ADD COLUMN target_departments TEXT DEFAULT ''"))
                conn.commit()


def _sync_user_role_ids():
    """将现有用户的 role 字符串与 roles 表的 id 关联"""
    from sqlalchemy import text
    db = SessionLocal()
    try:
        roles = db.query(Role).all()
        role_map = {r.name: r.id for r in roles}
        users = db.query(User).filter(User.role_id.is_(None)).all()
        for u in users:
            if u.role in role_map:
                u.role_id = role_map[u.role]
        db.commit()
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_db()
    db = SessionLocal()
    from auth import get_password_hash

    default_company = db.query(Company).filter(Company.name == "默认公司").first()
    if not default_company:
        default_company = Company(name="默认公司", status="active")
        db.add(default_company)
        db.commit()
        db.refresh(default_company)

    # 种子数据：默认角色
    if db.query(Role).count() == 0:
        for r in DEFAULT_ROLES:
            db.add(Role(
                company_id=default_company.id,
                name=r["name"], label=r["label"], color=r["color"],
                permissions=r["permissions"], is_builtin=r["is_builtin"],
            ))
        db.commit()

    # 迁移：将 technician 和 customer 的 is_builtin 改为 False（仅 admin 为内置）
    for role_name in ["technician", "customer"]:
        role_obj = db.query(Role).filter(Role.name == role_name).first()
        if role_obj and role_obj.is_builtin:
            role_obj.is_builtin = False
            db.commit()

    existing = db.query(User).filter(User.username == "admin").first()
    if not existing:
        admin_role = db.query(Role).filter(Role.name == "admin").first()
        admin = User(
            company_id=default_company.id,
            is_platform_admin=True,
            email="admin@fries-oa.local",
            username="admin",
            password_hash=get_password_hash("admin"),
            name="管理员",
            role="admin",
            role_id=admin_role.id if admin_role else None,
        )
        db.add(admin)
        db.commit()
    else:
        # 确保已有 admin 用户关联 role_id
        if existing.role_id is None:
            admin_role = db.query(Role).filter(Role.name == "admin").first()
            if admin_role:
                existing.role_id = admin_role.id
                db.commit()
        if existing.company_id is None:
            existing.company_id = default_company.id
            db.commit()
        if not existing.is_platform_admin:
            existing.is_platform_admin = True
            db.commit()
        if not existing.email:
            existing.email = "admin@fries-oa.local"
            db.commit()
        # 确保 admin 的 role 字段与 role_id 一致
        if existing.role_obj and existing.role != existing.role_obj.name:
            existing.role = existing.role_obj.name
            db.commit()

    # 确保 technician 和 customer 用户也关联 role_id
    for role_name in ["technician", "customer"]:
        role_obj = db.query(Role).filter(Role.name == role_name).first()
        if role_obj:
            db.query(User).filter(User.role == role_name, User.role_id.is_(None)).update(
                {"role_id": role_obj.id}, synchronize_session=False
            )
            db.commit()

    # 种子数据：默认班次类型
    if db.query(ScheduleShift).count() == 0:
        default_shifts = [
            ScheduleShift(name="早班", short_name="早", color="#1677FF", start_time="09:00", end_time="13:00", sort_order=1, is_rest=False),
            ScheduleShift(name="中班", short_name="中", color="#52C41A", start_time="13:00", end_time="18:00", sort_order=2, is_rest=False),
            ScheduleShift(name="晚班", short_name="晚", color="#722ED1", start_time="18:00", end_time="22:00", sort_order=3, is_rest=False),
            ScheduleShift(name="全天班", short_name="全", color="#FA8C16", start_time="09:00", end_time="18:00", sort_order=4, is_rest=False),
            ScheduleShift(name="休息", short_name="休", color="#D9D9D9", start_time="", end_time="", sort_order=5, is_rest=True),
        ]
        db.add_all(default_shifts)
        db.commit()
    # 种子数据：默认模块配置
    existing_mods = db.query(ModuleConfig).filter(ModuleConfig.company_id == default_company.id).count()
    if existing_mods == 0:
        default_modules = [
            ModuleConfig(company_id=default_company.id, module_key="return_exchange", enabled=True, display_name="退换登记", sort_order=1),
            ModuleConfig(company_id=default_company.id, module_key="repair", enabled=True, display_name="维修登记", sort_order=2),
            ModuleConfig(company_id=default_company.id, module_key="gift", enabled=True, display_name="发货登记", sort_order=3),
            ModuleConfig(company_id=default_company.id, module_key="gift_cashback", enabled=True, display_name="返现登记", sort_order=4),
            ModuleConfig(company_id=default_company.id, module_key="gift_resend", enabled=True, display_name="礼品补发", sort_order=5),
        ]
        db.add_all(default_modules)
        db.commit()

    db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
