from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

class AfterSalesFeedback(Base):
    """售后登记的处理记录（工作留痕）"""
    __tablename__ = "after_sales_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("after_sales_records.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("AfterSalesRecord", back_populates="feedbacks")
    user = relationship("User")


# ── 发货登记处理记录 ─────────────────────────────────────────────────

class AfterSalesRecord(Base):
    __tablename__ = "after_sales_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    apply_date = Column(String(20), default="")          # 申请日期
    order_no = Column(String(100), default="")           # 订单编号
    return_reason = Column(Text, default="")             # 退货原因
    size = Column(String(50), default="")                # 尺寸
    model = Column(String(200), default="")              # 型号
    config = Column(String(200), default="")             # 配置
    computer_price = Column(Float, default=0)             # 电脑价格
    quantity = Column(Integer, default=1)                # 数量
    accessories = Column(String(500), default="")        # 配件
    accessories_price = Column(Float, default=0)          # 配件价格
    customer_info = Column(Text, default="")             # 客户信息（姓名/手机/地址合并）
    return_tracking = Column(String(100), default="")    # 寄回单号
    send_tracking = Column(String(100), default="")      # 寄出新单号
    handle_result = Column(Text, default="")             # 处理结果
    progress = Column(String(50), default="pending")     # 处理进度 pending/processing/completed
    charge_required = Column(Boolean, default=False)     # 是否需要收费维修
    charge_status = Column(String(30), default="none")   # none/pending_charge/paid
    current_expected_amount = Column(Float, default=0)
    current_paid_amount = Column(Float, default=0)
    last_charge_request_id = Column(Integer, nullable=True)
    disassembly_feedback = Column(Text, default="")      # 拆件反馈
    shipping_fee = Column(Float, default=0)              # 运费
    remark = Column(Text, default="")                    # 备注
    record_type = Column(String(20), default="")          # 登记类型：return(退货)/exchange(换货)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    feedbacks = relationship("AfterSalesFeedback", back_populates="record", cascade="all, delete-orphan")
    charge_requests = relationship("AfterSalesChargeRequest", back_populates="record", cascade="all, delete-orphan")


# ── 退换登记 ─────────────────────────────────────────────────────────

class ReturnExchangeRecord(Base):
    """退换登记表（退货/换货）"""
    __tablename__ = "return_exchange_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    apply_date = Column(String(20), default="")          # 申请日期
    shop_name = Column(String(200), default="")          # 店铺名称
    order_no = Column(String(100), default="")           # 订单编号
    return_reason = Column(Text, default="")             # 退货原因
    size = Column(String(50), default="")                # 尺寸
    model = Column(String(200), default="")              # 型号
    config = Column(String(200), default="")             # 配置
    computer_price = Column(Float, default=0)            # 电脑价格
    quantity = Column(Integer, default=1)                # 数量
    accessories = Column(String(500), default="")         # 配件
    accessories_price = Column(Float, default=0)         # 配件价格
    customer_info = Column(Text, default="")              # 客户信息（姓名/手机/地址合并）
    return_tracking = Column(String(100), default="")    # 寄回单号
    send_tracking = Column(String(100), default="")      # 寄出新单号
    handle_result = Column(Text, default="")             # 处理结果
    progress = Column(String(50), default="pending")     # 处理进度 pending/processing/completed
    disassembly_feedback = Column(Text, default="")      # 拆件反馈
    shipping_fee = Column(Float, default=0)              # 运费
    remark = Column(Text, default="")                    # 备注
    record_type = Column(String(20), default="")          # 登记类型：return(退货)/exchange(换货)
    has_damage = Column(Boolean, default=False)            # 是否有货损
    damage_items = Column(JSONType, default=list)          # 货损明细 [{name, amount, desc}]
    claim_status = Column(String(20), default="none")      # 追赔状态: none/pending/claimed
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    feedbacks = relationship("ReturnExchangeFeedback", back_populates="record", cascade="all, delete-orphan")

class ReturnExchangeFeedback(Base):
    """退换登记的处理记录（工作留痕）"""
    __tablename__ = "return_exchange_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("return_exchange_records.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("ReturnExchangeRecord", back_populates="feedbacks")
    user = relationship("User")


# ── 维修登记 ─────────────────────────────────────────────────────────

class RepairRecord(Base):
    """维修登记表"""
    __tablename__ = "repair_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    apply_date = Column(String(20), default="")          # 申请日期
    order_no = Column(String(100), default="")           # 订单编号
    return_reason = Column(Text, default="")             # 故障描述
    model = Column(String(200), default="")              # 型号
    config = Column(String(200), default="")             # 配置
    quantity = Column(Integer, default=1)                # 数量
    accessories = Column(String(500), default="")         # 配件
    customer_info = Column(Text, default="")              # 客户信息（姓名/手机/地址合并）
    return_tracking = Column(String(100), default="")    # 寄回单号
    send_tracking = Column(String(100), default="")      # 寄出新单号
    handle_result = Column(Text, default="")             # 维修结果
    repair_status = Column(String(50), default="pending_repair")  # 维修状态 pending_repair/processing_repair/completed_repair
    charge_required = Column(Boolean, default=False)     # 是否需要收费
    charge_status = Column(String(30), default="none")   # none/pending_charge/paid
    current_expected_amount = Column(Float, default=0)
    current_paid_amount = Column(Float, default=0)
    last_charge_request_id = Column(Integer, nullable=True)
    disassembly_feedback = Column(Text, default="")      # 拆件反馈
    shipping_fee = Column(Float, default=0)              # 运费
    remark = Column(Text, default="")                    # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    feedbacks = relationship("RepairFeedback", back_populates="record", cascade="all, delete-orphan")
    charge_requests = relationship("RepairChargeRequest", back_populates="record", cascade="all, delete-orphan")

class RepairFeedback(Base):
    """维修登记的处理记录（工作留痕）"""
    __tablename__ = "repair_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("repair_records.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("RepairRecord", back_populates="feedbacks")
    user = relationship("User")

class RepairChargeRequest(Base):
    """维修收费请求"""
    __tablename__ = "repair_charge_requests"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    repair_record_id = Column(Integer, ForeignKey("repair_records.id"), nullable=False, index=True)
    status = Column(String(30), default="pending_charge")    # pending_charge/paid/cancelled
    expected_amount = Column(Float, default=0)
    paid_amount = Column(Float, default=0)
    charge_note = Column(Text, default="")
    amount_change_note = Column(Text, default="")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    paid_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    paid_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    record = relationship("RepairRecord", back_populates="charge_requests")
    creator = relationship("User", foreign_keys=[created_by])
    payer = relationship("User", foreign_keys=[paid_by])

class AfterSalesChargeRequest(Base):
    __tablename__ = "after_sales_charge_requests"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    after_sales_record_id = Column(Integer, ForeignKey("after_sales_records.id"), nullable=False, index=True)
    status = Column(String(30), default="pending_charge")    # pending_charge/paid/cancelled
    expected_amount = Column(Float, default=0)
    paid_amount = Column(Float, default=0)
    charge_note = Column(Text, default="")
    amount_change_note = Column(Text, default="")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    paid_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    paid_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    record = relationship("AfterSalesRecord", back_populates="charge_requests")
    creator = relationship("User", foreign_keys=[created_by])
    payer = relationship("User", foreign_keys=[paid_by])


# ── 赠品登记 ─────────────────────────────────────────────────────────
