from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    company_name: str
    email: str
    username: str = ""
    password: str
    name: str

class LoginResponse(BaseModel):
    token: str
    user: "UserInfo"

class UserInfo(BaseModel):
    id: int
    company_id: Optional[int] = None
    company_name: str = ""
    is_platform_admin: bool = False
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
    subscription: Optional[SubscriptionInfo] = None

    class Config:
        from_attributes = True
