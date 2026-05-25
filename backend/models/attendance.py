from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

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
