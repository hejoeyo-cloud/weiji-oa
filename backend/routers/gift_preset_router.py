from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db, GiftPreset
from schemas.gift import GiftPresetCreate, GiftPresetOut
from auth import get_current_user, require_permission

router = APIRouter(prefix="/api/gift-presets", tags=["gift-presets"])


@router.get("", response_model=List[GiftPresetOut])
def list_presets(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(GiftPreset)
    if current_user.role != "admin":
        query = query.filter(GiftPreset.company_id == current_user.company_id)
    presets = query.order_by(GiftPreset.name).all()
    return [
        GiftPresetOut(
            id=p.id,
            name=p.name,
            items=[{"name": i.get("name", ""), "amount": i.get("amount", 0)} for i in (p.items or []) if isinstance(i, dict)],
            created_by=p.created_by,
            creator_name=p.creator.name if p.creator else "",
            created_at=p.created_at,
        )
        for p in presets
    ]


@router.post("", response_model=GiftPresetOut)
def create_preset(
    data: GiftPresetCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("gifts:create")),
):
    preset = GiftPreset(
        company_id=current_user.company_id,
        name=data.name,
        items=[item.model_dump() for item in data.items] if data.items else [],
        created_by=current_user.id,
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return GiftPresetOut(
        id=preset.id,
        name=preset.name,
        items=[{"name": i.get("name", ""), "amount": i.get("amount", 0)} for i in (preset.items or []) if isinstance(i, dict)],
        created_by=preset.created_by,
        creator_name=current_user.name,
        created_at=preset.created_at,
    )


@router.delete("/{preset_id}")
def delete_preset(
    preset_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("gifts:delete")),
):
    preset = db.query(GiftPreset).filter(GiftPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(404, "预设不存在")
    if current_user.role != "admin" and preset.company_id != current_user.company_id:
        raise HTTPException(403, "无权删除")
    db.delete(preset)
    db.commit()
    return {"ok": True}
