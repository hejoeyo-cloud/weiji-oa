from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from .base import Base


class Shop(Base):
    """店铺（按公司隔离）"""
    __tablename__ = "shops"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(200), nullable=False, default="")
    created_at = Column(DateTime, default=datetime.now)
