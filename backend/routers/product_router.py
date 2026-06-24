from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from database import get_db, Product, User
from auth import get_current_user, require_permission
from schemas.product import ProductCreate, ProductUpdate, ProductOut
from services import audit_service

router = APIRouter(prefix="/api/products", tags=["products"])


def _to_out(p: Product) -> dict:
    return {
        "id": p.id,
        "company_id": p.company_id,
        "name": p.name,
        "model_number": p.model_number or "",
        "images": p.images or [],
        "cpu": p.cpu or "",
        "ram": p.ram or "",
        "ram_freq": p.ram_freq or "",
        "storage": p.storage or "",
        "display": p.display or "",
        "gpu": p.gpu or "",
        "ports": p.ports or [],
        "battery": p.battery or "",
        "weight": p.weight or "",
        "description": p.description or "",
        "status": p.status or "在售",
        "created_by": p.created_by,
        "creator_name": p.author.name if p.author else "",
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


@router.get("")
def list_products(
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    status: str = "",
    all: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products:view")),
):
    query = db.query(Product).filter(Product.company_id == current_user.company_id)

    if search:
        query = query.filter(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.model_number.ilike(f"%{search}%"),
            )
        )
    if status:
        query = query.filter(Product.status == status)

    total = query.count()

    if all:
        items = query.order_by(Product.created_at.desc()).all()
    else:
        items = (
            query.order_by(Product.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

    return {
        "total": total,
        "items": [_to_out(p) for p in items],
        "page": page,
        "page_size": page_size,
    }


@router.get("/{product_id}")
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products:view")),
):
    p = (
        db.query(Product)
        .filter(Product.id == product_id, Product.company_id == current_user.company_id)
        .first()
    )
    if not p:
        raise HTTPException(404, "产品不存在")
    return _to_out(p)


@router.post("")
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products:create")),
):
    p = Product(
        company_id=current_user.company_id,
        created_by=current_user.id,
        **data.model_dump(),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    audit_service.log(db, current_user, "create", "product", p.id, f"新增产品: {p.name}")
    return _to_out(p)


@router.put("/{product_id}")
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products:edit")),
):
    p = (
        db.query(Product)
        .filter(Product.id == product_id, Product.company_id == current_user.company_id)
        .first()
    )
    if not p:
        raise HTTPException(404, "产品不存在")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    audit_service.log(db, current_user, "update", "product", p.id, f"更新产品: {p.name}")
    return _to_out(p)


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products:delete")),
):
    p = (
        db.query(Product)
        .filter(Product.id == product_id, Product.company_id == current_user.company_id)
        .first()
    )
    if not p:
        raise HTTPException(404, "产品不存在")
    name = p.name
    db.delete(p)
    db.commit()
    audit_service.log(db, current_user, "delete", "product", product_id, f"删除产品: {name}")
    return {"ok": True}
