from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SubscriptionInfo(BaseModel):
    status: str = "trial"
    trial_end_at: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    grace_end_at: Optional[datetime] = None
    is_writable: bool = True
    days_remaining: int = 0

class CompanyOut(BaseModel):
    id: int
    name: str
    status: str
    user_count: int = 0
    subscription: Optional[SubscriptionInfo] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PaymentOrderOut(BaseModel):
    id: int
    order_no: str
    company_id: int
    company_name: str = ""
    plan_type: str
    amount: float
    years: int
    status: str
    alipay_trade_no: str = ""
    paid_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CreatePaymentOrderRequest(BaseModel):
    years: int = 1

class ManualSubscriptionUpdate(BaseModel):
    status: Optional[str] = None
    extend_days: int = 0