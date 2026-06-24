from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

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
    changes = Column(JSONType, default=dict)          # 字段变更对比 {"field": {"old": x, "new": y}}
    ip_address = Column(String(50), default="")
    created_at = Column(DateTime, default=datetime.now)

    user = relationship("User", foreign_keys=[user_id])


# ── 公告 ─────────────────────────────────────────────────────────────
