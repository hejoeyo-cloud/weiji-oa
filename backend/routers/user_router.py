from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, User, Role
from schemas import CreateUserRequest, UserInfo, UserInfoFull, UpdateUserRequest
from auth import require_admin, get_current_user, get_password_hash
from services import audit_service

router = APIRouter(prefix="/api/users", tags=["users"])


def user_to_full(u: User) -> UserInfoFull:
    role_label = ""
    role_color = "#1677FF"
    if u.role_obj:
        role_label = u.role_obj.label
        role_color = u.role_obj.color or "#1677FF"
    return UserInfoFull(
        id=u.id, company_id=u.company_id, company_name=u.company.name if u.company else "",
        is_platform_admin=u.is_platform_admin or False,
        username=u.username, name=u.name,
        note=u.note or "", role=u.role,
        role_label=role_label, role_color=role_color,
        role_id=u.role_id,
        department_id=u.department_id,
        department_name=u.department.name if u.department else None,
        is_manager=u.is_manager or False,
        created_at=u.created_at,
    )


@router.post("", response_model=UserInfoFull)
def create_user(
    req: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    # 查找角色
    role_id = None
    role_name = req.role or "customer"
    role_obj = db.query(Role).filter(Role.name == role_name, Role.company_id == current_user.company_id).first()
    if not role_obj:
        role_obj = db.query(Role).filter(Role.name == role_name, Role.company_id.is_(None)).first()
    if not role_obj and role_name == "customer":
        role_obj = db.query(Role).filter(Role.company_id == current_user.company_id, Role.label == "客服").first()
    if role_obj:
        role_name = role_obj.name
    if role_obj:
        role_id = role_obj.id
        # 用角色的 label 更新 role 字段（兼容）
        if not req.role:
            role_name = role_obj.name

    user = User(
        username=req.username,
        company_id=current_user.company_id,
        password_hash=get_password_hash(req.password),
        name=req.name,
        note=req.note,
        role=role_name,
        role_id=role_id,
        department_id=req.department_id or None,
        is_manager=req.is_manager,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    audit_service.log(db, current_user, "create", "user", user.id,
                      f"创建用户: {user.username} ({user.role})")
    return user_to_full(user)


@router.get("", response_model=list[UserInfoFull])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(User)
    if not current_user.is_platform_admin:
        q = q.filter(User.company_id == current_user.company_id)
    users = q.order_by(User.created_at.desc()).all()
    return [user_to_full(u) for u in users]


@router.put("/{user_id}", response_model=UserInfoFull)
def update_user(
    user_id: int,
    req: UpdateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(User).filter(User.id == user_id)
    if not current_user.is_platform_admin:
        q = q.filter(User.company_id == current_user.company_id)
    user = q.first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if req.username is not None:
        existing = db.query(User).filter(User.username == req.username, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="账号已被使用")
        user.username = req.username
    if req.name is not None:
        user.name = req.name
    if req.note is not None:
        user.note = req.note
    if req.role is not None:
        if user.username == "admin" and req.role != "admin":
            raise HTTPException(status_code=400, detail="Cannot change admin role")
        user.role = req.role
        # 同步 role_id
        role_obj = db.query(Role).filter(Role.name == req.role, Role.company_id == current_user.company_id).first()
        if not role_obj:
            role_obj = db.query(Role).filter(Role.name == req.role, Role.company_id.is_(None)).first()
        if role_obj:
            user.role_id = role_obj.id
        else:
            user.role_id = None
    if req.department_id is not None:
        user.department_id = req.department_id
    if req.is_manager is not None:
        user.is_manager = req.is_manager
    if req.password:
        user.password_hash = get_password_hash(req.password)
    db.commit()
    db.refresh(user)
    audit_service.log(db, current_user, "update", "user", user_id,
                      f"更新用户: {user.username}")
    return user_to_full(user)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    q = db.query(User).filter(User.id == user_id)
    if not current_user.is_platform_admin:
        q = q.filter(User.company_id == current_user.company_id)
    user = q.first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin")
    audit_service.log(db, current_user, "delete", "user", user_id,
                      f"删除用户: {user.username}")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}

