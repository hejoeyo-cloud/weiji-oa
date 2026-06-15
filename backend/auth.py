from datetime import datetime, timedelta
from typing import Optional, List

import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from database import get_db, User, Subscription

security = HTTPBearer()


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now() + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_current_user_flexible(
    request: Request,
    token_query: Optional[str] = Query(None, alias="token"),
    db: Session = Depends(get_db),
) -> User:
    """支持 Authorization header 和 ?token= query 参数两种认证方式。
    用于 iframe/img/a 等浏览器元素无法携带 header 的场景。"""
    token = token_query
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def is_platform_admin(user: User) -> bool:
    return bool(getattr(user, "is_platform_admin", False))


def get_subscription_state(db: Session, user: User) -> dict:
    """本地版：永久有效，无订阅限制"""
    return {
        "status": "active",
        "trial_end_at": None,
        "current_period_end": None,
        "grace_end_at": None,
        "is_writable": True,
        "days_remaining": 9999,
    }


def require_platform_admin(user: User = Depends(get_current_user)) -> User:
    if not is_platform_admin(user):
        raise HTTPException(status_code=403, detail="Platform admin access required")
    return user


def _get_user_permissions(user: User) -> List[str]:
    """获取用户的权限列表。admin 拥有全部权限，其他用户从角色获取。"""
    if user.role == "admin":
        from database import ALL_PERMISSIONS
        return ALL_PERMISSIONS
    if user.role_obj and user.role_obj.permissions:
        return user.role_obj.permissions
    return []


def require_admin(user: User = Depends(get_current_user)) -> User:
    """只有 admin 才能访问（用户管理、操作日志等超级权限接口）"""
    perms = user.role_obj.permissions if user.role_obj and user.role_obj.permissions else []
    if user.role != "admin" and not is_platform_admin(user) and "users:edit" not in perms:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_admin_or_tech(user: User = Depends(get_current_user)) -> User:
    """admin 或 technician 均可访问（工单处理、知识库编辑等运营接口）"""
    if user.role not in ("admin", "technician"):
        raise HTTPException(status_code=403, detail="Admin or technician access required")
    return user


def require_permission(*permissions: str):
    """
    细粒度权限检查中间件。
    用法: @router.get("", dependencies=[Depends(require_permission("tickets:view"))])
    或作为参数: user: User = Depends(require_permission("tickets:edit"))
    用户需要拥有 permissions 中的任一权限即可通过。
    """
    def checker(user: User = Depends(get_current_user)) -> User:
        user_perms = _get_user_permissions(user)
        for p in permissions:
            if p in user_perms:
                return user
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied. Required: {', '.join(permissions)}",
        )
    return checker


def owner_filter(user: User) -> bool:
    """行级权限：管理员看全部，普通用户只看自己创建的"""
    if user.is_platform_admin:
        return True
    # Check by role name
    for perm in _get_user_permissions(user):
        if perm.startswith("admin:") or perm == "*":
            return True
    # Check role name starts with admin
    if hasattr(user, 'roles') and user.roles:
        for role in user.roles:
            if role.name and role.name.startswith("admin"):
                return True
    return False


def apply_owner_filter(query, model, user: User):
    """对查询应用行级权限过滤 — 所有用户都可以看到公司内的所有数据"""
    # 不再限制用户只能看到自己创建的数据
    return query
