from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

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
