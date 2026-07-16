from datetime import datetime
from collections import Counter
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db, ReturnExchangeRecord, GiftRecord, GiftFeedback, User, ReturnExchangeFeedback, AfterSalesChargeRequest
from schemas import (
    ReturnExchangeCreate,
    ReturnExchangeUpdate,
    ReturnExchangeOut,
    GiftBrief,
    ReturnExchangeFeedbackCreate,
    ReturnExchangeFeedbackOut,
    AfterSalesChargeRequestCreate,
    AfterSalesChargeRequestPaid,
    AfterSalesChargeRequestCancel,
    AfterSalesChargeRequestOut,
)
from auth import apply_owner_filter,  get_current_user, require_permission
from services import audit_service
from services.charge_service import create_aftersales_charge_request

router = APIRouter(prefix="/api/return-exchange", tags=["return_exchange"])


def record_to_out(r: ReturnExchangeRecord, matched_gift=None) -> ReturnExchangeOut:
    damage_items = r.damage_items or []
    total_damage = sum(item.get("amount", 0) for item in damage_items if isinstance(item, dict))
    return ReturnExchangeOut(
        id=r.id,
        apply_date=r.apply_date or "",
        shop_name=r.shop_name or "",
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
        upgrade_config=r.upgrade_config or "",
        upgrade_fee=r.upgrade_fee or 0,
        has_damage=r.has_damage or False,
        damage_items=[{"name": item.get("name", ""), "amount": item.get("amount", 0), "desc": item.get("desc", "")} for item in damage_items if isinstance(item, dict)],
        total_damage_amount=total_damage,
        claim_status=r.claim_status or "none",
        created_by=r.created_by,
        creator_name=r.creator.name if r.creator else "",
        created_at=r.created_at,
        updated_at=r.updated_at,
        matched_gift=matched_gift,
    )


