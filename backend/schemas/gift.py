from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class GiftCashbackCreate(BaseModel):
    order_no: str = ""
    cashback_amount: float = 0
    reason: str = ""
    remark: str = ""
    applicant: str = ""

class GiftCashbackUpdate(BaseModel):
    order_no: Optional[str] = None
    cashback_amount: Optional[float] = None
    reason: Optional[str] = None
    remark: Optional[str] = None
    applicant: Optional[str] = None

class GiftCashbackOut(BaseModel):
    id: int
    order_no: str = ""
    cashback_amount: float = 0
    reason: str = ""
    remark: str = ""
    applicant: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class GiftFeedbackCreate(BaseModel):
    content: str = ""

class GiftFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


# ── 礼品补发登记 ─────────────────────────────────────────────────────

class GiftResendCreate(BaseModel):
    apply_date: str = ""
    order_no: str = ""
    shop_name: str = ""
    type: str = ""
    gift_detail: str = ""
    customer_info: str = ""
    express_company: str = ""
    tracking_no: str = ""
    remark: str = ""

class GiftResendUpdate(BaseModel):
    apply_date: Optional[str] = None
    order_no: Optional[str] = None
    shop_name: Optional[str] = None
    type: Optional[str] = None
    gift_detail: Optional[str] = None
    customer_info: Optional[str] = None
    express_company: Optional[str] = None
    tracking_no: Optional[str] = None
    remark: Optional[str] = None

class GiftResendOut(BaseModel):
    id: int
    apply_date: str = ""
    order_no: str = ""
    shop_name: str = ""
    type: str = ""
    gift_detail: str = ""
    customer_info: str = ""
    express_company: str = ""
    tracking_no: str = ""
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class GiftResendFeedbackCreate(BaseModel):
    content: str = ""

class GiftResendFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


# ── 仓储业务 ─────────────────────────────────────────────────────────
