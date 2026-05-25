from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db, ReturnExchangeRecord, User, ReturnExchangeFeedback
from schemas import (
    ReturnExchangeCreate,
    ReturnExchangeUpdate,
    ReturnExchangeOut,
    ReturnExchangeFeedbackCreate,
    ReturnExchangeFeedbackOut,
)
from auth import apply_owner_filter,  get_current_user, require_permission
from services import audit_service

router = APIRouter(prefix="/api/return-exchange", tags=["return_exchange"])


def record_to_out(r: ReturnExchangeRecord) -> ReturnExchangeOut:
    return ReturnExchangeOut(
        id=r.id,
        apply_date=r.apply_date or "",
        order_no=r.order_no or "",
        return_reason=r.return_reason or "",
        size=r.size or "",
        model=r.model or "",
        config=r.config or "",
        computer_price=r.computer_price or 0,
        quantity=r.quantity or 1,
        accessories=r.accessories or "",
        accessories_price=r.accessories_price or 0,
        customer_info=r.customer_info or "",
        return_tracking=r.return_tracking or "",
        send_tracking=r.send_tracking or "",
        handle_result=r.handle_result or "",
        progress=r.progress or "pending",
        disassembly_feedback=r.disassembly_feedback or "",
        shipping_fee=r.shipping_fee or 0,
        remark=r.remark or "",
        record_type=r.record_type or "",
        created_by=r.created_by,
        creator_name=r.creator.name if r.creator else "",
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


@router.get("", response_model=dict)
def list_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    status: str = Query("", description="Filter by progress"),
    record_type: str = Query("", description="Filter by record type: return/exchange"),
    search: str = Query("", description="Search in order_no/model/customer_info"),
    start_date: str = Query("", description="Filter by apply_date >= start_date (YYYY-MM-DD)"),
    end_date: str = Query("", description="Filter by apply_date <= end_date (YYYY-MM-DD)"),
    all: bool = Query(False, description="Return all records (for export)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:view")),
):
    query = db.query(ReturnExchangeRecord).filter(ReturnExchangeRecord.company_id == current_user.company_id)
    query = apply_owner_filter(query, ReturnExchangeRecord, current_user)
    if status:
        query = query.filter(ReturnExchangeRecord.progress == status)
    if record_type:
        query = query.filter(ReturnExchangeRecord.record_type == record_type)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (ReturnExchangeRecord.order_no.like(pattern))
            | (ReturnExchangeRecord.model.like(pattern))
            | (ReturnExchangeRecord.customer_info.like(pattern))
        )
    if start_date:
        query = query.filter(ReturnExchangeRecord.apply_date >= start_date)
    if end_date:
        query = query.filter(ReturnExchangeRecord.apply_date <= end_date)
    if all:
        items = query.order_by(ReturnExchangeRecord.created_at.desc()).all()
        return {"total": len(items), "page": 1, "page_size": len(items), "items": [record_to_out(r) for r in items]}
    total = query.count()
    items = query.order_by(ReturnExchangeRecord.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [record_to_out(r) for r in items],
    }


@router.get("/{record_id}", response_model=ReturnExchangeOut)
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:view")),
):
    r = db.query(ReturnExchangeRecord).filter(ReturnExchangeRecord.id == record_id, ReturnExchangeRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    return record_to_out(r)


@router.post("", response_model=ReturnExchangeOut)
def create_record(
    req: ReturnExchangeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:create")),
):
    r = ReturnExchangeRecord(
        company_id=current_user.company_id,
        apply_date=req.apply_date,
        order_no=req.order_no,
        return_reason=req.return_reason,
        size=req.size,
        model=req.model,
        config=req.config,
        computer_price=req.computer_price,
        quantity=req.quantity,
        accessories=req.accessories,
        accessories_price=req.accessories_price,
        customer_info=req.customer_info,
        return_tracking=req.return_tracking,
        send_tracking=req.send_tracking,
        handle_result=req.handle_result,
        progress=req.progress,
        disassembly_feedback=req.disassembly_feedback,
        shipping_fee=req.shipping_fee,
        remark=req.remark,
        record_type=req.record_type,
        created_by=current_user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "create", "return_exchange", r.id,
                      f"创建退换登记: #{r.id} {r.order_no}")
    return record_to_out(r)


@router.put("/{record_id}", response_model=ReturnExchangeOut)
def update_record(
    record_id: int,
    req: ReturnExchangeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:edit")),
):
    r = db.query(ReturnExchangeRecord).filter(ReturnExchangeRecord.id == record_id, ReturnExchangeRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(r, field, value)
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "update", "return_exchange", r.id,
                      f"更新退换登记: #{r.id}")
    return record_to_out(r)


@router.delete("/{record_id}")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:delete")),
):
    r = db.query(ReturnExchangeRecord).filter(ReturnExchangeRecord.id == record_id, ReturnExchangeRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    audit_service.log(db, current_user, "delete", "return_exchange", record_id,
                      f"删除退换登记: #{record_id}")
    db.delete(r)
    db.commit()
    return {"message": "OK"}


@router.post("/{record_id}/feedback", response_model=ReturnExchangeFeedbackOut)
def add_feedback(
    record_id: int,
    req: ReturnExchangeFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:process")),
):
    r = db.query(ReturnExchangeRecord).filter(ReturnExchangeRecord.id == record_id, ReturnExchangeRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    fb = ReturnExchangeFeedback(
        company_id=current_user.company_id,
        record_id=record_id,
        user_id=current_user.id,
        content=req.content,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return ReturnExchangeFeedbackOut(
        id=fb.id,
        record_id=fb.record_id,
        user_id=fb.user_id,
        content=fb.content,
        created_at=fb.created_at,
        user_name=current_user.name,
    )


@router.get("/{record_id}/feedbacks", response_model=list[ReturnExchangeFeedbackOut])
def get_feedbacks(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:view")),
):
    feedbacks = db.query(ReturnExchangeFeedback).filter(
        ReturnExchangeFeedback.record_id == record_id
        , ReturnExchangeFeedback.company_id == current_user.company_id
    ).order_by(ReturnExchangeFeedback.created_at.asc()).all()
    return [
        ReturnExchangeFeedbackOut(
            id=fb.id,
            record_id=fb.record_id,
            user_id=fb.user_id,
            content=fb.content,
            created_at=fb.created_at,
            user_name=fb.user.name if fb.user else "",
        )
        for fb in feedbacks
    ]