@router.get("", response_model=dict)
def list_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    status: str = Query("", description="Filter by progress"),
    record_type: str = Query("", description="Filter by record type: return/exchange"),
    shop_name: str = Query("", description="Filter by shop_name"),
    search: str = Query("", description="Search in order_no/return_tracking/model/customer_info"),
    start_date: str = Query("", description="Filter by apply_date >= start_date (YYYY-MM-DD)"),
    end_date: str = Query("", description="Filter by apply_date <= end_date (YYYY-MM-DD)"),
    all: bool = Query(False, description="Return all records (for export)"),
    has_damage: str = Query("", description="Filter by has_damage: true/false"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:view")),
):
    query = db.query(ReturnExchangeRecord).filter(ReturnExchangeRecord.company_id == current_user.company_id)
    query = apply_owner_filter(query, ReturnExchangeRecord, current_user)
    if status:
        query = query.filter(ReturnExchangeRecord.progress == status)
    if record_type:
        query = query.filter(ReturnExchangeRecord.record_type == record_type)
    if shop_name:
        query = query.filter(ReturnExchangeRecord.shop_name == shop_name)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (ReturnExchangeRecord.order_no.like(pattern))
            | (ReturnExchangeRecord.return_tracking.like(pattern))
            | (ReturnExchangeRecord.send_tracking.like(pattern))
            | (ReturnExchangeRecord.model.like(pattern))
            | (ReturnExchangeRecord.customer_info.like(pattern))
        )
    if start_date:
        query = query.filter(ReturnExchangeRecord.apply_date >= start_date)
    if end_date:
        query = query.filter(ReturnExchangeRecord.apply_date <= end_date)
    if has_damage == "true":
        query = query.filter(ReturnExchangeRecord.has_damage == True)
    elif has_damage == "false":
        query = query.filter(ReturnExchangeRecord.has_damage == False)
    # 计算重复订单号
    all_order_nos = [r[0] for r in query.with_entities(ReturnExchangeRecord.order_no).filter(ReturnExchangeRecord.order_no != "").all()]
    dup_counts = dict(Counter(all_order_nos))
    if all:
        items = query.order_by(ReturnExchangeRecord.created_at.desc()).all()
        out_items = [record_to_out(r) for r in items]
        for o in out_items:
            o.duplicate_count = dup_counts.get(o.order_no, 0)
        return {"total": len(items), "page": 1, "page_size": len(items), "items": out_items}
    total = query.count()
    items = query.order_by(ReturnExchangeRecord.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    # 批量关联发货单（按订单号）
    order_nos = list({r.order_no for r in items if r.order_no})
    gift_map = {}
    if order_nos:
        gifts = db.query(GiftRecord).filter(
            GiftRecord.company_id == current_user.company_id,
            GiftRecord.order_no.in_(order_nos),
        ).all()
        for g in gifts:
            gift_map[g.order_no] = GiftBrief(
                id=g.id, date=g.date or "", model=g.model or "",
                config=g.config or "", color=g.color or "",
                quantity=g.quantity or 0, accessories=g.accessories or "",
                send_tracking=g.send_tracking or "", order_amount=g.order_amount or 0,
                gift_costs=g.gift_costs or [], status=g.status or "",
            )
    out_items = [record_to_out(r, gift_map.get(r.order_no)) for r in items]
    for o in out_items:
        o.duplicate_count = dup_counts.get(o.order_no, 0)
    return {"total": total, "page": page, "page_size": page_size, "items": out_items}


@router.get("/{record_id}", response_model=ReturnExchangeOut)
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:view")),
):
    r = db.query(ReturnExchangeRecord).filter(ReturnExchangeRecord.id == record_id, ReturnExchangeRecord.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    matched_gift = None
    if r.order_no:
        gift = db.query(GiftRecord).filter(
            GiftRecord.company_id == current_user.company_id,
            GiftRecord.order_no == r.order_no,
        ).first()
        if gift:
            matched_gift = GiftBrief(
                id=gift.id,
                date=gift.date or "",
                model=gift.model or "",
                config=gift.config or "",
                color=gift.color or "",
                quantity=gift.quantity or 0,
                accessories=gift.accessories or "",
                send_tracking=gift.send_tracking or "",
                order_amount=gift.order_amount or 0,
                gift_costs=gift.gift_costs or [],
                status=gift.status or "",
            )
    return record_to_out(r, matched_gift)


@router.post("", response_model=ReturnExchangeOut)
def create_record(
    req: ReturnExchangeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:create")),
):
    r = ReturnExchangeRecord(
        company_id=current_user.company_id,
        apply_date=req.apply_date,
        shop_name=req.shop_name,
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
        upgrade_config=req.upgrade_config,
        upgrade_fee=req.upgrade_fee,
        has_damage=req.has_damage,
        damage_items=[item.model_dump() for item in req.damage_items] if req.damage_items else [],
        claim_status=req.claim_status,
        created_by=current_user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    # 关联发货单：添加处理记录
    if r.order_no:
        gift = db.query(GiftRecord).filter(
            GiftRecord.company_id == current_user.company_id,
            GiftRecord.order_no == r.order_no,
        ).first()
        if gift:
            type_label = next((t["label"] for t in [
                {"value": "return", "label": "退货"},
                {"value": "exchange", "label": "换货"},
                {"value": "upgrade", "label": "升级配置"},
            ] if t["value"] == r.record_type), r.record_type or "退换")
            fb = GiftFeedback(
                company_id=current_user.company_id,
                record_id=gift.id,
                user_id=current_user.id,
                content=f"退换登记 #{r.id}: 客户申请{type_label}，原因: {r.return_reason or '未填写'}",
            )
            db.add(fb)
            db.commit()
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
    old_progress = r.progress
    update_data = req.model_dump(exclude_none=True)
    # 记录变更前的值
    changes = {}
    for field, value in update_data.items():
        old_val = getattr(r, field, None)
        if old_val != value:
            changes[field] = {"old": str(old_val) if old_val is not None else "", "new": str(value) if value is not None else ""}
    for field, value in update_data.items():
        setattr(r, field, value)
    # 退货完成 → 联动发货登记状态
    if r.progress == "completed" and r.record_type == "return" and r.order_no and r.order_no.strip():
        gift = db.query(GiftRecord).filter(
            GiftRecord.company_id == r.company_id,
            GiftRecord.order_no == r.order_no,
        ).first()
        if gift and gift.status not in ("intercepted", "torn", "cancelled"):
            gift.status = "returned"
    # 进度变更 → 关联发货单添加处理记录
    if r.progress != old_progress and r.order_no:
        gift = db.query(GiftRecord).filter(
            GiftRecord.company_id == r.company_id,
            GiftRecord.order_no == r.order_no,
        ).first()
        if gift:
            progress_map = {"pending": "待处理", "processing": "处理中", "completed": "已完成"}
            old_label = progress_map.get(old_progress, old_progress or "未设置")
            new_label = progress_map.get(r.progress, r.progress)
            db.add(GiftFeedback(
                company_id=current_user.company_id,
                record_id=gift.id,
                user_id=current_user.id,
                content=f"退换登记 #{record_id}: 处理进度 {old_label} → {new_label}",
            ))
    # 状态变更通知
    if r.progress != old_progress and r.created_by:
        try:
            from services.notification_service import create_and_push
            type_label = "退货" if r.record_type == "return" else "换货"
            status_map = {"pending": "待处理", "processing": "处理中", "completed": "已完成"}
            create_and_push(db, r.created_by, r.id,
                            f"{type_label} #{r.id} 状态变更",
                            f"状态已更新为：{status_map.get(r.progress, r.progress)}",
                            resource_type="return_exchange")
        except Exception:
            pass
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "update", "return_exchange", r.id,
                      f"更新退换登记: #{r.id}", changes=changes or None)
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


# ── 收费审批 ─────────────────────────────────────────────────────

def charge_to_out(charge_request: AfterSalesChargeRequest) -> AfterSalesChargeRequestOut:
    return AfterSalesChargeRequestOut(
        id=charge_request.id,
        after_sales_record_id=charge_request.after_sales_record_id,
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


@router.post("/{record_id}/charge-requests", response_model=AfterSalesChargeRequestOut)
def create_record_charge_request(
    record_id: int,
    req: AfterSalesChargeRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:process")),
):
    record = db.query(ReturnExchangeRecord).filter(
        ReturnExchangeRecord.id == record_id,
        ReturnExchangeRecord.company_id == current_user.company_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    charge_request = create_aftersales_charge_request(
        db=db,
        record=record,
        current_user=current_user,
        expected_amount=req.expected_amount,
        charge_note=req.charge_note,
    )
    return charge_to_out(charge_request)


@router.get("/{record_id}/charge-requests", response_model=list[AfterSalesChargeRequestOut])
def list_record_charge_requests(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:view")),
):
    record = db.query(ReturnExchangeRecord).filter(
        ReturnExchangeRecord.id == record_id,
        ReturnExchangeRecord.company_id == current_user.company_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    charge_requests = db.query(AfterSalesChargeRequest).filter(
        AfterSalesChargeRequest.after_sales_record_id == record_id,
        AfterSalesChargeRequest.company_id == current_user.company_id,
    ).order_by(AfterSalesChargeRequest.created_at.desc(), AfterSalesChargeRequest.id.desc()).all()
    return [charge_to_out(item) for item in charge_requests]


@router.post("/charge-requests/{charge_id}/mark-paid", response_model=AfterSalesChargeRequestOut)
def mark_record_charge_paid(
    charge_id: int,
    req: AfterSalesChargeRequestPaid,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:process")),
):
    charge_request = db.query(AfterSalesChargeRequest).filter(
        AfterSalesChargeRequest.id == charge_id,
        AfterSalesChargeRequest.company_id == current_user.company_id,
    ).first()
    if not charge_request:
        raise HTTPException(status_code=404, detail="Charge request not found")
    charge_request.paid_amount = req.paid_amount
    charge_request.amount_change_note = req.amount_change_note or ""
    charge_request.status = "paid"
    charge_request.paid_by = current_user.id
    charge_request.paid_at = datetime.now()
    db.commit()
    db.refresh(charge_request)

    # 自动添加处理记录
    record = charge_request.record
    if record:
        feedback = ReturnExchangeFeedback(
            company_id=current_user.company_id,
            record_id=record.id,
            user_id=current_user.id,
            content=f"确认收费，实收金额: ¥{req.paid_amount:.2f}" + (f"，改价说明: {req.amount_change_note}" if req.amount_change_note else ""),
        )
        db.add(feedback)
        db.commit()

    return charge_to_out(charge_request)


@router.post("/charge-requests/{charge_id}/cancel", response_model=AfterSalesChargeRequestOut)
def cancel_record_charge_request(
    charge_id: int,
    req: AfterSalesChargeRequestCancel,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:process")),
):
    charge_request = db.query(AfterSalesChargeRequest).filter(
        AfterSalesChargeRequest.id == charge_id,
        AfterSalesChargeRequest.company_id == current_user.company_id,
    ).first()
    if not charge_request:
        raise HTTPException(status_code=404, detail="Charge request not found")
    charge_request.status = "cancelled"
    db.commit()
    db.refresh(charge_request)

    # 自动添加处理记录
    record = charge_request.record
    if record:
        feedback = ReturnExchangeFeedback(
            company_id=current_user.company_id,
            record_id=record.id,
            user_id=current_user.id,
            content=f"取消收费，原因: {req.reason}" if req.reason else "取消收费",
        )
        db.add(feedback)
        db.commit()

    return charge_to_out(charge_request)


@router.get("/charge-requests/{charge_id}", response_model=AfterSalesChargeRequestOut)
def get_charge_request(
    charge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("return_exchange:view")),
):
    charge_request = db.query(AfterSalesChargeRequest).filter(
        AfterSalesChargeRequest.id == charge_id,
        AfterSalesChargeRequest.company_id == current_user.company_id,
    ).first()
    if not charge_request:
        raise HTTPException(status_code=404, detail="Charge request not found")
    return charge_to_out(charge_request)

