"""Database proxy — re-exports from models/ for backward compatibility"""
from models.base import Base, engine, SessionLocal, JSONType
from models.permissions import ALL_PERMISSIONS, PERMISSION_GROUPS, DEFAULT_ROLES
from models import *

# Import all classes from split modules
from models.aftersales import *
from models.announcement import *
from models.approval import *
from models.attendance import *
from models.audit import *
from models.company import *
from models.finance import *
from models.gift import *
from models.knowledge import *
from models.message import *
from models.notification import *
from models.schedule import *
from models.task import *
from models.ticket import *
from models.user import *
from models.warehouse import *

from sqlalchemy.orm import Session

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
# DEFAULT_ROLES in models/permissions.py
OLD_DEFAULT_ROLES = [
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



