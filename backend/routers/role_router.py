from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, Role, User, ALL_PERMISSIONS, PERMISSION_GROUPS
from schemas import RoleCreate, RoleUpdate, RoleOut
from auth import require_admin
from services import audit_service

router = APIRouter(prefix="/api/roles", tags=["roles"])


def _role_to_out(r: Role, db: Session) -> RoleOut:
    user_count = db.query(func.count(User.id)).filter(User.role_id == r.id).scalar() or 0
    return RoleOut(
        id=r.id, name=r.name, label=r.label, color=r.color,
        permissions=r.permissions or [], bound_shops=r.bound_shops or [],
        is_builtin=r.is_builtin or False, sort_order=r.sort_order or 0, user_count=user_count,
    )


@router.get("", response_model=list[RoleOut])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    roles = db.query(Role).order_by(Role.sort_order, Role.id).all()
    return [_role_to_out(r, db) for r in roles]


@router.get("/permissions", response_model=dict)
def get_all_permissions(
    current_user: User = Depends(require_admin),
):
    """返回所有可用权限及分组定义"""
    return {"permissions": ALL_PERMISSIONS, "groups": PERMISSION_GROUPS}


@router.post("", response_model=RoleOut)
def create_role(
    req: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not req.name or not req.label:
        raise HTTPException(status_code=400, detail="角色标识和名称不能为空")
    role_name = req.name
    existing = db.query(Role).filter(Role.name == role_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="角色标识已存在")
    # 验证权限合法性
    invalid_perms = set(req.permissions) - set(ALL_PERMISSIONS)
    if invalid_perms:
        raise HTTPException(status_code=400, detail=f"无效权限: {', '.join(invalid_perms)}")
    role = Role(company_id=current_user.company_id, name=role_name, label=req.label, color=req.color, permissions=req.permissions, bound_shops=req.bound_shops)
    db.add(role)
    db.commit()
    db.refresh(role)
    audit_service.log(db, current_user, "create", "role", role.id,
                      f"创建角色: {role.label} ({role.name})")
    return _role_to_out(role, db)


@router.put("/{role_id}", response_model=RoleOut)
def update_role(
    role_id: int,
    req: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    # 内置角色不可修改 name 标识（RoleUpdate 不包含 name 字段）
    if req.label is not None:
        role.label = req.label
    if req.color is not None:
        role.color = req.color
    if req.permissions is not None:
        invalid_perms = set(req.permissions) - set(ALL_PERMISSIONS)
        if invalid_perms:
            raise HTTPException(status_code=400, detail=f"无效权限: {', '.join(invalid_perms)}")
        role.permissions = req.permissions
    if req.bound_shops is not None:
        role.bound_shops = req.bound_shops
    db.commit()
    db.refresh(role)
    audit_service.log(db, current_user, "update", "role", role_id,
                      f"更新角色: {role.label}")
    return _role_to_out(role, db)


@router.delete("/{role_id}")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    if role.is_builtin:
        raise HTTPException(status_code=400, detail="内置角色不可删除")
    user_count = db.query(func.count(User.id)).filter(User.role_id == role_id).scalar() or 0
    if user_count > 0:
        raise HTTPException(status_code=400, detail=f"该角色下还有 {user_count} 个用户，请先转移")
    audit_service.log(db, current_user, "delete", "role", role_id,
                      f"删除角色: {role.label} ({role.name})")
    db.delete(role)
    db.commit()
    return {"message": "Role deleted"}
