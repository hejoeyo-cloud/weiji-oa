from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class RoleCreate(BaseModel):
    name: str                           # 角色标识（如 warehouse）
    label: str                          # 显示名称（如 仓库管理）
    color: str = "#1677FF"              # 显示颜色
    permissions: List[str] = []         # 权限列表

class RoleUpdate(BaseModel):
    label: Optional[str] = None
    color: Optional[str] = None
    permissions: Optional[List[str]] = None

class RoleOut(BaseModel):
    id: int
    name: str
    label: str
    color: str
    permissions: List[str] = []
    is_builtin: bool = False
    sort_order: int = 0
    user_count: int = 0                 # 使用此角色的用户数

    class Config:
        from_attributes = True
