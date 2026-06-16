from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

class CustomerInvoiceRequest(Base):
    """电商客户开票申请台账"""
    __tablename__ = "customer_invoice_requests"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    apply_date = Column(String(20), default="")           # 申请日期
    order_no = Column(String(100), default="")            # 订单编号
    shop_name = Column(String(100), default="")           # 店铺名称
    # 客户信息
    customer_name = Column(String(100), default="")       # 客户名称（抬头）
    tax_id = Column(String(50), default="")               # 纳税人识别号
    register_address = Column(String(200), default="")    # 注册地址（专票用）
    bank_account = Column(String(200), default="")        # 开户行及账号（专票用）
    # 发票信息
    invoice_type = Column(String(20), default="普通发票") # 普通发票/专用发票/电子发票
    invoice_content = Column(String(200), default="")     # 开票内容（品名）
    amount = Column(Float, default=0)                     # 开票金额（含税）
    tax_rate = Column(Float, default=0.03)                # 税率
    tax_amount = Column(Float, default=0)                 # 税额
    # 收票信息
    email = Column(String(100), default="")               # 邮箱（电子发票）
    mail_address = Column(String(200), default="")        # 邮寄地址（实体）
    # 状态
    status = Column(String(20), default="pending")        # pending/processing/issued/mailed/signed/voided
    remark = Column(Text, default="")                     # 备注
    handler = Column(String(50), default="")              # 经手人
    # 关联销项发票
    sales_invoice_id = Column(Integer, ForeignKey("sales_invoices.id"), nullable=True)
    # 发票附件
    invoice_file = Column(String(500), default="")            # 发票文件路径
    invoice_filename = Column(String(255), default="")        # 发票原始文件名
    # 创建信息
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    sales_invoice = relationship("SalesInvoice", foreign_keys=[sales_invoice_id])

class SalesInvoice(Base):
    """销项发票台账（已开具发票的正式登记）"""
    __tablename__ = "sales_invoices"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    invoice_date = Column(String(20), default="")         # 开票日期
    invoice_code = Column(String(50), default="")         # 发票代码
    invoice_no = Column(String(50), default="", index=True)  # 发票号码
    invoice_type = Column(String(20), default="普通发票") # 普通发票/专用发票/电子发票
    # 受票方
    buyer_name = Column(String(100), default="")          # 购方名称
    buyer_tax_id = Column(String(50), default="")         # 购方纳税人识别号
    # 金额
    invoice_content = Column(String(200), default="")     # 开票内容
    amount = Column(Float, default=0)                     # 不含税金额
    tax_rate = Column(Float, default=0.03)                # 税率
    tax_amount = Column(Float, default=0)                 # 税额
    total_amount = Column(Float, default=0)               # 价税合计
    # 关联
    order_no = Column(String(100), default="")            # 关联订单号
    shop_name = Column(String(100), default="")           # 关联店铺
    handler = Column(String(50), default="")              # 经手人
    remark = Column(Text, default="")                     # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    invoice_requests = relationship("CustomerInvoiceRequest", back_populates="sales_invoice")

class PurchaseInvoice(Base):
    """进项发票台账（公司收到的发票）"""
    __tablename__ = "purchase_invoices"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    receive_date = Column(String(20), default="")         # 收票日期
    invoice_date = Column(String(20), default="")         # 开票日期
    invoice_code = Column(String(50), default="")         # 发票代码
    invoice_no = Column(String(50), default="", index=True)  # 发票号码
    invoice_type = Column(String(20), default="专用发票") # 普通发票/专用发票/电子发票
    # 开票方
    seller_name = Column(String(100), default="")         # 销方名称
    seller_tax_id = Column(String(50), default="")        # 销方纳税人识别号
    # 金额
    invoice_content = Column(String(200), default="")     # 发票内容
    amount = Column(Float, default=0)                     # 不含税金额
    tax_rate = Column(Float, default=0.13)                # 税率
    tax_amount = Column(Float, default=0)                 # 税额
    total_amount = Column(Float, default=0)               # 价税合计
    # 认证抵扣
    is_certified = Column(Boolean, default=False)         # 是否认证
    certified_date = Column(String(20), default="")       # 认证日期
    certification_result = Column(String(20), default="") # 认证结果：认证成功/认证失败/认证中
    due_date = Column(String(20), default="")             # 抵扣到期日
    # 其他
    related_contract = Column(String(100), default="")    # 关联合同
    receiver = Column(String(50), default="")             # 收票人
    remark = Column(Text, default="")                     # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])

class ExpenseInvoice(Base):
    """费用报销发票台账（防重复报销）"""
    __tablename__ = "expense_invoices"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    invoice_no = Column(String(50), default="", index=True)  # 发票号码（用于查重）
    invoice_date = Column(String(20), default="")         # 开票日期
    invoice_type = Column(String(20), default="普通发票") # 普通发票/专用发票/电子发票
    seller_name = Column(String(100), default="")         # 开票方名称
    # 金额
    summary = Column(String(200), default="")             # 摘要/用途
    amount = Column(Float, default=0)                     # 不含税金额
    tax_rate = Column(Float, default=0.03)                # 税率
    tax_amount = Column(Float, default=0)                 # 税额
    reimbursement_amount = Column(Float, default=0)       # 报销金额（价税合计）
    # 报销信息
    reimbursement_date = Column(String(20), default="")   # 报销日期
    reimburser = Column(String(50), default="")           # 报销人
    department = Column(String(100), default="")          # 报销部门
    is_paid = Column(Boolean, default=False)              # 是否已支付
    # 重复校验（由系统自动计算）
    is_duplicate = Column(Boolean, default=False)         # 是否重复
    # 关联审批
    approval_id = Column(Integer, ForeignKey("approval_requests.id"), nullable=True)
    remark = Column(Text, default="")                     # 备注
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])
    approval = relationship("ApprovalRequest", foreign_keys=[approval_id])


# ── 考勤打卡 ─────────────────────────────────────────────────────
