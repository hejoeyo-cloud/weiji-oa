from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db, User, ModuleConfig, FieldLabel
from auth import get_current_user, require_admin
import json

router = APIRouter(prefix="/api/module-config", tags=["module_config"])

# ── Schema ──
class ModuleConfigOut(BaseModel):
    id: int
    module_key: str
    enabled: bool = True
    display_name: str = ""
    sort_order: int = 0
    # ── v2.0 新增字段 ──
    icon: str = ""
    route_path: str = ""
    navigation_group: str = ""
    permissions: str = "[]"           # JSON 字符串，需要前端 parse
    fields_schema: str = "[]"        # JSON 字符串，需要前端 parse
    # ────────────────
    class Config: from_attributes = True

class ModuleConfigUpdate(BaseModel):
    module_key: str
    enabled: Optional[bool] = None
    display_name: Optional[str] = None
    sort_order: Optional[int] = None
    icon: Optional[str] = None
    route_path: Optional[str] = None
    navigation_group: Optional[str] = None
    permissions: Optional[str] = None
    fields_schema: Optional[str] = None

class FieldLabelOut(BaseModel):
    id: int
    module_key: str
    field_name: str
    label: str = ""
    class Config: from_attributes = True

class FieldLabelIn(BaseModel):
    module_key: str
    field_name: str
    label: str

# ── 注册表 ──
@router.get("/registry", response_model=dict)
def get_module_registry():
    """获取模块注册表完整数据"""
    from models.module_registry import MODULE_REGISTRY as reg
    modules = {}
    for key, mod in reg.items():
        modules[key] = {
            "module_key": mod.module_key,
            "display_name": mod.display_name,
            "icon": mod.icon,
            "route_path": mod.route_path,
            "navigation_group": mod.navigation_group,
            "permissions": mod.permissions,
            "sort_order": mod.sort_order,
            "enabled_by_default": mod.enabled_by_default,
            "fields": [
                {
                    "name": f.name,
                    "label": f.label,
                    "type": f.type,
                    "options": f.options,
                    "required": f.required,
                    "sort_order": f.sort_order,
                }
                for f in mod.fields
            ],
        }
    return {"modules": modules}

# ── 模块配置 ──
@router.get("", response_model=list[ModuleConfigOut])
def list_modules(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    configs = db.query(ModuleConfig).filter(
        ModuleConfig.company_id == current_user.company_id
    ).order_by(ModuleConfig.sort_order).all()
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
        if req.sort_order is not None:
            config.sort_order = req.sort_order
        if req.icon is not None:
            config.icon = req.icon
        if req.route_path is not None:
            config.route_path = req.route_path
        if req.navigation_group is not None:
            config.navigation_group = req.navigation_group
        if req.permissions is not None:
            config.permissions = req.permissions
        if req.fields_schema is not None:
            config.fields_schema = req.fields_schema
    db.commit()
    return {"ok": True}

# ── 字段配置 ──
@router.get("/fields", response_model=list[FieldLabelOut])
def list_fields(module_key: str = "", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(FieldLabel).filter(FieldLabel.company_id == current_user.company_id)
    if module_key:
        q = q.filter(FieldLabel.module_key == module_key)
    return q.all()

@router.post("/fields", response_model=FieldLabelOut)
def create_field(req: FieldLabelIn, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    existing = db.query(FieldLabel).filter(
        FieldLabel.company_id == current_user.company_id,
        FieldLabel.module_key == req.module_key,
        FieldLabel.field_name == req.field_name,
    ).first()
    if existing:
        existing.label = req.label
        db.commit()
        db.refresh(existing)
        return existing

    field = FieldLabel(
        company_id=current_user.company_id,
        module_key=req.module_key,
        field_name=req.field_name,
        label=req.label,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field

@router.put("/fields/{field_id}", response_model=FieldLabelOut)
def update_field(field_id: int, req: FieldLabelIn, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    """修复：使用 FieldLabelIn 的实际字段：module_key, field_name, label"""
    field = db.query(FieldLabel).filter(
        FieldLabel.id == field_id,
        FieldLabel.company_id == current_user.company_id,
    ).first()
    if not field:
        raise HTTPException(status_code=404, detail="字段不存在")
    field.module_key = req.module_key
    field.field_name = req.field_name
    field.label = req.label
    db.commit()
    db.refresh(field)
    return field

@router.delete("/fields/{field_id}")
def delete_field(field_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    field = db.query(FieldLabel).filter(
        FieldLabel.id == field_id,
        FieldLabel.company_id == current_user.company_id,
    ).first()
    if not field:
        raise HTTPException(status_code=404, detail="字段不存在")
    db.delete(field)
    db.commit()
    return {"ok": True}
