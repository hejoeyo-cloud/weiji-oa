from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AnnouncementCreate(BaseModel):
    title: str
    content: str = ""
    is_pinned: bool = False
    target_departments: List[int] = []  # 目标部门ID列表，空列表表示全员

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_active: Optional[bool] = None
    target_departments: Optional[List[int]] = None

class AnnouncementOut(BaseModel):
    id: int
    title: str
    content: str
    is_pinned: bool
    is_active: bool
    target_departments: List[int] = []
    target_department_names: str = ""   # 逗号分隔的部门名称
    created_by: Optional[int]
    author_name: str = ""
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    is_read: bool = False          # 当前用户是否已读

    class Config:
        from_attributes = True


# ── 审批流程 ─────────────────────────────────────────────────────────
