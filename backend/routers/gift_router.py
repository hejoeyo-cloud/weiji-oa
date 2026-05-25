from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, GiftRecord, GiftCashback, GiftFeedback, User
from schemas import GiftRecordCreate, GiftRecordUpdate, GiftRecordOut, GiftFeedbackCreate, GiftFeedbackOut
from auth import apply_owner_filter,  get_current_user
from services import audit_service

router = APIRouter(prefix="/api/gifts", tags=["gifts"])


def get_total_cashback(db: Session, order_no: str, company_id: int) -> float:
    """根据订单号汇总返现表中的返现总金额"""
    if not order_no:
        return 0
    result = db.query(func.coalesce(func.sum(GiftCashback.cashback_amount), 0)).filter(
        GiftCashback.order_no == order_no
        , GiftCashback.company_id == company_id
    ).scalar()
    return float(result) if result else 0


def record_to_out(db: Session, r: GiftRecord, has_cost_permission: bool = False) -> GiftRecordOut:
    """将数据库记录转为输出，has_cost_permission 控制是否返回成本字段"""
    total_cashback = get_total_cashback(db, r.order_no, r.company_id)
    profit = (r.order_amount or 0) - (r.cost or 0) - total_cashback
    
    out = GiftRecordOut(
        id=r.id,
        date=r.date or "",
        order_no=r.order_no or "",
        size=r.size or "",
        model=r.model or "",
        config=r.config or "",
        color=r.color or "",
        quantity=r.quantity or 1,
        accessories=r.accessories or "",
        customer_info=r.customer_info or "",
        send_tracking=r.send_tracking or "",
        shipping_fee=r.shipping_fee or 0,
        total_cashback=total_cashback,
        profit=profit,
        remark=r.remark or "",
        ship_date=r.ship_date or "",
        status=r.status or "pending",
        created_by=r.created_by,
        creator_name=r.creator.name if r.creator else "",
        created_at=r.created_at,
        updated_at=r.updated_at,
    )
    
    # 根据权限决定是否返回成本相关字段
    if has_cost_permission:
        out.order_amount = r.order_amount or 0
        out.cost = r.cost or 0
    else:
        out.order_amount = 0
        out.cost = 0
    
    return out


@router.get("", response_model=dict)
def list_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    status: str = Query("", description="Filter by status"),
    search: str = Query("", description="Search in order_no/model/customer_info"),
    start_date: str = Query("", description="Filter by date >= start_date (YYYY-MM-DD)"),
    end_date: str = Query("", description="Filter by date <= end_date (YYYY-MM-DD)"),
    all: bool = Query(False, description="Return all records (for export)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 检查用户是否有成本查看权限
    has_cost_permission = "gifts:cost_view" in (current_user.role_obj.permissions if current_user.role_obj else [])
    
    query = db.query(GiftRecord).filter(GiftRecord.company_id == current_user.company_id)
    query = apply_owner_filter(query, GiftRecord, current_user)
    if status:
        query = query.filter(GiftRecord.status == status)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (GiftRecord.order_no.like(pattern))
            | (GiftRecord.model.like(pattern))
            | (GiftRecord.customer_info.like(pattern))
        )
    if start_date:
        query = query.filter(GiftRecord.date >= start_date)
    if end_date:
        query = query.filter(GiftRecord.date <= end_date)
    if all:
        items = query.order_by(GiftRecord.created_at.desc()).all()
        return {"total": len(items), "page": 1, "page_size": len(items), 
                "items": [record_to_out(db, r, has_cost_permission) for r in items]}
    total = query.count()
    items = query.order_by(GiftRecord.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [record_to_out(db, r, has_cost_permission) for r in items],
    }


@router.get("/{record_id}", response_model=GiftRecordOut)
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 检查用户是否有成本查看权限
    has_cost_permission = "gifts:cost_view" in (current_user.role_obj.permissions if current_user.role_obj else [])
    
    r = db.query(GiftRecord).filter(GiftRecord.id == record_id, GiftRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    return record_to_out(db, r, has_cost_permission)


@router.post("", response_model=GiftRecordOut)
def create_record(
    req: GiftRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    has_cost_permission = "gifts:cost_view" in (current_user.role_obj.permissions if current_user.role_obj else [])
    
    r = GiftRecord(
        company_id=current_user.company_id,
        date=req.date,
        order_no=req.order_no,
        size=req.size,
        model=req.model,
        config=req.config,
        color=req.color,
        quantity=req.quantity,
        accessories=req.accessories,
        customer_info=req.customer_info,
        send_tracking=req.send_tracking,
        shipping_fee=req.shipping_fee,
        order_amount=req.order_amount,
        cost=req.cost,
        remark=req.remark,
        ship_date=req.ship_date,
        status=req.status,
        created_by=current_user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "create", "gift", r.id,
                      f"创建发货登记: #{r.id} {r.order_no}")
    return record_to_out(db, r, has_cost_permission)


@router.put("/{record_id}", response_model=GiftRecordOut)
def update_record(
    record_id: int,
    req: GiftRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    has_cost_permission = "gifts:cost_view" in (current_user.role_obj.permissions if current_user.role_obj else [])
    
    r = db.query(GiftRecord).filter(GiftRecord.id == record_id, GiftRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    for field, value in req.model_dump(exclude_none=True).items():
        # 排除前端传过来的 cashback 字段（现在由返现表独立管理）
        if field == "cashback":
            continue
        setattr(r, field, value)
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "update", "gift", r.id,
                      f"更新发货登记: #{r.id}")
    return record_to_out(db, r, has_cost_permission)


@router.delete("/{record_id}")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(GiftRecord).filter(GiftRecord.id == record_id, GiftRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    audit_service.log(db, current_user, "delete", "gift", record_id,
                      f"删除发货登记: #{record_id}")
    db.delete(r)
    db.commit()
    return {"message": "OK"}


@router.post("/{record_id}/feedback", response_model=GiftFeedbackOut)
def add_feedback(
    record_id: int,
    req: GiftFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(GiftRecord).filter(GiftRecord.id == record_id, GiftRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    fb = GiftFeedback(
        company_id=current_user.company_id,
        record_id=record_id,
        user_id=current_user.id,
        content=req.content,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return GiftFeedbackOut(
        id=fb.id,
        record_id=fb.record_id,
        user_id=fb.user_id,
        content=fb.content,
        created_at=fb.created_at,
        user_name=current_user.name,
    )


@router.get("/{record_id}/feedbacks", response_model=list[GiftFeedbackOut])
def get_feedbacks(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feedbacks = db.query(GiftFeedback).filter(
        GiftFeedback.record_id == record_id,
        GiftFeedback.company_id == current_user.company_id,
    ).order_by(GiftFeedback.created_at.asc()).all()
    return [
        GiftFeedbackOut(
            id=fb.id,
            record_id=fb.record_id,
            user_id=fb.user_id,
            content=fb.content,
            created_at=fb.created_at,
            user_name=fb.user.name if fb.user else "",
        )
        for fb in feedbacks
    ]
