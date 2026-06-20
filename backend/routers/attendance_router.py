from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db, AttendanceRecord, User, ScheduleSlot, ScheduleShift, Department
from schemas import CheckInRequest, AttendanceRecordOut, MonthlyAttendanceStats
from auth import get_current_user, require_permission

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def _record_to_out(r: AttendanceRecord) -> AttendanceRecordOut:
    return AttendanceRecordOut(
        id=r.id,
        company_id=r.company_id,
        user_id=r.user_id,
        user_name=r.user.name if r.user else "",
        department_name=r.user.department.name if r.user and r.user.department else "",
        date=r.date,
        check_in=r.check_in,
        check_out=r.check_out,
        status=r.status,
        source=r.source or "manual",
        location=r.location,
        remark=r.remark,
        scheduled_start=r.scheduled_start or "",
        scheduled_end=r.scheduled_end or "",
        created_at=r.created_at,
    )


def _get_today_shift(db: Session, user_id: int, company_id: int, date_str: str):
    """查询用户当天的排班，返回 (ScheduleShift, ScheduleSlot) 或 (None, None)"""
    slot = db.query(ScheduleSlot).filter(
        ScheduleSlot.user_id == user_id,
        ScheduleSlot.date == date_str,
        ScheduleSlot.company_id == company_id,
    ).first()
    if not slot:
        return None, None
    shift = db.query(ScheduleShift).filter(
        ScheduleShift.id == slot.shift_id,
        ScheduleShift.company_id == company_id,
    ).first()
    return shift, slot


