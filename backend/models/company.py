from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    status = Column(String(30), default="active")          # active/disabled
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    users = relationship("User", back_populates="company")
    subscription = relationship("Subscription", back_populates="company", uselist=False)

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), unique=True, nullable=False, index=True)
    status = Column(String(30), default="trial")           # trial/active/grace/expired/disabled
    trial_start_at = Column(DateTime, nullable=True)
    trial_end_at = Column(DateTime, nullable=True)
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    grace_end_at = Column(DateTime, nullable=True)
    first_paid_at = Column(DateTime, nullable=True)
    last_paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    company = relationship("Company", back_populates="subscription")
    orders = relationship("PaymentOrder", back_populates="subscription")

class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(64), unique=True, nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    plan_type = Column(String(30), default="first_year")   # first_year/renewal
    amount = Column(Float, default=0)
    years = Column(Integer, default=1)
    status = Column(String(30), default="pending")         # pending/paid/cancelled/failed
    alipay_trade_no = Column(String(100), default="")
    alipay_payload = Column(Text, default="")
    paid_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    company = relationship("Company")
    subscription = relationship("Subscription", back_populates="orders")
    creator = relationship("User", foreign_keys=[created_by])


# ── 角色（需在 User 之前定义） ────────────────────────────────────────
