from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from config import TRIAL_DAYS, SUBSCRIPTION_GRACE_DAYS
from database import get_db, User, Role, Company, Subscription, ALL_PERMISSIONS
from schemas import LoginRequest, LoginResponse, UserInfo, RegisterRequest
from auth import (
    verify_password, create_access_token, get_current_user, require_admin,
    get_password_hash, get_subscription_state
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _build_user_info(u: User, db: Session | None = None) -> UserInfo:
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
    token = create_access_token({"user_id": user.id})
    return LoginResponse(token=token, user=_build_user_info(user, db))


@router.post("/register", response_model=LoginResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    company_name = req.company_name.strip()
    email = req.email.strip()
    name = req.name.strip()
    username = (req.username or req.email.split("@")[0]).strip()
    if not company_name or not email or not req.password or not name:
        raise HTTPException(status_code=400, detail="公司名称、邮箱、姓名和密码不能为空")
    if db.query(Company).filter(Company.name == company_name).first():
        raise HTTPException(status_code=400, detail="公司名称已存在")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="邮箱已注册")

    now = datetime.now()
    trial_end = now + timedelta(days=TRIAL_DAYS)
    company = Company(name=company_name, status="active")
    db.add(company)
    db.flush()

    admin_role = Role(
        company_id=company.id,
        name=f"admin_{company.id}",
        label="公司管理员",
        color="#722ED1",
        permissions=ALL_PERMISSIONS.copy(),
        is_builtin=True,
        sort_order=0,
    )
    customer_role = Role(
        company_id=company.id,
        name=f"customer_{company.id}",
        label="客服",
        color="#52C41A",
        permissions=[
            "tickets:view", "tickets:create",
            "knowledge:view",
            "return_exchange:view", "return_exchange:create",
            "repair:view", "repair:create",
            "gifts:view", "gifts:create",
            "gift_cashback:view", "gift_cashback:create",
            "gift_resend:view", "gift_resend:create",
            "warehouse_products:view",
            "warehouse_inbound:view", "warehouse_inbound:create",
            "warehouse_outbound:view", "warehouse_outbound:create",
            "announcements:view",
            "approvals:view", "approvals:create",
            "schedule:view",
        ],
        is_builtin=True,
        sort_order=1,
    )
    db.add_all([admin_role, customer_role])
    db.flush()

    user = User(
        company_id=company.id,
        email=email,
        username=username,
        password_hash=get_password_hash(req.password),
        name=name,
        role=admin_role.name,
        role_id=admin_role.id,
        is_manager=True,
    )
    subscription = Subscription(
        company_id=company.id,
        status="trial",
        trial_start_at=now,
        trial_end_at=trial_end,
        current_period_start=now,
        current_period_end=trial_end,
        grace_end_at=trial_end + timedelta(days=SUBSCRIPTION_GRACE_DAYS),
    )
    db.add_all([user, subscription])
    db.commit()
    db.refresh(user)
    token = create_access_token({"user_id": user.id})
    return LoginResponse(token=token, user=_build_user_info(user, db))


@router.get("/me", response_model=UserInfo)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _build_user_info(current_user, db)
