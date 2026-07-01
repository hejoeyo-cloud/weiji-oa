from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

class GiftFeedback(Base):
    """发货登记的处理记录（工作留痕）"""
    __tablename__ = "gift_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("gift_records.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("GiftRecord", back_populates="feedbacks")
    user = relationship("User")


# ── 礼品补发处理记录 ─────────────────────────────────────────────────

class GiftResendFeedback(Base):
    """礼品补发的处理记录（工作留痕）"""
    __tablename__ = "gift_resend_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("gift_resend_records.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("GiftResendRecord", back_populates="feedbacks")
    user = relationship("User")

class GiftRecord(Base):
    """发货登记（原赠品登记）"""
    __tablename__ = "gift_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    date = Column(String(20), default="")               # 日期
    shop_name = Column(String(200), default="")          # 店铺名称
    order_no = Column(String(100), default="")           # 订单编号
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=True)  # 店铺
    shop_name = Column(String(200), default="")          # 店铺名称（冗余）
    product = Column(String(200), default="")            # 产品
    size = Column(String(50), default="")                # 尺寸
    model = Column(String(200), default="")              # 型号
    config = Column(String(200), default="")             # 配置
    color = Column(String(50), default="")               # 颜色
    quantity = Column(Integer, default=1)                # 数量
    accessories = Column(String(500), default="")        # 配件
    customer_info = Column(Text, default="")             # 客户信息（姓名/手机/地址合并）
    send_tracking = Column(String(100), default="")      # 发出单号
    shipping_fee = Column(Float, default=0)              # 运费
    order_amount = Column(Float, default=0)              # 订单金额
    cost = Column(Float, default=0)                       # 产品成本
    gift_costs = Column(JSONType, default=list)           # 礼品成本 [{name, amount}]
    remark = Column(Text, default="")                    # 备注
    ship_date = Column(String(20), default="")           # 出货日期
    status = Column(String(20), default="pending")       # pending/sent/intercepted/torn/cancelled/returned
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    feedbacks = relationship("GiftFeedback", back_populates="record", cascade="all, delete-orphan")


# ── 返现登记 ─────────────────────────────────────────────────────────

class GiftCashback(Base):
    """返现登记表（关联发货订单）"""
    __tablename__ = "gift_cashbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    shop_name = Column(String(200), default="")          # 店铺名称
    order_no = Column(String(100), default="", index=True)   # 关联订单号
    cashback_amount = Column(Float, default=0)              # 返现金额
    reason = Column(Text, default="")                        # 返现原因
    remark = Column(Text, default="")                       # 备注
    applicant = Column(String(100), default="")             # 申请人（兼容旧数据）
    payment_method = Column(String(100), default="")        # 收款方式
    payment_account = Column(String(200), default="")       # 收款账户
    payment_qr_code = Column(String(500), default="")       # 收款码图片URL
    payee = Column(String(100), default="")                 # 收款人
    status = Column(String(20), default="pending")          # pending=待返现, completed=已返现
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    feedbacks = relationship("GiftCashbackFeedback", back_populates="record", cascade="all, delete-orphan")


# ── 操作日志 ─────────────────────────────────────────────────────────

class GiftResendRecord(Base):
    """礼品补发登记"""
    __tablename__ = "gift_resend_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    apply_date = Column(String(20), default="")          # 申请时间
    order_no = Column(String(100), default="")           # 订单编号
    shop_name = Column(String(200), default="")          # 店铺名称
    type = Column(String(100), default="")               # 类型
    gift_detail = Column(Text, default="")               # 礼品明细（旧字段，兼容）
    gift_items = Column(JSONType, default=list)           # 礼品明细 [{name, quantity}]
    customer_info = Column(Text, default="")             # 客户信息
    express_company = Column(String(100), default="")    # 快递公司
    tracking_no = Column(String(100), default="")        # 礼品寄出单号
    status = Column(String(20), default="pending")       # pending/sent/intercepted/torn/cancelled
    remark = Column(Text, default="")                    # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    feedbacks = relationship("GiftResendFeedback", back_populates="record", cascade="all, delete-orphan")


class GiftResendPreset(Base):
    """礼品补发预设组合"""
    __tablename__ = "gift_resend_presets"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(100), nullable=False)                    # 组合名称
    items = Column(JSONType, default=list)                        # [{name, quantity}]
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])


class GiftCashbackFeedback(Base):
    """返现登记的处理记录（工作留痕）"""
    __tablename__ = "gift_cashback_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("gift_cashbacks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("GiftCashback", back_populates="feedbacks")
    user = relationship("User")


class GiftPreset(Base):
    """礼品预设组合"""
    __tablename__ = "gift_presets"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(100), nullable=False)                    # 组合名称，如"标准三件套"
    items = Column(JSONType, default=list)                        # [{name, amount}]
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
