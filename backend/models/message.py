from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

class Message(Base):
    """内部邮件"""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(200), default="")
    content = Column(Text, default="")
    is_read = Column(Boolean, default=False)
    is_draft = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    is_starred = Column(Boolean, default=False)
    is_forward = Column(Boolean, default=False)
    thread_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    reply_to_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])

class MessageAttachment(Base):
    """邮件附件"""
    __tablename__ = "message_attachments"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False, index=True)
    filename = Column(String(200), default="")
    filepath = Column(String(500), default="")
    size = Column(Integer, default=0)          # 字节
    mime_type = Column(String(100), default="")
    hash = Column(String(64), default="")      # SHA-256 内容指纹，用于去重
    created_at = Column(DateTime, default=datetime.now)

    message = relationship("Message")
