from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

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
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
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
