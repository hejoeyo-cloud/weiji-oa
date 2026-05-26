from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db, RepairRecord, User, RepairFeedback
from schemas import (
    RepairCreate,
    RepairUpdate,
    RepairOut,
    RepairFeedbackCreate,
    RepairFeedbackOut,
    RepairChargeRequestCreate,
    RepairChargeRequestPaid,
    RepairChargeRequestCancel,
    RepairChargeRequestOut,
)
from auth import apply_owner_filter,  get_current_user, require_permission
from services import audit_service
from services.charge_service import create_repair_charge_request
from routers.approval_rules_router import evaluate_rules

router = APIRouter(prefix="/api/repair", tags=["repair"])


def record_to_out(r: RepairRecord) -> RepairOut:
    return RepairOut(
        id=r.id,
        apply_date=r.apply_date or "",
        order_no=r.order_no or "",
        return_reason=r.return_reason or "",
        model=r.model or "",
        config=r.config or "",
        quantity=r.quantity or 1,
        accessories=r.accessories or "",
        customer_info=r.customer_info or "",
        return_tracking=r.return_tracking or "",
        send_tracking=r.send_tracking or "",
        handle_result=r.handle_result or "",
        repair_status=r.repair_status or "pending_repair",
        charge_required=bool(r.charge_required),
        charge_status=r.charge_status or "none",
        current_expected_amount=r.current_expected_amount or 0,
        current_paid_amount=r.current_paid_amount or 0,
        last_charge_request_id=r.last_charge_request_id,
        disassembly_feedback=r.disassembly_feedback or "",
        shipping_fee=r.shipping_fee or 0,
        remark=r.remark or "",
        created_by=r.created_by,
        creator_name=r.creator.name if r.creator else "",
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


def charge_to_out(charge_request: RepairChargeRequest) -> RepairChargeRequestOut:
    return RepairChargeRequestOut(
        id=charge_request.id,
        repair_record_id=charge_request.repair_record_id,
        status=charge_request.status or "pending_charge",
        expected_amount=charge_request.expected_amount or 0,
        paid_amount=charge_request.paid_amount or 0,
        charge_note=charge_request.charge_note or "",
        amount_change_note=charge_request.amount_change_note or "",
        created_by=charge_request.created_by,
        created_by_name=charge_request.creator.name if charge_request.creator else "",
        paid_by=charge_request.paid_by,
        paid_by_name=charge_request.payer.name if charge_request.payer else "",
        created_at=charge_request.created_at,
        paid_at=charge_request.paid_at,
        updated_at=charge_request.updated_at,
    )


@router.get("", response_model=dict)
def list_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    repair_status: str = Query("", description="Filter by repair status"),
    charge_status: str = Query("", description="Filter by charge status"),
    search: str = Query("", description="Search in order_no/model/customer_info"),
    start_date: str = Query("", description="Filter by apply_date >= start_date (YYYY-MM-DD)"),
    end_date: str = Query("", description="Filter by apply_date <= end_date (YYYY-MM-DD)"),
    all: bool = Query(False, description="Return all records (for export)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("repair:view")),
):
    query = db.query(RepairRecord).filter(RepairRecord.company_id == current_user.company_id)
    query = apply_owner_filter(query, RepairRecord, current_user)
    if repair_status:
        query = query.filter(RepairRecord.repair_status == repair_status)
    if charge_status:
        query = query.filter(RepairRecord.charge_status == charge_status)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (RepairRecord.order_no.like(pattern))
            | (RepairRecord.model.like(pattern))
            | (RepairRecord.customer_info.like(pattern))
        )
    if start_date:
        query = query.filter(RepairRecord.apply_date >= start_date)
    if end_date:
        query = query.filter(RepairRecord.apply_date <= end_date)
    if all:
        items = query.order_by(RepairRecord.created_at.desc()).all()
        return {"total": len(items), "page": 1, "page_size": len(items), "items": [record_to_out(r) for r in items]}
    total = query.count()
    items = query.order_by(RepairRecord.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [record_to_out(r) for r in items],
    }


@router.get("/{record_id}", response_model=RepairOut)
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("repair:view")),
):
    r = db.query(RepairRecord).filter(RepairRecord.id == record_id, RepairRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    return record_to_out(r)


@router.post("", response_model=RepairOut)
def create_record(
    req: RepairCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("repair:create")),
):
    r = RepairRecord(
        company_id=current_user.company_id,
        apply_date=req.apply_date,
        order_no=req.order_no,
        return_reason=req.return_reason,
        model=req.model,
        config=req.config,
        quantity=req.quantity,
        accessories=req.accessories,
        customer_info=req.customer_info,
        return_tracking=req.return_tracking,
        send_tracking=req.send_tracking,
        handle_result=req.handle_result,
        repair_status=req.repair_status,
        charge_required=req.charge_required,
        charge_status=req.charge_status,
        current_expected_amount=req.current_expected_amount,
        current_paid_amount=req.current_paid_amount,
        last_charge_request_id=req.last_charge_request_id,
        disassembly_feedback=req.disassembly_feedback,
        shipping_fee=req.shipping_fee,
        remark=req.remark,
        created_by=current_user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "create", "repair", r.id,
                      f"创建维修登记: #{r.id} {r.order_no}")
    return record_to_out(r)


