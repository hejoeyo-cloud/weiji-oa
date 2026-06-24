from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from database import get_db, Product, User, ReturnExchangeRecord, RepairRecord
from auth import get_current_user, require_permission
from schemas.product import ProductCreate, ProductUpdate, ProductOut, ProductAftersalesSummary
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
    # 记录变更前的值
    changes = {}
    update_data = data.model_dump(exclude_none=True)
    for k, v in update_data.items():
        old_val = getattr(p, k, None)
        if old_val != v:
            changes[k] = {"old": str(old_val) if old_val is not None else "", "new": str(v) if v is not None else ""}
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    audit_service.log(db, current_user, "update", "product", p.id, f"更新产品: {p.name}", changes=changes or None)
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


@router.get("/{product_id}/aftersales")
def get_product_aftersales(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products:view")),
):
    p = db.query(Product).filter(
        Product.id == product_id, Product.company_id == current_user.company_id
    ).first()
    if not p:
        raise HTTPException(404, "产品不存在")

    # Match by product name or model_number
    match_values = [v for v in [p.name, p.model_number] if v]

    repairs = []
    if match_values:
        repair_query = db.query(RepairRecord).filter(
            RepairRecord.company_id == current_user.company_id,
            or_(*[RepairRecord.model.ilike(f"%{v}%") for v in match_values]),
        ).order_by(RepairRecord.created_at.desc()).limit(20).all()
        for r in repair_query:
            repairs.append({
                "id": r.id, "type": "repair",
                "apply_date": r.apply_date, "shop_name": r.shop_name,
                "model": r.model, "config": r.config,
                "return_reason": r.return_reason, "status": r.repair_status,
                "handle_result": r.handle_result,
                "created_at": r.created_at,
            })

    returns = []
    if match_values:
        return_query = db.query(ReturnExchangeRecord).filter(
            ReturnExchangeRecord.company_id == current_user.company_id,
            or_(*[ReturnExchangeRecord.model.ilike(f"%{v}%") for v in match_values]),
        ).order_by(ReturnExchangeRecord.created_at.desc()).limit(20).all()
        for r in return_query:
            returns.append({
                "id": r.id, "type": "return_exchange",
                "apply_date": r.apply_date, "shop_name": r.shop_name,
                "model": r.model, "config": r.config,
                "return_reason": r.return_reason, "status": r.progress,
                "record_type": r.record_type, "handle_result": r.handle_result,
                "created_at": r.created_at,
            })

    return {"repairs": repairs, "returns": returns}


@router.get("/{product_id}/stats", response_model=ProductAftersalesSummary)
def get_product_stats(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products:view")),
):
    p = db.query(Product).filter(
        Product.id == product_id, Product.company_id == current_user.company_id
    ).first()
    if not p:
        raise HTTPException(404, "产品不存在")

    match_values = [v for v in [p.name, p.model_number] if v]
    if not match_values:
        return ProductAftersalesSummary()

    cid = current_user.company_id
    repair_count = db.query(func.count(RepairRecord.id)).filter(
        RepairRecord.company_id == cid,
        or_(*[RepairRecord.model.ilike(f"%{v}%") for v in match_values]),
    ).scalar() or 0

    return_count = db.query(func.count(ReturnExchangeRecord.id)).filter(
        ReturnExchangeRecord.company_id == cid,
        ReturnExchangeRecord.record_type == "return",
        or_(*[ReturnExchangeRecord.model.ilike(f"%{v}%") for v in match_values]),
    ).scalar() or 0

    exchange_count = db.query(func.count(ReturnExchangeRecord.id)).filter(
        ReturnExchangeRecord.company_id == cid,
        ReturnExchangeRecord.record_type == "exchange",
        or_(*[ReturnExchangeRecord.model.ilike(f"%{v}%") for v in match_values]),
    ).scalar() or 0

    # Recent 10 records combined
    recent = []
    rep = db.query(RepairRecord).filter(
        RepairRecord.company_id == cid,
        or_(*[RepairRecord.model.ilike(f"%{v}%") for v in match_values]),
    ).order_by(RepairRecord.created_at.desc()).limit(5).all()
    for r in rep:
        recent.append({"id": r.id, "type": "维修", "date": r.apply_date, "model": r.model, "status": r.repair_status, "reason": r.return_reason, "created_at": r.created_at})

    ret = db.query(ReturnExchangeRecord).filter(
        ReturnExchangeRecord.company_id == cid,
        or_(*[ReturnExchangeRecord.model.ilike(f"%{v}%") for v in match_values]),
    ).order_by(ReturnExchangeRecord.created_at.desc()).limit(5).all()
    for r in ret:
        recent.append({"id": r.id, "type": "退货" if r.record_type == "return" else "换货", "date": r.apply_date, "model": r.model, "status": r.progress, "reason": r.return_reason, "created_at": r.created_at})

    recent.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    recent = recent[:10]

    return ProductAftersalesSummary(
        repair_count=repair_count,
        return_count=return_count,
        exchange_count=exchange_count,
        recent_records=recent,
    )
