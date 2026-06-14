from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import UniqueConstraint
from typing import List
from database import get_db, FieldOption
from schemas.field_option import FieldOptionCreate, FieldOptionOut
from auth import get_current_user, require_permission
from services.audit_service import log as log_action

router = APIRouter(prefix="/api/field-options", tags=["field-options"])


@router.get("/{field_name}", response_model=List[FieldOptionOut])
def get_options(
    field_name: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """获取指定字段的预设选项"""
    query = db.query(FieldOption).filter(FieldOption.field_name == field_name)
    if current_user.role != "admin":
        query = query.filter(FieldOption.company_id == current_user.company_id)
    return query.order_by(FieldOption.value).all()


@router.post("/", response_model=FieldOptionOut)
def create_option(
    data: FieldOptionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("field_options:manage"))
):
    """新增预设选项"""
    # 检查重复
    existing = db.query(FieldOption).filter(
        FieldOption.field_name == data.field_name,
        FieldOption.value == data.value,
        FieldOption.company_id == current_user.company_id
    ).first()
    if existing:
        raise HTTPException(400, "该选项已存在")

    option = FieldOption(
        company_id=current_user.company_id,
        field_name=data.field_name,
        value=data.value,
        price=data.price
    )
    db.add(option)
    db.commit()
    db.refresh(option)

    log_action(db, current_user, "创建字段选项", f"{data.field_name}: {data.value}")
    return option


@router.delete("/{option_id}")
def delete_option(
    option_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("field_options:manage"))
):
    """删除预设选项"""
    option = db.query(FieldOption).filter(FieldOption.id == option_id).first()
    if not option:
        raise HTTPException(404, "选项不存在")
    if current_user.role != "admin" and option.company_id != current_user.company_id:
        raise HTTPException(403, "无权删除")

    db.delete(option)
    db.commit()
    return {"ok": True}