@router.put("/{record_id}", response_model=RepairOut)
def update_record(
    record_id: int,
    req: RepairUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("repair:edit")),
):
    r = db.query(RepairRecord).filter(RepairRecord.id == record_id, RepairRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(r, field, value)
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "update", "repair", r.id,
                      f"更新维修登记: #{r.id}")
    return record_to_out(r)


@router.delete("/{record_id}")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("repair:delete")),
):
    r = db.query(RepairRecord).filter(RepairRecord.id == record_id, RepairRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    audit_service.log(db, current_user, "delete", "repair", record_id,
                      f"删除维修登记: #{record_id}")
    db.delete(r)
    db.commit()
    return {"message": "OK"}


@router.post("/{record_id}/feedback", response_model=RepairFeedbackOut)
def add_feedback(
    record_id: int,
    req: RepairFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("repair:process")),
):
    r = db.query(RepairRecord).filter(RepairRecord.id == record_id, RepairRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    fb = RepairFeedback(
        company_id=current_user.company_id,
        record_id=record_id,
        user_id=current_user.id,
        content=req.content,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return RepairFeedbackOut(
        id=fb.id,
        record_id=fb.record_id,
        user_id=fb.user_id,
        content=fb.content,
        created_at=fb.created_at,
        user_name=current_user.name,
    )


@router.get("/{record_id}/feedbacks", response_model=list[RepairFeedbackOut])
def get_feedbacks(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("repair:view")),
):
    feedbacks = db.query(RepairFeedback).filter(
        RepairFeedback.record_id == record_id,
        RepairFeedback.company_id == current_user.company_id,
    ).order_by(RepairFeedback.created_at.asc()).all()
    return [
        RepairFeedbackOut(
            id=fb.id,
            record_id=fb.record_id,
            user_id=fb.user_id,
            content=fb.content,
            created_at=fb.created_at,
            user_name=fb.user.name if fb.user else "",
        )
        for fb in feedbacks
    ]


@router.post("/{record_id}/charge-requests", response_model=RepairChargeRequestOut)
def create_record_charge_request(
    record_id: int,
    req: RepairChargeRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("repair:process")),
):
    record = db.query(RepairRecord).filter(RepairRecord.id == record_id, RepairRecord.company_id == current_user.company_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    charge_request = create_repair_charge_request(
        db=db,
        record=record,
        current_user=current_user,
        expected_amount=req.expected_amount,
        charge_note=req.charge_note,
    )
    return charge_to_out(charge_request)


@router.get("/{record_id}/charge-requests", response_model=list[RepairChargeRequestOut])
def list_record_charge_requests(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("repair:view")),
):
    record = db.query(RepairRecord).filter(RepairRecord.id == record_id, RepairRecord.company_id == current_user.company_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    charge_requests = db.query(RepairChargeRequest).filter(
        RepairChargeRequest.repair_record_id == record_id,
        RepairChargeRequest.company_id == current_user.company_id,
    ).order_by(RepairChargeRequest.created_at.desc(), RepairChargeRequest.id.desc()).all()
    return [charge_to_out(item) for item in charge_requests]


@router.post("/charge-requests/{charge_id}/mark-paid", response_model=RepairChargeRequestOut)
def mark_record_charge_paid(
    charge_id: int,
    req: RepairChargeRequestPaid,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("repair:process")),
):
    charge_request = db.query(RepairChargeRequest).filter(RepairChargeRequest.id == charge_id, RepairChargeRequest.company_id == current_user.company_id).first()
    if not charge_request:
        raise HTTPException(status_code=404, detail="Charge request not found")
    updated = mark_charge_paid(
        db=db,
        charge_request=charge_request,
        current_user=current_user,
        paid_amount=req.paid_amount,
        amount_change_note=req.amount_change_note,
    )
    return charge_to_out(updated)


@router.post("/charge-requests/{charge_id}/cancel", response_model=RepairChargeRequestOut)
def cancel_record_charge_request(
    charge_id: int,
    req: RepairChargeRequestCancel,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("repair:process")),
):
    charge_request = db.query(RepairChargeRequest).filter(RepairChargeRequest.id == charge_id, RepairChargeRequest.company_id == current_user.company_id).first()
    if not charge_request:
        raise HTTPException(status_code=404, detail="Charge request not found")
    updated = cancel_charge_request(
        db=db,
        charge_request=charge_request,
        current_user=current_user,
        reason=req.reason,
    )
    return charge_to_out(updated)
