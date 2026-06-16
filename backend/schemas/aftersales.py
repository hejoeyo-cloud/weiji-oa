from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AfterSalesCreate(BaseModel):
    apply_date: str = ""
    order_no: str = ""
    return_reason: str = ""
    size: str = ""
    model: str = ""
    config: str = ""
    computer_price: float = 0
    quantity: int = 1
    accessories: str = ""
    accessories_price: float = 0
    customer_info: str = ""
    return_tracking: str = ""
    send_tracking: str = ""
    handle_result: str = ""
    progress: str = "pending"
    charge_required: bool = False
    charge_status: str = "none"
    current_expected_amount: float = 0
    current_paid_amount: float = 0
    last_charge_request_id: Optional[int] = None
    disassembly_feedback: str = ""
    shipping_fee: float = 0
    remark: str = ""
    record_type: str = ""

class AfterSalesUpdate(BaseModel):
    apply_date: Optional[str] = None
    order_no: Optional[str] = None
    return_reason: Optional[str] = None
    size: Optional[str] = None
    model: Optional[str] = None
    config: Optional[str] = None
    computer_price: Optional[float] = None
    quantity: Optional[int] = None
    accessories: Optional[str] = None
    accessories_price: Optional[float] = None
    customer_info: Optional[str] = None
    return_tracking: Optional[str] = None
    send_tracking: Optional[str] = None
    handle_result: Optional[str] = None
    progress: Optional[str] = None
    charge_required: Optional[bool] = None
    charge_status: Optional[str] = None
    current_expected_amount: Optional[float] = None
    current_paid_amount: Optional[float] = None
    last_charge_request_id: Optional[int] = None
    disassembly_feedback: Optional[str] = None
    shipping_fee: Optional[float] = None
    remark: Optional[str] = None
    record_type: Optional[str] = None

class AfterSalesOut(BaseModel):
    id: int
    apply_date: str = ""
    order_no: str = ""
    return_reason: str = ""
    size: str = ""
    model: str = ""
    config: str = ""
    computer_price: float = 0
    quantity: int = 1
    accessories: str = ""
    accessories_price: float = 0
    customer_info: str = ""
    return_tracking: str = ""
    send_tracking: str = ""
    handle_result: str = ""
    progress: str = "pending"
    charge_required: bool = False
    charge_status: str = "none"
    current_expected_amount: float = 0
    current_paid_amount: float = 0
    last_charge_request_id: Optional[int] = None
    disassembly_feedback: str = ""
    shipping_fee: float = 0
    remark: str = ""
    record_type: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AfterSalesFeedbackCreate(BaseModel):
    content: str = ""

class AfterSalesFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True

class AfterSalesChargeRequestCreate(BaseModel):
    expected_amount: float = 0
    charge_note: str = ""

class AfterSalesChargeRequestPaid(BaseModel):
    paid_amount: float = 0
    amount_change_note: str = ""

class AfterSalesChargeRequestCancel(BaseModel):
    reason: str = ""

class AfterSalesChargeRequestOut(BaseModel):
    id: int
    after_sales_record_id: int
    status: str
    expected_amount: float = 0
    paid_amount: float = 0
    charge_note: str = ""
    amount_change_note: str = ""
    created_by: int
    created_by_name: str = ""
    paid_by: Optional[int] = None
    paid_by_name: str = ""
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 退换登记 ──────────────────────────────────────────────────────────

class DamageItem(BaseModel):
    name: str = ""
    amount: float = 0
    desc: str = ""

class ReturnExchangeCreate(BaseModel):
    apply_date: str = ""
    shop_name: str = ""
    order_no: str = ""
    return_reason: str = ""
    size: str = ""
    model: str = ""
    config: str = ""
    computer_price: float = 0
    quantity: int = 1
    accessories: str = ""
    accessories_price: float = 0
    customer_info: str = ""
    return_tracking: str = ""
    send_tracking: str = ""
    handle_result: str = ""
    progress: str = "pending"
    disassembly_feedback: str = ""
    shipping_fee: float = 0
    remark: str = ""
    record_type: str = ""
    has_damage: bool = False
    damage_items: List[DamageItem] = []
    claim_status: str = "none"

