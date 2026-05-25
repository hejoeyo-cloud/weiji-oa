from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ScheduleShiftCreate(BaseModel):
    name: str
    short_name: str = ""
    color: str = "#1677FF"
    start_time: str = ""
    end_time: str = ""
    sort_order: int = 0
    is_rest: bool = False

class ScheduleShiftUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    color: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    sort_order: Optional[int] = None
    is_rest: Optional[bool] = None

class ScheduleShiftOut(BaseModel):
    id: int
    name: str
    short_name: str
    color: str
    start_time: str
    end_time: str
    sort_order: int
    is_rest: bool

    class Config:
        from_attributes = True

class ScheduleSlotCreate(BaseModel):
    user_id: int
    date: str                  # YYYY-MM-DD
    shift_id: int

class ScheduleSlotOut(BaseModel):
    id: int
    user_id: int
    user_name: str = ""
    date: str
    shift_id: int
    shift_name: str = ""
    shift_short_name: str = ""
    shift_color: str = "#1677FF"
    shift_is_rest: bool = False

    class Config:
        from_attributes = True

class ShiftSwapRequestCreate(BaseModel):
    target_user_id: int
    applicant_date: str        # 申请人想换出的日期
    target_date: str           # 目标人的日期
    reason: str = ""

class ShiftSwapRequestOut(BaseModel):
    id: int
    applicant_id: int
    applicant_name: str = ""
    target_user_id: int
    target_user_name: str = ""
    applicant_date: str
    target_date: str
    reason: str
    status: str                # pending/approved/rejected/cancelled
    reviewer_id: Optional[int] = None
    reviewer_name: str = ""
    review_comment: str = ""
    reviewed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 仓储业务 ─────────────────────────────────────────────────────────
