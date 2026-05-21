from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db, ScheduleShift, ScheduleSlot, ShiftSwapRequest, User
from schemas import (
    ScheduleShiftCreate, ScheduleShiftUpdate, ScheduleShiftOut,
    ScheduleSlotCreate, ScheduleSlotBatchCreate, ScheduleSlotBatchRangeCreate, ScheduleSlotOut,
    ShiftSwapRequestCreate, ShiftSwapAction, ShiftSwapRequestOut,
)
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


# ── 排班相关用户列表（所有登录用户可查看） ──────────────────────────
@router.get("/users", response_model=list[dict])
def list_schedule_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """排班表专用：获取所有用户的基本信息（id/name/role）"""
    users = db.query(User).filter(User.company_id == current_user.company_id).order_by(User.name).all()
    return [{"id": u.id, "name": u.name, "role": u.role} for u in users]


# ── 班次类型管理（仅管理员） ────────────────────────────────────────
@router.get("/shifts", response_model=list[ScheduleShiftOut])
def list_shifts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(ScheduleShift).filter(ScheduleShift.company_id == current_user.company_id).order_by(ScheduleShift.sort_order).all()


@router.post("/shifts", response_model=ScheduleShiftOut)
def create_shift(
    req: ScheduleShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    s = ScheduleShift(company_id=current_user.company_id, **req.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/shifts/{shift_id}", response_model=ScheduleShiftOut)
def update_shift(
    shift_id: int,
    req: ScheduleShiftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    s = db.query(ScheduleShift).filter(ScheduleShift.id == shift_id, ScheduleShift.company_id == current_user.company_id).first()
    if not s:
        raise HTTPException(404, "班次不存在")
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/shifts/{shift_id}")
def delete_shift(
    shift_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    s = db.query(ScheduleShift).filter(ScheduleShift.id == shift_id, ScheduleShift.company_id == current_user.company_id).first()
    if not s:
        raise HTTPException(404, "班次不存在")
    # 检查是否有排班记录使用此班次
    used = db.query(ScheduleSlot).filter(ScheduleSlot.shift_id == shift_id, ScheduleSlot.company_id == current_user.company_id).count()
    if used > 0:
        raise HTTPException(400, f"该班次仍有 {used} 条排班记录，无法删除")
    db.delete(s)
    db.commit()
    return {"message": "OK"}


# ── 排班记录 ──────────────────────────────────────────────────────
def slot_to_out(slot: ScheduleSlot) -> ScheduleSlotOut:
    return ScheduleSlotOut(
        id=slot.id,
        user_id=slot.user_id,
        user_name=slot.user.name if slot.user else "",
        date=slot.date,
        shift_id=slot.shift_id,
        shift_name=slot.shift.name if slot.shift else "",
        shift_short_name=slot.shift.short_name if slot.shift else "",
        shift_color=slot.shift.color if slot.shift else "#1677FF",
        shift_is_rest=slot.shift.is_rest if slot.shift else False,
    )


@router.get("/slots", response_model=dict)
def list_slots(
    year_month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取某月全部排班数据"""
    try:
        year, month = year_month.split("-")
        start = f"{year}-{month}-01"
        # 计算月末日期
        y, m = int(year), int(month)
        if m == 12:
            end = f"{y+1}-01-01"
        else:
            end = f"{y}-{m+1:02d}-01"
    except (ValueError, IndexError):
        raise HTTPException(400, "year_month 格式错误，应为 YYYY-MM")

    slots = db.query(ScheduleSlot).filter(
        ScheduleSlot.date >= start,
        ScheduleSlot.date < end,
        ScheduleSlot.company_id == current_user.company_id,
    ).order_by(ScheduleSlot.date, ScheduleSlot.user_id).all()

    return {
        "year_month": year_month,
        "items": [slot_to_out(s) for s in slots],
    }


@router.post("/slots", response_model=ScheduleSlotOut)
def create_slot(
    req: ScheduleSlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """设置某人某天的班次（如已存在则更新）"""
    existing = db.query(ScheduleSlot).filter(
        ScheduleSlot.user_id == req.user_id,
        ScheduleSlot.date == req.date,
        ScheduleSlot.company_id == current_user.company_id,
    ).first()
    if existing:
        existing.shift_id = req.shift_id
        existing.created_by = current_user.id
        db.commit()
        db.refresh(existing)
        return slot_to_out(existing)

    s = ScheduleSlot(
        company_id=current_user.company_id,
        user_id=req.user_id,
        date=req.date,
        shift_id=req.shift_id,
        created_by=current_user.id,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return slot_to_out(s)


@router.post("/slots/batch", response_model=dict)
def batch_create_slots(
    req: ScheduleSlotBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """批量设置：同一天多个人的同一班次"""
    count = 0
    for uid in req.user_ids:
        existing = db.query(ScheduleSlot).filter(
            ScheduleSlot.user_id == uid,
            ScheduleSlot.date == req.date,
            ScheduleSlot.company_id == current_user.company_id,
        ).first()
        if existing:
            existing.shift_id = req.shift_id
            existing.created_by = current_user.id
        else:
            db.add(ScheduleSlot(
                company_id=current_user.company_id,
                user_id=uid, date=req.date,
                shift_id=req.shift_id, created_by=current_user.id,
            ))
        count += 1
    db.commit()
    return {"message": "OK", "count": count}


@router.post("/slots/batch-range", response_model=dict)
def batch_range_create_slots(
    req: ScheduleSlotBatchRangeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """批量设置：一个人连续多天同一班次"""
    try:
        start = datetime.strptime(req.start_date, "%Y-%m-%d")
        end = datetime.strptime(req.end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "日期格式错误，应为 YYYY-MM-DD")
    if start > end:
        raise HTTPException(400, "开始日期不能晚于结束日期")

    count = 0
    current = start
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        existing = db.query(ScheduleSlot).filter(
            ScheduleSlot.user_id == req.user_id,
            ScheduleSlot.date == date_str,
            ScheduleSlot.company_id == current_user.company_id,
        ).first()
        if existing:
            existing.shift_id = req.shift_id
            existing.created_by = current_user.id
        else:
            db.add(ScheduleSlot(
                company_id=current_user.company_id,
                user_id=req.user_id, date=date_str,
                shift_id=req.shift_id, created_by=current_user.id,
            ))
        count += 1
        current += timedelta(days=1)
    db.commit()
    return {"message": "OK", "count": count}


@router.delete("/slots/{slot_id}")
def delete_slot(
    slot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    s = db.query(ScheduleSlot).filter(ScheduleSlot.id == slot_id, ScheduleSlot.company_id == current_user.company_id).first()
    if not s:
        raise HTTPException(404, "排班记录不存在")
    db.delete(s)
    db.commit()
    return {"message": "OK"}


# ── 换班申请 ──────────────────────────────────────────────────────
def swap_to_out(swap: ShiftSwapRequest) -> ShiftSwapRequestOut:
    return ShiftSwapRequestOut(
        id=swap.id,
        applicant_id=swap.applicant_id,
        applicant_name=swap.applicant.name if swap.applicant else "",
        target_user_id=swap.target_user_id,
        target_user_name=swap.target_user.name if swap.target_user else "",
        applicant_date=swap.applicant_date,
        target_date=swap.target_date,
        reason=swap.reason or "",
        status=swap.status or "pending",
        reviewer_id=swap.reviewer_id,
        reviewer_name=swap.reviewer.name if swap.reviewer else "",
        review_comment=swap.review_comment or "",
        reviewed_at=swap.reviewed_at,
        created_at=swap.created_at,
    )


@router.get("/swaps", response_model=dict)
def list_swaps(
    status: str = Query("", description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """查看换班申请列表（所有人可见）"""
    query = db.query(ShiftSwapRequest).filter(ShiftSwapRequest.company_id == current_user.company_id)
    if status:
        query = query.filter(ShiftSwapRequest.status == status)
    items = query.order_by(ShiftSwapRequest.created_at.desc()).all()
    return {"items": [swap_to_out(s) for s in items]}


@router.post("/swaps", response_model=ShiftSwapRequestOut)
def create_swap(
    req: ShiftSwapRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """员工提交换班申请"""
    if current_user.id == req.target_user_id:
        raise HTTPException(400, "不能和自己换班")

    # 验证申请人当天确实有排班
    my_slot = db.query(ScheduleSlot).filter(
        ScheduleSlot.user_id == current_user.id,
        ScheduleSlot.date == req.applicant_date,
        ScheduleSlot.company_id == current_user.company_id,
    ).first()
    if not my_slot:
        raise HTTPException(400, f"你在 {req.applicant_date} 没有排班记录")

    # 验证目标人当天确实有排班
    target_slot = db.query(ScheduleSlot).filter(
        ScheduleSlot.user_id == req.target_user_id,
        ScheduleSlot.date == req.target_date,
        ScheduleSlot.company_id == current_user.company_id,
    ).first()
    if not target_slot:
        raise HTTPException(400, f"目标人在 {req.target_date} 没有排班记录")

    swap = ShiftSwapRequest(
        company_id=current_user.company_id,
        applicant_id=current_user.id,
        target_user_id=req.target_user_id,
        applicant_date=req.applicant_date,
        target_date=req.target_date,
        reason=req.reason,
        status="pending",
    )
    db.add(swap)
    db.commit()
    db.refresh(swap)
    return swap_to_out(swap)


@router.put("/swaps/{swap_id}/action", response_model=ShiftSwapRequestOut)
def action_swap(
    swap_id: int,
    req: ShiftSwapAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """管理员审批换班申请"""
    swap = db.query(ShiftSwapRequest).filter(ShiftSwapRequest.id == swap_id, ShiftSwapRequest.company_id == current_user.company_id).first()
    if not swap:
        raise HTTPException(404, "换班申请不存在")
    if swap.status != "pending":
        raise HTTPException(400, "该申请已处理")

    swap.reviewer_id = current_user.id
    swap.review_comment = req.comment
    swap.reviewed_at = datetime.now()

    if req.action == "approve":
        swap.status = "approved"
        # 执行换班：交换两人的班次
        my_slot = db.query(ScheduleSlot).filter(
            ScheduleSlot.user_id == swap.applicant_id,
            ScheduleSlot.date == swap.applicant_date,
            ScheduleSlot.company_id == current_user.company_id,
        ).first()
        target_slot = db.query(ScheduleSlot).filter(
            ScheduleSlot.user_id == swap.target_user_id,
            ScheduleSlot.date == swap.target_date,
            ScheduleSlot.company_id == current_user.company_id,
        ).first()
        if my_slot and target_slot:
            # 交换 shift_id
            my_slot.shift_id, target_slot.shift_id = target_slot.shift_id, my_slot.shift_id
        db.commit()
    elif req.action == "reject":
        swap.status = "rejected"
        db.commit()
    else:
        raise HTTPException(400, "action 必须为 approve 或 reject")

    db.refresh(swap)
    return swap_to_out(swap)


@router.put("/swaps/{swap_id}/cancel", response_model=ShiftSwapRequestOut)
def cancel_swap(
    swap_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """申请人取消换班申请"""
    swap = db.query(ShiftSwapRequest).filter(ShiftSwapRequest.id == swap_id, ShiftSwapRequest.company_id == current_user.company_id).first()
    if not swap:
        raise HTTPException(404, "换班申请不存在")
    if swap.applicant_id != current_user.id:
        raise HTTPException(403, "只能取消自己的换班申请")
    if swap.status != "pending":
        raise HTTPException(400, "只能取消待审批的申请")

    swap.status = "cancelled"
    db.commit()
    db.refresh(swap)
    return swap_to_out(swap)
