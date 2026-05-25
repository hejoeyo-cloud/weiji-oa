from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

class ApprovalRule(Base):
    """审批规则 — 支持条件分支"""
    __tablename__ = "approval_rules"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(100), default="")
    target_module = Column(String(50), default="")    # 目标模块: return_exchange/repair
    condition_field = Column(String(50), default="")  # 条件字段: amount/record_type
    condition_op = Column(String(20), default="")     # 运算符: gt/gte/lt/lte/eq/contains
    condition_value = Column(String(50), default="")  # 条件值: 5000
    sign_mode = Column(String(10), default="or")      # 会签模式: or(或签)/and(会签)
    approver_ids = Column(String(500), default="")    # 审批人ID列表, 逗号分隔
    approver_names = Column(String(500), default="")  # 审批人姓名列表
    enabled = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    company = relationship("Company")

class ApprovalRequest(Base):
    """审批申请（请假/报销/采购）"""
    __tablename__ = "approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    type = Column(String(20), default="leave")       # leave/reimbursement/purchase
    title = Column(String(200), default="")
    description = Column(Text, default="")
    amount = Column(Float, nullable=True)            # 金额（报销/采购用）
    start_date = Column(String(20), default="")      # 日期字符串（请假起止）
    end_date = Column(String(20), default="")
    attachments = Column(JSONType, default=list)     # 附件图片
    status = Column(String(20), default="pending", index=True)   # pending/approved/rejected/cancelled
    applicant_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    applicant = relationship("User", foreign_keys=[applicant_id])
    steps = relationship("ApprovalStep", back_populates="request", cascade="all, delete-orphan")

class ApprovalStep(Base):
    """审批步骤（支持多级）"""
    __tablename__ = "approval_steps"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    request_id = Column(Integer, ForeignKey("approval_requests.id"), nullable=False)
    step_order = Column(Integer, default=1)          # 第几级审批
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 审批人
    status = Column(String(20), default="pending")   # pending/approved/rejected/returned
    action_type = Column(String(20), default="")     # approve/reject/return/countersign/reassign
    reassigned_to = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # 转审目标人
    comment = Column(Text, default="")
    approved_at = Column(DateTime, nullable=True)

    request = relationship("ApprovalRequest", back_populates="steps")
    approver = relationship("User", foreign_keys=[approver_id])


# ── 排班管理 ─────────────────────────────────────────────────────────
