from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = False

class LoginResponse(BaseModel):
    token: str
    user: "UserInfo"

class UserInfo(BaseModel):
    id: int
    email: str = ""
    username: str
    name: str
    note: str
    role: str
    role_label: str = ""           # 角色显示名称
    role_color: str = "#1677FF"    # 角色颜色
    permissions: List[str] = []    # 权限列表
    department_id: Optional[int] = None
    is_manager: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 用户管理 ─────────────────────────────────────────────────────

class CreateUserRequest(BaseModel):
    email: str = ""
    username: str = ""
    password: str
    name: str
    note: str = ""
    role: str = "customer"
    department_id: Optional[int] = None
    is_manager: bool = False

class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    name: Optional[str] = None
    note: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[int] = None
    is_manager: Optional[bool] = None
    password: Optional[str] = None

class UserInfoFull(BaseModel):
    id: int
    email: str = ""
    username: str
    name: str
    note: str
    role: str
    role_label: str = ""
    role_color: str = "#1677FF"
    role_id: Optional[int] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    is_manager: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
