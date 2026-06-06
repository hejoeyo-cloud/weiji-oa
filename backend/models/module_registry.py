"""
模块统一注册表 v1.0
这是整个系统的单一真相来源（Single Source of Truth）。
新增模块只需在此添加一条记录。

与前端 frontend/src/config/moduleRegistry.ts 保持同步。
"""

from dataclasses import dataclass, field
from typing import List, Dict

@dataclass
class FieldDefinition:
    """模块字段定义"""
    name: str                          # 字段名（与数据库列/JSON key 一致）
    label: str                         # 默认显示名（中文）
    type: str = "text"                 # text | number | date | select
    options: List[str] = field(default_factory=list)  # 当 type=select 时的选项
    required: bool = False
    sort_order: int = 0

@dataclass
class ModuleDefinition:
    """模块定义 - 所有元数据的唯一来源"""
    module_key: str                    # 唯一标识，如 "return_exchange"
    display_name: str                  # 默认显示名
    icon: str                          # lucide-react 图标名，如 "RotateCcw"
    route_path: str                    # 前端路由路径，如 "/return-exchange"
    navigation_group: str              # 侧边栏分组："客服业务" | "仓储业务"
    permissions: List[str]             # 权限 key，如 ["return_exchange:view"]
    fields: List[FieldDefinition]
    sort_order: int = 0
    enabled_by_default: bool = True


# ============================================================
# 注册表 - 唯一需要修改的地方
# ============================================================

MODULE_REGISTRY: Dict[str, ModuleDefinition] = {
    "tickets": ModuleDefinition(
        module_key="tickets",
        display_name="工单系统",
        icon="Ticket",
        route_path="/tickets",
        navigation_group="客服业务",
        permissions=["tickets:view"],
        sort_order=0,
        fields=[],
    ),
    "return_exchange": ModuleDefinition(
        module_key="return_exchange",
        display_name="退换登记",
        icon="RotateCcw",
        route_path="/return-exchange",
        navigation_group="客服业务",
        permissions=["return_exchange:view"],
        sort_order=1,
        fields=[
            FieldDefinition("shop_name", "店铺", sort_order=0),
            FieldDefinition("model", "型号", sort_order=1),
            FieldDefinition("config", "配置", sort_order=2),
            FieldDefinition("size", "规格", sort_order=3),
            FieldDefinition("computer_price", "电脑价格", type="number", sort_order=4),
            FieldDefinition("accessories", "配件", sort_order=5),
            FieldDefinition("accessories_price", "配件价格", type="number", sort_order=6),
            FieldDefinition("return_tracking", "寄回单号", sort_order=7),
            FieldDefinition("send_tracking", "寄出单号", sort_order=8),
            FieldDefinition("shipping_fee", "运费", type="number", sort_order=9),
            FieldDefinition("record_type", "类型", type="select",
                          options=["退货", "换货"], sort_order=10),
        ],
    ),
    "repair": ModuleDefinition(
        module_key="repair",
        display_name="维修登记",
        icon="Wrench",
        route_path="/repair",
        navigation_group="客服业务",
        permissions=["repair:view"],
        sort_order=2,
        fields=[
            FieldDefinition("model", "型号", sort_order=1),
            FieldDefinition("config", "配置", sort_order=2),
            FieldDefinition("computer_price", "电脑价格", type="number", sort_order=3),
            FieldDefinition("accessories", "配件", sort_order=4),
            FieldDefinition("return_tracking", "寄回单号", sort_order=5),
            FieldDefinition("send_tracking", "寄出单号", sort_order=6),
            FieldDefinition("shipping_fee", "运费", type="number", sort_order=7),
        ],
    ),
    "gift": ModuleDefinition(
        module_key="gift",
        display_name="发货登记",
        icon="Gift",
        route_path="/gifts",
        navigation_group="仓储业务",
        permissions=["gift:view"],
        sort_order=1,
        fields=[
            FieldDefinition("shop_name", "店铺", sort_order=0),
            FieldDefinition("model", "型号", sort_order=1),
            FieldDefinition("config", "配置", sort_order=2),
            FieldDefinition("color", "颜色", sort_order=3),
            FieldDefinition("size", "规格", sort_order=4),
            FieldDefinition("cost", "成本", type="number", sort_order=5),
            FieldDefinition("order_amount", "订单金额", type="number", sort_order=6),
            FieldDefinition("send_tracking", "寄出单号", sort_order=7),
            FieldDefinition("shipping_fee", "运费", type="number", sort_order=8),
            FieldDefinition("ship_date", "出货日期", type="date", sort_order=9),
        ],
    ),
    "gift_cashback": ModuleDefinition(
        module_key="gift_cashback",
        display_name="返现登记",
        icon="DollarSign",
        route_path="/gift-cashback",
        navigation_group="客服业务",
        permissions=["gift_cashback:view"],
        sort_order=2,
        fields=[
            FieldDefinition("cashback_amount", "返现金额", type="number", sort_order=1),
            FieldDefinition("reason", "原因", sort_order=2),
            FieldDefinition("applicant", "申请人", sort_order=3),
        ],
    ),
    "gift_resend": ModuleDefinition(
        module_key="gift_resend",
        display_name="礼品补发",
        icon="PackageCheck",
        route_path="/gift-resend",
        navigation_group="客服业务",
        permissions=["gift_resend:view"],
        sort_order=3,
        fields=[
            FieldDefinition("shop_name", "店铺", sort_order=1),
            FieldDefinition("type", "类型", sort_order=2),
            FieldDefinition("gift_detail", "礼品明细", sort_order=3),
            FieldDefinition("express_company", "快递公司", sort_order=4),
            FieldDefinition("tracking_no", "快递单号", sort_order=5),
        ],
    ),
}
