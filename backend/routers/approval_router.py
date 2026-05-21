from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db, ApprovalRequest, ApprovalStep, User
from schemas import ApprovalRequestCreate, ApprovalRequestOut, ApprovalStepOut, ApprovalAction
from auth import get_current_user
from services import audit_service

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


@router.get("/users", response_model=list[dict])
def list_approval_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """审批专用：获取所有用户的基本信息（id/name/role/is_manager），不限制角色"""
    users = db.query(User).filter(User.company_id == current_user.company_id).order_by(User.name).all()
    return [{"id": u.id, "name": u.name, "role": u.role, "is_manager": u.is_manager} for u in users]


def step_to_out(s: ApprovalStep) -> ApprovalStepOut:
    return ApprovalStepOut(
        id=s.id, step_order=s.step_order,
        approver_id=s.approver_id,
        approver_name=s.approver.name if s.approver else "",
        status=s.status, comment=s.comment or "",
        approved_at=s.approved_at,
    )


def req_to_out(r: ApprovalRequest) -> ApprovalRequestOut:
    return ApprovalRequestOut(
        id=r.id, type=r.type, title=r.title,
        description=r.description, amount=r.amount,
        start_date=r.start_date or "", end_date=r.end_date or "",
        attachments=r.attachments or [],
        status=r.status,
        applicant_id=r.applicant_id,
        applicant_name=r.applicant.name if r.applicant else "",
        steps=sorted([step_to_out(s) for s in r.steps], key=lambda x: x.step_order),
        created_at=r.created_at, updated_at=r.updated_at,
    )


@router.get("", response_model=dict)
def list_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str = Query("", description="leave/reimbursement/purchase"),
    status: str = Query("", description="pending/approved/rejected/cancelled"),
    mine: bool = Query(False, description="Only my requests"),
    pending_my_approval: bool = Query(False, description="Pending my approval"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ApprovalRequest).filter(ApprovalRequest.company_id == current_user.company_id)
    if type:
        query = query.filter(ApprovalRequest.type == type)
    if status:
        query = query.filter(ApprovalRequest.status == status)
    if mine:
        query = query.filter(ApprovalRequest.applicant_id == current_user.id)
    if pending_my_approval:
        # 查找当前用户是审批人且状态为 pending 的步骤，进而找到对应申请
        pending_step_req_ids = select(ApprovalStep.request_id).where(
                ApprovalStep.approver_id == current_user.id,
                ApprovalStep.status == "pending",
                ApprovalStep.company_id == current_user.company_id,
        )
        query = query.filter(ApprovalRequest.id.in_(pending_step_req_ids))
    total = query.count()
    items = query.order_by(ApprovalRequest.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [req_to_out(r) for r in items],
    }


@router.get("/{req_id}", response_model=ApprovalRequestOut)
def get_request(
    req_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(ApprovalRequest).filter(ApprovalRequest.id == req_id, ApprovalRequest.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return req_to_out(r)


@router.post("", response_model=ApprovalRequestOut)
def create_request(
    req: ApprovalRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not req.approver_ids:
        raise HTTPException(status_code=400, detail="At least one approver required")
    approval = ApprovalRequest(
        company_id=current_user.company_id,
        type=req.type, title=req.title, description=req.description,
        amount=req.amount, start_date=req.start_date, end_date=req.end_date,
        attachments=req.attachments, applicant_id=current_user.id,
    )
    db.add(approval)
    db.flush()  # 获取 id
    for idx, approver_id in enumerate(req.approver_ids, start=1):
        step = ApprovalStep(
            company_id=current_user.company_id,
            request_id=approval.id, step_order=idx,
            approver_id=approver_id,
            status="pending" if idx == 1 else "waiting",
        )
        db.add(step)
    db.commit()
    db.refresh(approval)
    audit_service.log(db, current_user, "create", "approval", approval.id,
                      f"提交审批申请: {approval.title} ({approval.type})")
    return req_to_out(approval)


@router.post("/{req_id}/action")
def handle_approval(
    req_id: int,
    body: ApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """当前审批人审批通过或拒绝"""
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == req_id, ApprovalRequest.company_id == current_user.company_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if approval.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not in pending status")

    # 找到当前轮到该用户的步骤
    current_step = db.query(ApprovalStep).filter(
        ApprovalStep.request_id == req_id,
        ApprovalStep.approver_id == current_user.id,
        ApprovalStep.status == "pending",
        ApprovalStep.company_id == current_user.company_id,
    ).order_by(ApprovalStep.step_order).first()

    if not current_step:
        raise HTTPException(status_code=403, detail="No pending step for you")

    current_step.status = body.action  # approve / reject
    current_step.comment = body.comment
    current_step.approved_at = datetime.now()

    if body.action == "reject":
        approval.status = "rejected"
    else:
        # 检查是否还有下一级
        next_step = db.query(ApprovalStep).filter(
            ApprovalStep.request_id == req_id,
            ApprovalStep.step_order == current_step.step_order + 1,
            ApprovalStep.company_id == current_user.company_id,
        ).first()
        if next_step:
            next_step.status = "pending"  # 激活下一级
        else:
            approval.status = "approved"  # 全部通过

    db.commit()
    db.refresh(approval)
    action_label = "通过" if body.action == "approve" else "拒绝"
    audit_service.log(db, current_user, "update", "approval", req_id,
                      f"审批{action_label}: {approval.title}")
    return req_to_out(approval)


@router.delete("/{req_id}")
def cancel_request(
    req_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """申请人撤销自己的申请"""
    r = db.query(ApprovalRequest).filter(ApprovalRequest.id == req_id, ApprovalRequest.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if r.applicant_id != current_user.id and current_user.role not in ("admin", "technician"):
        raise HTTPException(status_code=403, detail="Forbidden")
    if r.status not in ("pending",):
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    r.status = "cancelled"
    db.commit()
    audit_service.log(db, current_user, "delete", "approval", req_id,
                      f"撤销审批申请: {r.title}")
    return {"message": "OK"}
