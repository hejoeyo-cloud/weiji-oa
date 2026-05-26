from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AttendanceRecordOut(BaseModel):
    id: int
    company_id: Optional[int] = None
    user_id: int
    user_name: str = ""
    date: str
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: str = "normal"
    source: str = "manual"
    location: str = ""
    remark: str = ""
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 打卡请求 ─────────────────────────────────────────────────────────

class CheckInRequest(BaseModel):
    location: str = ""
    remark: str = ""

class MonthlyAttendanceStats(BaseModel):
    total_days: int = 0
    normal_days: int = 0
    late_days: int = 0
    early_days: int = 0
    absent_days: int = 0
