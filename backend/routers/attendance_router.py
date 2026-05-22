from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db, AttendanceRecord, User
from schemas import CheckInRequest, AttendanceRecordOut, MonthlyAttendanceStats
from auth import get_current_user

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def _record_to_out(r: AttendanceRecord) -> AttendanceRecordOut:
    return AttendanceRecordOut(
        id=r.id,
        company_id=r.company_id,
        user_id=r.user_id,
        user_name=r.user.name if r.user else "",
        date=r.date,
        check_in=r.check_in,
        check_out=r.check_out,
        status=r.status,
        source=r.source or "manual",
        location=r.location,
        remark=r.remark,
        created_at=r.created_at,
    )


@router.post("/check-in", response_model=AttendanceRecordOut)
def check_in(
    req: CheckInRequest,
    current_user: User = Depends(get_current_user),
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

    status = "normal"
    # 9:00 之后签到算迟到
    if now.hour >= 9:
        status = "late"

    record = AttendanceRecord(
        company_id=current_user.company_id,
        user_id=current_user.id,
        date=today,
        check_in=now,
        status=status,
        location=req.location,
        remark=req.remark,
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
    # 18:00 前签退算早退
    if record.status != "late" and now.hour < 18:
        record.status = "early"

    db.commit()
    db.refresh(record)
    return _record_to_out(record)


@router.get("/today", response_model=AttendanceRecordOut | None)
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


@router.get("/records", response_model=list[AttendanceRecordOut])
def get_records(
    month: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.company_id == current_user.company_id,
    )
    if month:
        query = query.filter(AttendanceRecord.date.like(f"{month}%"))
    records = query.order_by(AttendanceRecord.date.desc()).limit(62).all()
    return [_record_to_out(r) for r in records]


@router.get("/stats", response_model=MonthlyAttendanceStats)
def get_monthly_stats(
    month: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not month:
        month = datetime.now().strftime("%Y-%m")
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.date.like(f"{month}%"),
        AttendanceRecord.company_id == current_user.company_id,
    ).all()

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
