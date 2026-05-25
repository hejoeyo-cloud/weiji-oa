from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

class WarehouseProduct(Base):
    """货品信息"""
    __tablename__ = "warehouse_products"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    code = Column(String(50), unique=True, nullable=False)   # 产品编码
    category = Column(String(50), default="")               # 类别
    name = Column(String(200), nullable=False)               # 产品名称
    spec = Column(String(200), default="")                  # 产品规格
    location = Column(String(100), default="")              # 货架/位置
    initial_qty = Column(Integer, default=0)                 # 期初库存
    unit = Column(String(20), default="个")                  # 单位
    remark = Column(Text, default="")                       # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])

class WarehouseInbound(Base):
    """入库明细"""
    __tablename__ = "warehouse_inbound"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    date = Column(String(20), default="")                    # 日期
    product_id = Column(Integer, ForeignKey("warehouse_products.id"), nullable=False, index=True)
    product_code = Column(String(50), default="")           # 产品编码（冗余，方便查询）
    category = Column(String(50), default="")               # 类别
    product_name = Column(String(200), default="")          # 产品名称
    spec = Column(String(200), default="")                  # 产品规格
    location = Column(String(100), default="")              # 位置
    quantity = Column(Integer, default=0)                    # 入库数量
    operator = Column(String(50), default="")               # 入库人
    remark = Column(Text, default="")                       # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    product = relationship("WarehouseProduct", foreign_keys=[product_id])
    feedbacks = relationship("WarehouseInboundFeedback", back_populates="record", cascade="all, delete-orphan")

class WarehouseOutbound(Base):
    """出库明细"""
    __tablename__ = "warehouse_outbound"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    date = Column(String(20), default="")                    # 日期
    product_id = Column(Integer, ForeignKey("warehouse_products.id"), nullable=False, index=True)
    product_code = Column(String(50), default="")           # 产品编码（冗余）
    category = Column(String(50), default="")               # 类别
    product_name = Column(String(200), default="")          # 产品名称
    spec = Column(String(200), default="")                  # 产品规格
    location = Column(String(100), default="")              # 位置
    quantity = Column(Integer, default=0)                    # 出库数量
    operator = Column(String(50), default="")               # 出库人
    remark = Column(Text, default="")                       # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    product = relationship("WarehouseProduct", foreign_keys=[product_id])
    feedbacks = relationship("WarehouseOutboundFeedback", back_populates="record", cascade="all, delete-orphan")


# ── 仓储处理记录 ─────────────────────────────────────────────────────────

class WarehouseInboundFeedback(Base):
    """入库记录的处理记录（工作留痕）"""
    __tablename__ = "warehouse_inbound_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("warehouse_inbound.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("WarehouseInbound", back_populates="feedbacks")
    user = relationship("User")

class WarehouseOutboundFeedback(Base):
    """出库记录的处理记录（工作留痕）"""
    __tablename__ = "warehouse_outbound_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("warehouse_outbound.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("WarehouseOutbound", back_populates="feedbacks")
    user = relationship("User")


# ── 财务业务 ─────────────────────────────────────────────────────────────
