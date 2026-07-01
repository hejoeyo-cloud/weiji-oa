from collections import Counter
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, GiftCashback, GiftCashbackFeedback, GiftRecord, User
from schemas import GiftCashbackCreate, GiftCashbackUpdate, GiftCashbackOut, GiftCashbackFeedbackCreate, GiftCashbackFeedbackOut
from auth import get_current_user, require_permission, apply_owner_filter
from services import audit_service

router = APIRouter(prefix="/api/gift-cashback", tags=["gift-cashback"])


def cashback_to_out(c: GiftCashback) -> GiftCashbackOut:
    return GiftCashbackOut(
        id=c.id,
        shop_name=c.shop_name or "",
        order_no=c.order_no or "",
        cashback_amount=c.cashback_amount or 0,
        reason=c.reason or "",
        remark=c.remark or "",
        applicant=c.applicant or "",
        payment_method=c.payment_method or "",
        payment_account=c.payment_account or "",
        payment_qr_code=c.payment_qr_code or "",
        payee=c.payee or "",
        status=c.status or "pending",
        created_by=c.created_by,
        creator_name=c.creator.name if c.creator else "",
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.get("", response_model=dict)
def list_cashbacks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    shop_name: str = Query("", description="Filter by shop_name"),
    status: str = Query("", description="Filter by status"),
    search: str = Query("", description="Search in order_no/applicant"),
    start_date: str = Query("", description="Filter by created_at >= start_date (YYYY-MM-DD)"),
    end_date: str = Query("", description="Filter by created_at <= end_date (YYYY-MM-DD)"),
    all: bool = Query(False, description="Return all records (for export)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("gift_cashback:view")),
):
    query = db.query(GiftCashback).filter(GiftCashback.company_id == current_user.company_id)
    query = apply_owner_filter(query, GiftCashback, current_user)
    if shop_name:
        query = query.filter(GiftCashback.shop_name == shop_name)
    if status:
        query = query.filter(GiftCashback.status == status)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (GiftCashback.order_no.like(pattern))
            | (GiftCashback.applicant.like(pattern))
        )
    if start_date:
        query = query.filter(GiftCashback.created_at >= start_date)
    if end_date:
        query = query.filter(GiftCashback.created_at <= end_date)
    # 计算重复订单号
    all_order_nos = [r[0] for r in query.with_entities(GiftCashback.order_no).filter(GiftCashback.order_no != "").all()]
    dup_counts = dict(Counter(all_order_nos))
    if all:
        items = query.order_by(GiftCashback.created_at.desc()).all()
        out_items = [cashback_to_out(c) for c in items]
        for o in out_items:
            o.duplicate_count = dup_counts.get(o.order_no, 0)
        return {"total": len(items), "page": 1, "page_size": len(items), "items": out_items}
    total = query.count()
    items = query.order_by(GiftCashback.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    out_items = [cashback_to_out(c) for c in items]
    for o in out_items:
        o.duplicate_count = dup_counts.get(o.order_no, 0)
    return {"total": total, "page": page, "page_size": page_size, "items": out_items}


@router.get("/{cashback_id}", response_model=GiftCashbackOut)
def get_cashback(
    cashback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("gift_cashback:create")),
):
    c = db.query(GiftCashback).filter(GiftCashback.id == cashback_id, GiftCashback.company_id == current_user.company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cashback not found")
    return cashback_to_out(c)


@router.post("", response_model=GiftCashbackOut)
def create_cashback(
    req: GiftCashbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("gift_cashback:edit")),
):
    c = GiftCashback(
        company_id=current_user.company_id,
        shop_name=req.shop_name,
        order_no=req.order_no,
        cashback_amount=req.cashback_amount,
        reason=req.reason,
        remark=req.remark,
        applicant=req.applicant,
        payment_method=req.payment_method,
        payment_account=req.payment_account,
        payment_qr_code=req.payment_qr_code,
        payee=req.payee,
        status=req.status or "pending",
        created_by=current_user.id,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    # 自动记录处理日志
    db.add(GiftCashbackFeedback(
        company_id=current_user.company_id,
        record_id=c.id,
        user_id=current_user.id,
        content=f"创建返现登记 #{c.id}，订单号:{c.order_no}，金额:¥{c.cashback_amount:.2f}",
    ))
    db.commit()
    audit_service.log(db, current_user, "create", "gift_cashback", c.id,
                      f"创建返现登记: #{c.id} 订单号:{c.order_no} 金额:{c.cashback_amount}")
    return cashback_to_out(c)


@router.put("/{cashback_id}", response_model=GiftCashbackOut)
def update_cashback(
    cashback_id: int,
    req: GiftCashbackUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("gift_cashback:delete")),
):
    c = db.query(GiftCashback).filter(GiftCashback.id == cashback_id, GiftCashback.company_id == current_user.company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cashback not found")
    old_status = c.status
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    # 状态变更自动留痕
    if req.status and req.status != old_status:
        labels = {"pending": "待返现", "completed": "已返现"}
        old_label = labels.get(old_status, old_status)
        new_label = labels.get(req.status, req.status)
        db.add(GiftCashbackFeedback(
            company_id=current_user.company_id,
            record_id=cashback_id,
            user_id=current_user.id,
            content=f"状态变更: {old_label} → {new_label}",
        ))
        db.commit()
    audit_service.log(db, current_user, "update", "gift_cashback", cashback_id,
                      f"更新返现登记: #{cashback_id}")
    return cashback_to_out(c)


@router.delete("/{cashback_id}")
def delete_cashback(
    cashback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(GiftCashback).filter(GiftCashback.id == cashback_id, GiftCashback.company_id == current_user.company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cashback not found")
    audit_service.log(db, current_user, "delete", "gift_cashback", cashback_id,
                      f"删除返现登记: #{cashback_id}")
    db.delete(c)
    db.commit()
    return {"message": "OK"}


# ── 处理记录（工作留痕） ──────────────────────────────────────────

@router.post("/{cashback_id}/feedback", response_model=GiftCashbackFeedbackOut)
def add_feedback(
    cashback_id: int,
    req: GiftCashbackFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(GiftCashback).filter(GiftCashback.id == cashback_id, GiftCashback.company_id == current_user.company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cashback not found")
    fb = GiftCashbackFeedback(
        company_id=current_user.company_id,
        record_id=cashback_id,
        user_id=current_user.id,
        content=req.content,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return GiftCashbackFeedbackOut(
        id=fb.id, record_id=fb.record_id, user_id=fb.user_id,
        content=fb.content, created_at=fb.created_at,
        user_name=current_user.name,
    )


@router.get("/{cashback_id}/feedbacks", response_model=list[GiftCashbackFeedbackOut])
def get_feedbacks(
    cashback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feedbacks = db.query(GiftCashbackFeedback).filter(
        GiftCashbackFeedback.record_id == cashback_id,
        GiftCashbackFeedback.company_id == current_user.company_id,
    ).order_by(GiftCashbackFeedback.created_at.asc()).all()
    return [
        GiftCashbackFeedbackOut(
            id=fb.id, record_id=fb.record_id, user_id=fb.user_id,
            content=fb.content, created_at=fb.created_at,
            user_name=fb.user.name if fb.user else "",
        )
        for fb in feedbacks
    ]


@router.get("/by-order/{order_no}", response_model=list[GiftCashbackOut])
def get_cashbacks_by_order(
    order_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """根据订单号获取所有返现记录"""
    cashbacks = db.query(GiftCashback).filter(
        GiftCashback.order_no == order_no,
        GiftCashback.company_id == current_user.company_id,
    ).order_by(GiftCashback.created_at.desc()).all()
    return [cashback_to_out(c) for c in cashbacks]
