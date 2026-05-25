from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DepartmentCreate(BaseModel):
    name: str
    description: str = ""
    sort_order: int = 0

class DepartmentOut(BaseModel):
    id: int
    name: str
    description: str
    sort_order: int
    member_count: int = 0

    class Config:
        from_attributes = True


# ── 用户（扩展，带部门信息） ─────────────────────────────────────────
