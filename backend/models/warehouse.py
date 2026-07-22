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
    unit_price = Column(Float, default=0)                   # 进货单价
    batch_id = Column(Integer, ForeignKey("warehouse_batches.id"), nullable=True)  # 关联批次
    operator = Column(String(50), default="")               # 入库人
    remark = Column(Text, default="")                       # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    product = relationship("WarehouseProduct", foreign_keys=[product_id])
    batch = relationship("WarehouseBatch", foreign_keys=[batch_id], uselist=False)
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
    outbound_batches = relationship("WarehouseOutboundBatch", back_populates="outbound", cascade="all, delete-orphan")
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


# ── 返厂出库 ─────────────────────────────────────────────────────────────

class WarehouseReturnToFactory(Base):
    """返厂出库记录"""
    __tablename__ = "warehouse_return_to_factory"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    date = Column(String(20), default="")
    product_id = Column(Integer, ForeignKey("warehouse_products.id"), nullable=False, index=True)
    product_code = Column(String(50), default="")
    category = Column(String(50), default="")
    product_name = Column(String(200), default="")
    spec = Column(String(200), default="")
    location = Column(String(100), default="")
    quantity = Column(Integer, default=0)
    returned_quantity = Column(Integer, default=0)       # 已返库数量（支持分批返库）
    reason = Column(String(200), default="")            # 返厂原因
    status = Column(String(20), default="repairing")    # repairing=维修中, repaired=已返库
    repaired_at = Column(DateTime, nullable=True)        # 返库时间
    operator = Column(String(50), default="")
    remark = Column(Text, default="")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    product = relationship("WarehouseProduct", foreign_keys=[product_id])
    feedbacks = relationship("WarehouseReturnToFactoryFeedback", back_populates="record", cascade="all, delete-orphan")


class WarehouseReturnToFactoryFeedback(Base):
    """返厂出库备注记录"""
    __tablename__ = "warehouse_return_to_factory_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("warehouse_return_to_factory.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("WarehouseReturnToFactory", back_populates="feedbacks")
    user = relationship("User")



# -- batch management -------------------------------------------------

class WarehouseBatch(Base):
    '''product batch (tracks purchase price and remaining qty per batch)'''
    __tablename__ = 'warehouse_batches'

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey('warehouse_products.id'), nullable=False, index=True)
    batch_no = Column(String(50), nullable=False)
    unit_price = Column(Float, default=0)
    initial_quantity = Column(Integer, default=0)
    remaining_quantity = Column(Integer, default=0)
    inbound_id = Column(Integer, ForeignKey('warehouse_inbound.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    product = relationship('WarehouseProduct', foreign_keys=[product_id])
    inbound = relationship('WarehouseInbound', foreign_keys=[inbound_id], uselist=False)


class WarehouseOutboundBatch(Base):
    '''outbound batch allocation detail'''
    __tablename__ = 'warehouse_outbound_batches'

    id = Column(Integer, primary_key=True, index=True)
    outbound_id = Column(Integer, ForeignKey('warehouse_outbound.id'), nullable=False)
    batch_id = Column(Integer, ForeignKey('warehouse_batches.id'), nullable=False)
    quantity = Column(Integer, default=0)

    outbound = relationship('WarehouseOutbound', back_populates='outbound_batches')
    batch = relationship('WarehouseBatch', foreign_keys=[batch_id])


# -- finance -----------------------------------------------------------
