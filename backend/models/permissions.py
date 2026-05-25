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
    # 内部邮件
    "messages:view", "messages:send",
    # 审批规则
    "approval_rules:view",
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


