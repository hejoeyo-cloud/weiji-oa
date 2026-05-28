from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, Shop, User
from schemas import ShopCreate, ShopUpdate, ShopOut
from auth import get_current_user
from services import audit_service

router = APIRouter(prefix="/api/shops", tags=["shops"])


@router.get("", response_model=list[ShopOut])
def list_shops(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shops = db.query(Shop).filter(
        Shop.company_id == current_user.company_id
    ).order_by(Shop.id).all()
    return [ShopOut.model_validate(s) for s in shops]


@router.post("", response_model=ShopOut)
def create_shop(
    req: ShopCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = Shop(company_id=current_user.company_id, name=req.name)
    db.add(shop)
    db.commit()
    db.refresh(shop)
    audit_service.log(db, current_user, "create", "shop", shop.id,
                      f"创建店铺: {shop.name}")
    return ShopOut.model_validate(shop)


@router.put("/{shop_id}", response_model=ShopOut)
def update_shop(
    shop_id: int,
    req: ShopUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = db.query(Shop).filter(
        Shop.id == shop_id, Shop.company_id == current_user.company_id
    ).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if req.name is not None:
        shop.name = req.name
    db.commit()
    db.refresh(shop)
    audit_service.log(db, current_user, "update", "shop", shop.id,
                      f"更新店铺: {shop.name}")
    return ShopOut.model_validate(shop)


@router.delete("/{shop_id}")
def delete_shop(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = db.query(Shop).filter(
        Shop.id == shop_id, Shop.company_id == current_user.company_id
    ).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    audit_service.log(db, current_user, "delete", "shop", shop.id,
                      f"删除店铺: {shop.name}")
    db.delete(shop)
    db.commit()
    return {"message": "OK"}
