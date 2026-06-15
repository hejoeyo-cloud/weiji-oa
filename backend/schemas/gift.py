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

class GiftResendItem(BaseModel):
    name: str = ""
    quantity: int = 1

class GiftResendCreate(BaseModel):
    apply_date: str = ""
    order_no: str = ""
    shop_name: str = ""
    type: str = ""
    gift_detail: str = ""
    gift_items: List[GiftResendItem] = []
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
    gift_items: Optional[List[GiftResendItem]] = None
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
    gift_items: List[GiftResendItem] = []
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


# ── 发货登记 ─────────────────────────────────────────────────────

class GiftCostItem(BaseModel):
    name: str = ""
    amount: float = 0

class GiftRecordCreate(BaseModel):
    date: str = ""
    shop_name: str = ""
    order_no: str = ""
    shop_id: Optional[int] = None
    shop_name: str = ""
    product: str = ""
    size: str = ""
    model: str = ""
    config: str = ""
    color: str = ""
    quantity: int = 1
    accessories: str = ""
    customer_info: str = ""
    send_tracking: str = ""
    shipping_fee: float = 0
    order_amount: float = 0
    cost: float = 0
    gift_costs: List[GiftCostItem] = []
    remark: str = ""
    ship_date: str = ""
    status: str = "pending"

class GiftRecordUpdate(BaseModel):
    date: Optional[str] = None
    shop_name: Optional[str] = None
    order_no: Optional[str] = None
    shop_id: Optional[int] = None
    shop_name: Optional[str] = None
    product: Optional[str] = None
    size: Optional[str] = None
    model: Optional[str] = None
    config: Optional[str] = None
    color: Optional[str] = None
    quantity: Optional[int] = None
    accessories: Optional[str] = None
    customer_info: Optional[str] = None
    send_tracking: Optional[str] = None
    shipping_fee: Optional[float] = None
    order_amount: Optional[float] = None
    cost: Optional[float] = None
    gift_costs: Optional[List[GiftCostItem]] = None
    remark: Optional[str] = None
    ship_date: Optional[str] = None
    status: Optional[str] = None

class GiftRecordOut(BaseModel):
    id: int
    date: str = ""
    shop_name: str = ""
    order_no: str = ""
    shop_id: Optional[int] = None
    shop_name: str = ""
    product: str = ""
    size: str = ""
    model: str = ""
    config: str = ""
    color: str = ""
    quantity: int = 1
    accessories: str = ""
    customer_info: str = ""
    send_tracking: str = ""
    shipping_fee: float = 0
    order_amount: float = 0
    cost: float = 0
    gift_costs: List[GiftCostItem] = []
    total_gift_cost: float = 0     # 礼品成本合计
    total_cashback: float = 0      # 自动汇总的返现金额（来自返现表）
    profit: float = 0              # 利润 = 订单金额 - 产品成本 - 礼品合计 - 返现
    remark: str = ""
    ship_date: str = ""
    status: str = "pending"
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GiftPresetCreate(BaseModel):
    name: str
    items: List[GiftCostItem] = []


class GiftPresetOut(BaseModel):
    id: int
    name: str
    items: List[GiftCostItem] = []
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
