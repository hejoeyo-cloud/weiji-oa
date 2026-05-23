from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db, User, ModuleConfig, ModuleFieldConfig
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api/module-config", tags=["module_config"])

# ── Schema ──
class ModuleConfigOut(BaseModel):
    id: int
    module_key: str
    enabled: bool = True
    display_name: str = ""
    sort_order: int = 0
    class Config: from_attributes = True

class ModuleConfigUpdate(BaseModel):
    module_key: str
    enabled: Optional[bool] = None
    display_name: Optional[str] = None

class FieldConfigOut(BaseModel):
    id: int
    module_key: str
    field_key: str
    field_label: str = ""
    field_type: str = "text"
    field_options: str = "[]"
    required: bool = False
    sort_order: int = 0
    enabled: bool = True
    class Config: from_attributes = True

class FieldConfigIn(BaseModel):
    module_key: str
    field_key: str = ""
    field_label: str = ""
    field_type: str = "text"
    field_options: str = "[]"
    required: bool = False

# ── 模块配置 ──
@router.get("", response_model=list[ModuleConfigOut])
def list_modules(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    configs = db.query(ModuleConfig).filter(ModuleConfig.company_id == current_user.company_id).order_by(ModuleConfig.sort_order).all()
    return configs

@router.put("", response_model=dict)
def update_modules(reqs: list[ModuleConfigUpdate], current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    for req in reqs:
        config = db.query(ModuleConfig).filter(
            ModuleConfig.company_id == current_user.company_id,
            ModuleConfig.module_key == req.module_key,
        ).first()
        if not config:
            config = ModuleConfig(company_id=current_user.company_id, module_key=req.module_key)
            db.add(config)
        if req.enabled is not None:
            config.enabled = req.enabled
        if req.display_name is not None:
            config.display_name = req.display_name
    db.commit()
    return {"ok": True}

# ── 字段配置 ──
@router.get("/fields", response_model=list[FieldConfigOut])
def list_fields(module_key: str = "", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(ModuleFieldConfig).filter(ModuleFieldConfig.company_id == current_user.company_id)
    if module_key:
        q = q.filter(ModuleFieldConfig.module_key == module_key)
    return q.order_by(ModuleFieldConfig.sort_order).all()

@router.post("/fields", response_model=FieldConfigOut)
def create_field(req: FieldConfigIn, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    key = req.field_key or f"custom_{req.field_label.lower().replace(' ', '_')}"
    max_order = db.query(ModuleFieldConfig.sort_order).filter(
        ModuleFieldConfig.company_id == current_user.company_id,
        ModuleFieldConfig.module_key == req.module_key,
    ).order_by(ModuleFieldConfig.sort_order.desc()).first()
    order = (max_order[0] + 1) if max_order and max_order[0] is not None else 1

    field = ModuleFieldConfig(
        company_id=current_user.company_id,
        module_key=req.module_key,
        field_key=key,
        field_label=req.field_label,
        field_type=req.field_type,
        field_options=req.field_options,
        required=req.required,
        sort_order=order,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field

@router.put("/fields/{field_id}", response_model=FieldConfigOut)
def update_field(field_id: int, req: FieldConfigIn, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    field = db.query(ModuleFieldConfig).filter(
        ModuleFieldConfig.id == field_id,
        ModuleFieldConfig.company_id == current_user.company_id,
    ).first()
    if not field:
        raise HTTPException(status_code=404, detail="字段不存在")
    if req.field_label:
        field.field_label = req.field_label
    field.field_type = req.field_type
    field.field_options = req.field_options
    field.required = req.required
    db.commit()
    db.refresh(field)
    return field

@router.delete("/fields/{field_id}")
def delete_field(field_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    field = db.query(ModuleFieldConfig).filter(
        ModuleFieldConfig.id == field_id,
        ModuleFieldConfig.company_id == current_user.company_id,
    ).first()
    if not field:
        raise HTTPException(status_code=404, detail="字段不存在")
    db.delete(field)
    db.commit()
    return {"ok": True}
