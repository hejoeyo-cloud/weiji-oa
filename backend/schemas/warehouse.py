from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class WarehouseProductCreate(BaseModel):
    code: str
    category: str = ""
    name: str
    spec: str = ""
    location: str = ""
    initial_qty: int = 0
    unit: str = "个"
    remark: str = ""

class WarehouseProductUpdate(BaseModel):
    code: Optional[str] = None
    category: Optional[str] = None
    name: Optional[str] = None
    spec: Optional[str] = None
    location: Optional[str] = None
    initial_qty: Optional[int] = None
    unit: Optional[str] = None
    remark: Optional[str] = None

class WarehouseInboundCreate(BaseModel):
    date: str = ""
    product_id: int
    quantity: int
    operator: str = ""
    remark: str = ""

class WarehouseInboundUpdate(BaseModel):
    date: Optional[str] = None
    quantity: Optional[int] = None
    operator: Optional[str] = None
    remark: Optional[str] = None

class WarehouseInboundOut(BaseModel):
    id: int
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    operator: str = ""
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WarehouseOutboundCreate(BaseModel):
    date: str = ""
    product_id: int
    quantity: int
    operator: str = ""
    remark: str = ""

class WarehouseOutboundUpdate(BaseModel):
    date: Optional[str] = None
    quantity: Optional[int] = None
    operator: Optional[str] = None
    remark: Optional[str] = None

class WarehouseOutboundOut(BaseModel):
    id: int
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    operator: str = ""
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 操作日志 ─────────────────────────────────────────────────────────

class WarehouseProductCreate(BaseModel):
    code: str = ""
    category: str = ""
    name: str = ""
    spec: str = ""
    location: str = ""
    initial_qty: int = 0
    unit: str = "个"
    remark: str = ""

class WarehouseProductUpdate(BaseModel):
    code: Optional[str] = None
    category: Optional[str] = None
    name: Optional[str] = None
    spec: Optional[str] = None
    location: Optional[str] = None
    initial_qty: Optional[int] = None
    unit: Optional[str] = None
    remark: Optional[str] = None

class WarehouseProductOut(BaseModel):
    id: int
    code: str = ""
    category: str = ""
    name: str = ""
    spec: str = ""
    location: str = ""
    initial_qty: int = 0
    unit: str = "个"
    remark: str = ""
    inbound_qty: int = 0       # 计算字段：累计入库
    outbound_qty: int = 0      # 计算字段：累计出库
    current_qty: int = 0       # 计算字段：当前库存 = initial + inbound - outbound
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WarehouseInboundCreate(BaseModel):
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    operator: str = ""
    remark: str = ""

class WarehouseInboundUpdate(BaseModel):
    date: Optional[str] = None
    product_id: Optional[int] = None
    product_code: Optional[str] = None
    category: Optional[str] = None
    product_name: Optional[str] = None
    spec: Optional[str] = None
    location: Optional[str] = None
    quantity: Optional[int] = None
    operator: Optional[str] = None
    remark: Optional[str] = None

class WarehouseInboundOut(BaseModel):
    id: int
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    operator: str = ""
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WarehouseOutboundCreate(BaseModel):
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    operator: str = ""
    remark: str = ""

class WarehouseOutboundUpdate(BaseModel):
    date: Optional[str] = None
    product_id: Optional[int] = None
    product_code: Optional[str] = None
    category: Optional[str] = None
    product_name: Optional[str] = None
    spec: Optional[str] = None
    location: Optional[str] = None
    quantity: Optional[int] = None
    operator: Optional[str] = None
    remark: Optional[str] = None

class WarehouseOutboundOut(BaseModel):
    id: int
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    operator: str = ""
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 仓储处理记录（入库） ─────────────────────────────────────────────────

class WarehouseInboundFeedbackCreate(BaseModel):
    content: str = ""

class WarehouseInboundFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


# ── 仓储处理记录（出库） ─────────────────────────────────────────────────

class WarehouseOutboundFeedbackCreate(BaseModel):
    content: str = ""

class WarehouseOutboundFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


# ── 返厂出库 ─────────────────────────────────────────────────────────

class WarehouseReturnToFactoryCreate(BaseModel):
    date: str = ""
    product_id: int
    quantity: int = 0
    reason: str = ""
    operator: str = ""
    remark: str = ""

class WarehouseReturnToFactoryUpdate(BaseModel):
    date: Optional[str] = None
    product_id: Optional[int] = None
    quantity: Optional[int] = None
    reason: Optional[str] = None
    status: Optional[str] = None
    operator: Optional[str] = None
    remark: Optional[str] = None

class WarehouseReturnToFactoryOut(BaseModel):
    id: int
    date: str = ""
    product_id: int
    product_code: str = ""
    category: str = ""
    product_name: str = ""
    spec: str = ""
    location: str = ""
    quantity: int = 0
    reason: str = ""
    status: str = "repairing"
    repaired_at: Optional[datetime] = None
    operator: str = ""
    remark: str = ""
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WarehouseReturnToFactoryFeedbackCreate(BaseModel):
    content: str = ""

class WarehouseReturnToFactoryFeedbackOut(BaseModel):
    id: int
    record_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True


# ── 角色管理 ─────────────────────────────────────────────────────────
