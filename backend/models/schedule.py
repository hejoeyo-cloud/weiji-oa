from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

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
    applicant_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)   # 申请人
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
