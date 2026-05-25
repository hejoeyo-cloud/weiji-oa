from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ApprovalStepOut(BaseModel):
    id: int
    step_order: int
    approver_id: Optional[int]
    approver_name: str = ""
    status: str
    comment: str
    approved_at: Optional[datetime]

    class Config:
        from_attributes = True

class ApprovalRequestCreate(BaseModel):
    type: str = "leave"           # leave / reimbursement / purchase
    title: str = ""
    description: str = ""
    amount: Optional[float] = None
    start_date: str = ""
    end_date: str = ""
    attachments: List[str] = []
    approver_ids: List[int] = []  # 审批人列表（按顺序）

class ApprovalRequestOut(BaseModel):
    id: int
    type: str
    title: str
    description: str
    amount: Optional[float]
    start_date: str
    end_date: str
    attachments: List[str] = []
    status: str
    applicant_id: Optional[int]
    applicant_name: str = ""
    steps: List[ApprovalStepOut] = []
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class ApprovalAction(BaseModel):
    action: str = "approve"   # approve / reject / return / countersign / reassign
    comment: str = ""
    reassign_to: Optional[int] = None


# ── 排班管理 ─────────────────────────────────────────────────────────
