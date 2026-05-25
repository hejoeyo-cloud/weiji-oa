from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

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

