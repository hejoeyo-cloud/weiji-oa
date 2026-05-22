from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, User, DingtalkConfig
from schemas import DingtalkConfigIn, DingtalkConfigOut
from auth import get_current_user, require_admin
from services.dingtalk_sync import sync_attendance_for_company

router = APIRouter(prefix="/api/dingtalk", tags=["dingtalk"])


@router.get("/config", response_model=DingtalkConfigOut | None)
def get_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = db.query(DingtalkConfig).filter(
        DingtalkConfig.company_id == current_user.company_id,
    ).first()
    if not config:
        return None
    return DingtalkConfigOut(
        id=config.id,
        company_id=config.company_id,
        app_key=config.app_key,
        app_secret_masked=config.app_secret[:4] + "****" + config.app_secret[-4:] if len(config.app_secret) > 8 else "未设置",
        enabled=config.enabled,
        last_sync_at=config.last_sync_at,
    )


@router.put("/config", response_model=DingtalkConfigOut)
def save_config(
    req: DingtalkConfigIn,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    config = db.query(DingtalkConfig).filter(
        DingtalkConfig.company_id == current_user.company_id,
    ).first()
    if not config:
        config = DingtalkConfig(company_id=current_user.company_id)
        db.add(config)

    if req.app_key is not None:
        config.app_key = req.app_key
    if req.app_secret is not None:
        config.app_secret = req.app_secret
    if req.enabled is not None:
        config.enabled = req.enabled

    config.updated_at = datetime.now()
    db.commit()
    db.refresh(config)

    return DingtalkConfigOut(
        id=config.id,
        company_id=config.company_id,
        app_key=config.app_key,
        app_secret_masked=config.app_secret[:4] + "****" + config.app_secret[-4:] if len(config.app_secret) > 8 else "未设置",
        enabled=config.enabled,
        last_sync_at=config.last_sync_at,
    )


@router.post("/sync", response_model=dict)
def trigger_sync(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    result = sync_attendance_for_company(db, current_user.company_id)
    return result


@router.put("/bind", response_model=dict)
def bind_dingtalk_user(
    dingtalk_user_id: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not dingtalk_user_id.strip():
        raise HTTPException(status_code=400, detail="钉钉用户ID不能为空")

    # 检查是否已被同公司其他人绑定
    existing = db.query(User).filter(
        User.dingtalk_user_id == dingtalk_user_id.strip(),
        User.company_id == current_user.company_id,
        User.id != current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该钉钉账号已被公司内其他员工绑定")

    current_user.dingtalk_user_id = dingtalk_user_id.strip()
    db.commit()
    return {"ok": True, "dingtalk_user_id": current_user.dingtalk_user_id}