@router.post("/check-in", response_model=AttendanceRecordOut)
def check_in(
    req: CheckInRequest,
    current_user: User = Depends(require_permission("attendance:view")),
    db: Session = Depends(get_db),
):
    now = datetime.now()
    today = now.strftime("%Y-%m-%d")

    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.date == today,
        AttendanceRecord.company_id == current_user.company_id,
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="今天已经签到过了")

    # 查询排班
    shift, slot = _get_today_shift(db, current_user.id, current_user.company_id, today)

    scheduled_start = ""
    scheduled_end = ""
    if shift and not shift.is_rest:
        scheduled_start = shift.start_time or ""
        scheduled_end = shift.end_time or ""
        # 按排班时间判定迟到
        try:
            start_h, start_m = map(int, shift.start_time.split(":"))
            if now.hour > start_h or (now.hour == start_h and now.minute > start_m):
                status = "late"
            else:
                status = "normal"
        except (ValueError, AttributeError):
            status = "normal"
    elif shift and shift.is_rest:
        # 休息日上班
        status = "normal"
    else:
        # 无排班
        status = "no_shift"

    record = AttendanceRecord(
        company_id=current_user.company_id,
        user_id=current_user.id,
        date=today,
        check_in=now,
        status=status,
        location=req.location,
        remark=req.remark,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _record_to_out(record)


@router.post("/check-out", response_model=AttendanceRecordOut)
def check_out(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now()
    today = now.strftime("%Y-%m-%d")

    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.date == today,
        AttendanceRecord.company_id == current_user.company_id,
    ).first()

    if not record:
        raise HTTPException(status_code=400, detail="今天尚未签到，请先签到")

    if record.check_out:
        raise HTTPException(status_code=400, detail="今天已经签退过了")

    record.check_out = now

    # 按排班时间判定早退（仅当有排班且未迟到时）
    if record.scheduled_end and record.status != "late" and record.status != "no_shift":
        try:
            end_h, end_m = map(int, record.scheduled_end.split(":"))
            if now.hour < end_h or (now.hour == end_h and now.minute < end_m):
                record.status = "early"
        except (ValueError, AttributeError):
            pass

    db.commit()
    db.refresh(record)
    return _record_to_out(record)


@router.get("/today", response_model=Optional[AttendanceRecordOut])
def get_today(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = datetime.now().strftime("%Y-%m-%d")
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.date == today,
        AttendanceRecord.company_id == current_user.company_id,
    ).first()
    if not record:
        return None
    return _record_to_out(record)


@router.get("/today-shift")
def get_today_shift(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回当天排班信息，供前端打卡区展示"""
    today = datetime.now().strftime("%Y-%m-%d")
    shift, slot = _get_today_shift(db, current_user.id, current_user.company_id, today)
    if not shift:
        return {"has_shift": False}
    return {
        "has_shift": True,
        "shift_name": shift.name,
        "start_time": shift.start_time,
        "end_time": shift.end_time,
        "is_rest": shift.is_rest,
        "color": shift.color,
    }


def _build_records_query(db: Session, current_user: User, month: str, department_id: int = 0, user_id: int = 0):
    """构建考勤查询，根据权限自动过滤范围"""
    has_manage = "attendance:manage" in (current_user.role_obj.permissions if current_user.role_obj else [])
    is_mgr = getattr(current_user, 'is_manager', False)

    query = db.query(AttendanceRecord).filter(AttendanceRecord.company_id == current_user.company_id)

    if has_manage:
        # 有 manage 权限：全公司，可选筛选部门/用户
        if department_id:
            dept_user_ids = [u.id for u in db.query(User).filter(User.department_id == department_id, User.company_id == current_user.company_id).all()]
            query = query.filter(AttendanceRecord.user_id.in_(dept_user_ids))
        if user_id:
            query = query.filter(AttendanceRecord.user_id == user_id)
    elif is_mgr:
        # 部门经理：本部门
        dept_id = current_user.department_id
        if dept_id:
            dept_user_ids = [u.id for u in db.query(User).filter(User.department_id == dept_id, User.company_id == current_user.company_id).all()]
            query = query.filter(AttendanceRecord.user_id.in_(dept_user_ids))
        else:
            # 无部门则只看自己
            query = query.filter(AttendanceRecord.user_id == current_user.id)
    else:
        # 普通用户：只看自己
        query = query.filter(AttendanceRecord.user_id == current_user.id)

    if month:
        query = query.filter(AttendanceRecord.date.like(f"{month}%"))
    return query, has_manage


@router.get("/records")
def get_records(
    month: str = "",
    department_id: int = Query(0),
    user_id: int = Query(0),
    all: bool = Query(False, description="Return all records (for export)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query, has_manage = _build_records_query(db, current_user, month, department_id, user_id)
    if all:
        records = query.order_by(AttendanceRecord.date.desc()).all()
        return [_record_to_out(r) for r in records]
    records = query.order_by(AttendanceRecord.date.desc()).limit(62).all()
    return [_record_to_out(r) for r in records]


@router.get("/stats", response_model=MonthlyAttendanceStats)
def get_monthly_stats(
    month: str = "",
    department_id: int = Query(0),
    user_id: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not month:
        month = datetime.now().strftime("%Y-%m")
    query, _ = _build_records_query(db, current_user, month, department_id, user_id)
    records = query.all()

    total = len(records)
    normal = sum(1 for r in records if r.status == "normal")
    late = sum(1 for r in records if r.status == "late")
    early = sum(1 for r in records if r.status == "early")
    absent = sum(1 for r in records if r.status == "absent")

    return MonthlyAttendanceStats(
        total_days=total,
        normal_days=normal,
        late_days=late,
        early_days=early,
        absent_days=absent,
    )


@router.get("/departments")
def get_departments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回公司部门列表，供管理视图筛选"""
    has_manage = "attendance:manage" in (current_user.role_obj.permissions if current_user.role_obj else [])
    is_mgr = getattr(current_user, 'is_manager', False)

    if has_manage:
        depts = db.query(Department).filter(Department.company_id == current_user.company_id).order_by(Department.sort_order).all()
    elif is_mgr and current_user.department_id:
        depts = [db.query(Department).filter(Department.id == current_user.department_id).first()]
        depts = [d for d in depts if d]
    else:
        return []
    return [{"id": d.id, "name": d.name} for d in depts]


@router.get("/today-count", response_model=int)
def get_today_attendance_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = datetime.now().strftime("%Y-%m-%d")
    count = db.query(func.count(AttendanceRecord.id)).filter(
        AttendanceRecord.date == today,
        AttendanceRecord.company_id == current_user.company_id,
    ).scalar() or 0
    return count
