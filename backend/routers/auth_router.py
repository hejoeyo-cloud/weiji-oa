from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, User, ALL_PERMISSIONS
from schemas import LoginRequest, LoginResponse, UserInfo
from auth import (
    verify_password, create_access_token, get_current_user,
    get_subscription_state
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _build_user_info(u: User, db: Optional[Session] = None) -> UserInfo:
    """构建用户信息，包含角色标签和权限列表"""
    permissions = []
    if u.role == "admin":
        permissions = ALL_PERMISSIONS.copy()
    elif u.role_obj and u.role_obj.permissions:
        permissions = u.role_obj.permissions

    role_label = ""
    role_color = "#1677FF"
    if u.role_obj:
        role_label = u.role_obj.label
        role_color = u.role_obj.color or "#1677FF"

    return UserInfo(
        id=u.id,
        company_id=u.company_id,
        company_name=u.company.name if u.company else "",
        is_platform_admin=u.is_platform_admin or False,
        email=u.email or "",
        username=u.username,
        name=u.name,
        note=u.note or "",
        role=u.role,
        role_label=role_label,
        role_color=role_color,
        permissions=permissions,
        department_id=u.department_id,
        is_manager=u.is_manager or False,
        created_at=u.created_at,
        subscription=get_subscription_state(db, u) if db else None,
    )


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    if user.company and user.company.status == "disabled" and not user.is_platform_admin:
        raise HTTPException(status_code=403, detail="公司账号已停用")
    expire = timedelta(days=30) if req.remember_me else None
    token = create_access_token({"user_id": user.id}, expires_delta=expire)
    return LoginResponse(token=token, user=_build_user_info(user, db))


@router.get("/me", response_model=UserInfo)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _build_user_info(current_user, db)
