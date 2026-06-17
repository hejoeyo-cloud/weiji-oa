from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db, GiftResendRecord, User, GiftResendFeedback
from schemas import GiftResendCreate, GiftResendUpdate, GiftResendOut, GiftResendFeedbackCreate, GiftResendFeedbackOut
from auth import apply_owner_filter, get_current_user, require_permission
from services import audit_service

router = APIRouter(prefix="/api/gift-resend", tags=["gift_resend"])


def record_to_out(r: GiftResendRecord) -> GiftResendOut:
    gift_items_raw = r.gift_items or []
    return GiftResendOut(
        id=r.id,
        apply_date=r.apply_date or "",
        order_no=r.order_no or "",
        shop_name=r.shop_name or "",
        type=r.type or "",
        gift_detail=r.gift_detail or "",
        gift_items=[{"name": i.get("name", ""), "quantity": i.get("quantity", 1), "amount": i.get("amount", 0)} for i in gift_items_raw if isinstance(i, dict)],
        customer_info=r.customer_info or "",
        express_company=r.express_company or "",
        tracking_no=r.tracking_no or "",
        remark=r.remark or "",
        created_by=r.created_by,
        creator_name=r.creator.name if r.creator else "",
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


@router.get("", response_model=dict)
def list_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    shop_name: str = Query("", description="Filter by shop_name"),
    search: str = Query("", description="Search in order_no/shop_name/customer_info"),
    start_date: str = Query("", description="Filter by apply_date >= start_date (YYYY-MM-DD)"),
    end_date: str = Query("", description="Filter by apply_date <= end_date (YYYY-MM-DD)"),
    all: bool = Query(False, description="Return all records (for export)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("gift_resend:view")),
):
    query = db.query(GiftResendRecord).filter(GiftResendRecord.company_id == current_user.company_id)
    query = apply_owner_filter(query, GiftResendRecord, current_user)
    if shop_name:
        query = query.filter(GiftResendRecord.shop_name == shop_name)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (GiftResendRecord.order_no.like(pattern))
            | (GiftResendRecord.shop_name.like(pattern))
            | (GiftResendRecord.customer_info.like(pattern))
        )
    if start_date:
        query = query.filter(GiftResendRecord.apply_date >= start_date)
    if end_date:
        query = query.filter(GiftResendRecord.apply_date <= end_date)
    if all:
        items = query.order_by(GiftResendRecord.created_at.desc()).all()
        return {"total": len(items), "page": 1, "page_size": len(items), "items": [record_to_out(r) for r in items]}
    total = query.count()
    items = query.order_by(GiftResendRecord.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [record_to_out(r) for r in items],
    }


@router.get("/{record_id}", response_model=GiftResendOut)
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("gift_resend:create")),
):
    r = db.query(GiftResendRecord).filter(GiftResendRecord.id == record_id, GiftResendRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    return record_to_out(r)


@router.post("", response_model=GiftResendOut)
def create_record(
    req: GiftResendCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("gift_resend:edit")),
):
    r = GiftResendRecord(
        company_id=current_user.company_id,
        apply_date=req.apply_date,
        order_no=req.order_no,
        shop_name=req.shop_name,
        type=req.type,
        gift_detail=req.gift_detail,
        gift_items=[item.model_dump() for item in req.gift_items] if req.gift_items else [],
        customer_info=req.customer_info,
        express_company=req.express_company,
        tracking_no=req.tracking_no,
        remark=req.remark,
        created_by=current_user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "create", "gift_resend", r.id,
                      f"创建礼品补发: #{r.id} {r.order_no}")
    return record_to_out(r)


@router.put("/{record_id}", response_model=GiftResendOut)
def update_record(
    record_id: int,
    req: GiftResendUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("gift_resend:delete")),
):
    r = db.query(GiftResendRecord).filter(GiftResendRecord.id == record_id, GiftResendRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(r, field, value)
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "update", "gift_resend", r.id,
                      f"更新礼品补发: #{r.id}")
    return record_to_out(r)


@router.delete("/{record_id}")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(GiftResendRecord).filter(GiftResendRecord.id == record_id, GiftResendRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    audit_service.log(db, current_user, "delete", "gift_resend", record_id,
                      f"删除礼品补发: #{record_id}")
    db.delete(r)
    db.commit()
    return {"message": "OK"}


@router.post("/{record_id}/feedback", response_model=GiftResendFeedbackOut)
def add_feedback(
    record_id: int,
    req: GiftResendFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(GiftResendRecord).filter(GiftResendRecord.id == record_id, GiftResendRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    fb = GiftResendFeedback(
        company_id=current_user.company_id,
        record_id=record_id,
        user_id=current_user.id,
        content=req.content,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return GiftResendFeedbackOut(
        id=fb.id,
        record_id=fb.record_id,
        user_id=fb.user_id,
        content=fb.content,
        created_at=fb.created_at,
        user_name=current_user.name,
    )


@router.get("/{record_id}/feedbacks", response_model=list[GiftResendFeedbackOut])
def get_feedbacks(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feedbacks = db.query(GiftResendFeedback).filter(
        GiftResendFeedback.record_id == record_id,
        GiftResendFeedback.company_id == current_user.company_id,
    ).order_by(GiftResendFeedback.created_at.asc()).all()
    return [
        GiftResendFeedbackOut(
            id=fb.id,
            record_id=fb.record_id,
            user_id=fb.user_id,
            content=fb.content,
            created_at=fb.created_at,
            user_name=fb.user.name if fb.user else "",
        )
        for fb in feedbacks
    ]