class ReturnExchangeUpdate(BaseModel):
    apply_date: Optional[str] = None
    shop_name: Optional[str] = None
    order_no: Optional[str] = None
    return_reason: Optional[str] = None
    size: Optional[str] = None
    model: Optional[str] = None
    config: Optional[str] = None
    computer_price: Optional[float] = None
    quantity: Optional[int] = None
    accessories: Optional[str] = None
    accessories_price: Optional[float] = None
    customer_info: Optional[str] = None
    return_tracking: Optional[str] = None
    send_tracking: Optional[str] = None
    handle_result: Optional[str] = None
    progress: Optional[str] = None
    disassembly_feedback: Optional[str] = None
    shipping_fee: Optional[float] = None
    remark: Optional[str] = None
    record_type: Optional[str] = None
    has_damage: Optional[bool] = None
    damage_items: Optional[List[DamageItem]] = None
    claim_status: Optional[str] = None

class ReturnExchangeOut(BaseModel):
    id: int
    apply_date: str = ""
    shop_name: str = ""
    order_no: str = ""
    return_reason: str = ""
    size: str = ""
    model: str = ""
    config: str = ""
    computer_price: float = 0
    quantity: int = 1
    accessories: str = ""
    accessories_price: float = 0
    customer_info: str = ""
    return_tracking: str = ""
    send_tracking: str = ""
    handle_result: str = ""
    progress: str = "pending"
    disassembly_feedback: str = ""
    shipping_fee: float = 0
    remark: str = ""
    record_type: str = ""
    has_damage: bool = False
    damage_items: List[DamageItem] = []
    total_damage_amount: float = 0
    claim_status: str = "none"
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ReturnExchangeFeedbackCreate(BaseModel):
    content: str = ""

class ReturnExchangeFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════
# 维修登记 Schema
# ═══════════════════════════════════════════════════════════════════════

class RepairCreate(BaseModel):
    apply_date: str = ""
    shop_name: str = ""
    order_no: str = ""
    return_reason: str = ""          # 故障描述
    model: str = ""
    config: str = ""
    quantity: int = 1
    accessories: str = ""
    customer_info: str = ""
    return_tracking: str = ""
    send_tracking: str = ""
    handle_result: str = ""
    repair_status: str = "pending_repair"  # pending_repair/processing_repair/completed_repair
    charge_required: bool = False
    charge_status: str = "none"
    current_expected_amount: float = 0
    current_paid_amount: float = 0
    last_charge_request_id: Optional[int] = None
    disassembly_feedback: str = ""
    shipping_fee: float = 0
    remark: str = ""

class RepairUpdate(BaseModel):
    apply_date: Optional[str] = None
    shop_name: Optional[str] = None
    order_no: Optional[str] = None
    return_reason: Optional[str] = None
    model: Optional[str] = None
    config: Optional[str] = None
    quantity: Optional[int] = None
    accessories: Optional[str] = None
    customer_info: Optional[str] = None
    return_tracking: Optional[str] = None
    send_tracking: Optional[str] = None
    handle_result: Optional[str] = None
    repair_status: Optional[str] = None
    charge_required: Optional[bool] = None
    charge_status: Optional[str] = None
    current_expected_amount: Optional[float] = None
    current_paid_amount: Optional[float] = None
    last_charge_request_id: Optional[int] = None
    disassembly_feedback: Optional[str] = None
    shipping_fee: Optional[float] = None
    remark: Optional[str] = None

class RepairOut(BaseModel):
    id: int
    apply_date: str = ""
    shop_name: str = ""
    order_no: str = ""
    return_reason: str = ""
    model: str = ""
    config: str = ""
    quantity: int = 1
    accessories: str = ""
    customer_info: str = ""
    return_tracking: str = ""
    send_tracking: str = ""
    handle_result: str = ""
    repair_status: str = "pending_repair"
    charge_required: bool = False
    charge_status: str = "none"
    current_expected_amount: float = 0
    current_paid_amount: float = 0
    last_charge_request_id: Optional[int] = None
    disassembly_feedback: str = ""
    shipping_fee: float = 0
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RepairFeedbackCreate(BaseModel):
    content: str = ""

class RepairFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True

class RepairChargeRequestCreate(BaseModel):
    expected_amount: float = 0
    charge_note: str = ""

class RepairChargeRequestPaid(BaseModel):
    paid_amount: float = 0
    amount_change_note: str = ""

class RepairChargeRequestCancel(BaseModel):
    reason: str = ""

class RepairChargeRequestOut(BaseModel):
    id: int
    repair_record_id: int
    status: str
    expected_amount: float = 0
    paid_amount: float = 0
    charge_note: str = ""
    amount_change_note: str = ""
    created_by: int
    created_by_name: str = ""
    paid_by: Optional[int] = None
    paid_by_name: str = ""
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 财务业务 Schemas ──────────────────────────────────────────────────────

# 客户开票申请
