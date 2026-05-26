from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, WarehouseProduct, WarehouseInbound, WarehouseOutbound, User
from database import WarehouseInboundFeedback, WarehouseOutboundFeedback
from schemas import (
    WarehouseProductCreate, WarehouseProductUpdate, WarehouseProductOut,
    WarehouseInboundCreate, WarehouseInboundUpdate, WarehouseInboundOut,
    WarehouseOutboundCreate, WarehouseOutboundUpdate, WarehouseOutboundOut,
    WarehouseInboundFeedbackCreate, WarehouseInboundFeedbackOut,
    WarehouseOutboundFeedbackCreate, WarehouseOutboundFeedbackOut,
)
from auth import get_current_user, require_permission
from services import audit_service

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


def _calc_stock(db: Session, product_id: int, initial_qty: int, company_id: int) -> int:
    inbound = db.query(func.sum(WarehouseInbound.quantity)).filter(
        WarehouseInbound.product_id == product_id,
        WarehouseInbound.company_id == company_id,
    ).scalar() or 0
    outbound = db.query(func.sum(WarehouseOutbound.quantity)).filter(
        WarehouseOutbound.product_id == product_id,
        WarehouseOutbound.company_id == company_id,
    ).scalar() or 0
    return initial_qty + inbound - outbound


def product_to_out(p: WarehouseProduct, db: Session) -> WarehouseProductOut:
    inbound_qty = db.query(func.sum(WarehouseInbound.quantity)).filter(
        WarehouseInbound.product_id == p.id
        , WarehouseInbound.company_id == p.company_id
    ).scalar() or 0
    outbound_qty = db.query(func.sum(WarehouseOutbound.quantity)).filter(
        WarehouseOutbound.product_id == p.id
        , WarehouseOutbound.company_id == p.company_id
    ).scalar() or 0
    current_qty = (p.initial_qty or 0) + inbound_qty - outbound_qty
    return WarehouseProductOut(
        id=p.id,
        code=p.code or "",
        category=p.category or "",
        name=p.name or "",
        spec=p.spec or "",
        location=p.location or "",
        initial_qty=p.initial_qty or 0,
        unit=p.unit or "个",
        remark=p.remark or "",
        inbound_qty=inbound_qty,
        outbound_qty=outbound_qty,
        current_qty=current_qty,
        created_by=p.created_by,
        creator_name=p.creator.name if p.creator else "",
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def inbound_to_out(r: WarehouseInbound) -> WarehouseInboundOut:
    return WarehouseInboundOut(
        id=r.id,
        date=r.date or "",
        product_id=r.product_id,
        product_code=r.product_code or "",
        category=r.category or "",
        product_name=r.product_name or "",
        spec=r.spec or "",
        location=r.location or "",
        quantity=r.quantity or 0,
        operator=r.operator or "",
        remark=r.remark or "",
        created_by=r.created_by,
        creator_name=r.creator.name if r.creator else "",
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


def outbound_to_out(r: WarehouseOutbound) -> WarehouseOutboundOut:
    return WarehouseOutboundOut(
        id=r.id,
        date=r.date or "",
        product_id=r.product_id,
        product_code=r.product_code or "",
        category=r.category or "",
        product_name=r.product_name or "",
        spec=r.spec or "",
        location=r.location or "",
        quantity=r.quantity or 0,
        operator=r.operator or "",
        remark=r.remark or "",
        created_by=r.created_by,
        creator_name=r.creator.name if r.creator else "",
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


# ══════════════════════════════════════════════════════
# 货品管理
# ══════════════════════════════════════════════════════

@router.get("/products", response_model=dict)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    search: str = Query("", description="Search in code/name/category"),
    category: str = Query("", description="Filter by category"),
    all: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("warehouse_products:view")),
):
    query = db.query(WarehouseProduct).filter(WarehouseProduct.company_id == current_user.company_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (WarehouseProduct.code.like(pattern))
            | (WarehouseProduct.name.like(pattern))
            | (WarehouseProduct.category.like(pattern))
        )
    if category:
        query = query.filter(WarehouseProduct.category == category)

    if all:
        items = query.order_by(WarehouseProduct.created_at.desc()).all()
        return {"total": len(items), "page": 1, "page_size": len(items),
                "items": [product_to_out(p, db) for p in items]}

    total = query.count()
    items = query.order_by(WarehouseProduct.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [product_to_out(p, db) for p in items],
    }


@router.get("/products/{product_id}", response_model=WarehouseProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("warehouse_products:create")),
):
    p = db.query(WarehouseProduct).filter(WarehouseProduct.id == product_id, WarehouseProduct.company_id == current_user.company_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="货品不存在")
    return product_to_out(p, db)


@router.post("/products", response_model=WarehouseProductOut)
def create_product(
    data: WarehouseProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("warehouse_products:edit")),
):
    # 检查编码唯一性
    existing = db.query(WarehouseProduct).filter(WarehouseProduct.code == data.code, WarehouseProduct.company_id == current_user.company_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="产品编码已存在")
    p = WarehouseProduct(
        company_id=current_user.company_id,
        code=data.code,
        category=data.category,
        name=data.name,
        spec=data.spec,
        location=data.location,
        initial_qty=data.initial_qty,
        unit=data.unit,
        remark=data.remark,
        created_by=current_user.id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    audit_service.log(db, current_user, "create", "warehouse_product", p.id, f"新增货品: {p.name}({p.code})")
    return product_to_out(p, db)


@router.put("/products/{product_id}", response_model=WarehouseProductOut)
def update_product(
    product_id: int,
    data: WarehouseProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("warehouse_inbound:view")),
):
    p = db.query(WarehouseProduct).filter(WarehouseProduct.id == product_id, WarehouseProduct.company_id == current_user.company_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="货品不存在")
    # 检查编码唯一性（排除自身）
    if data.code and data.code != p.code:
        existing = db.query(WarehouseProduct).filter(
            WarehouseProduct.code == data.code, WarehouseProduct.id != product_id,
            WarehouseProduct.company_id == current_user.company_id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="产品编码已存在")
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(p, field, val)
    db.commit()
    db.refresh(p)
    audit_service.log(db, current_user, "update", "warehouse_product", p.id, f"更新货品: {p.name}({p.code})")
    return product_to_out(p, db)


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("warehouse_inbound:create")),
):
    p = db.query(WarehouseProduct).filter(WarehouseProduct.id == product_id, WarehouseProduct.company_id == current_user.company_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="货品不存在")
    # 检查是否有入出库记录
    inbound_count = db.query(WarehouseInbound).filter(WarehouseInbound.product_id == product_id, WarehouseInbound.company_id == current_user.company_id).count()
    outbound_count = db.query(WarehouseOutbound).filter(WarehouseOutbound.product_id == product_id, WarehouseOutbound.company_id == current_user.company_id).count()
    if inbound_count > 0 or outbound_count > 0:
        raise HTTPException(status_code=400, detail="该货品存在入/出库记录，无法删除")
    audit_service.log(db, current_user, "delete", "warehouse_product", p.id, f"删除货品: {p.name}({p.code})")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════
# 入库处理记录（必须在 /inbound 列表路由之前定义）
# ══════════════════════════════════════════════════════

@router.get("/inbound/{record_id}/feedbacks", response_model=list[WarehouseInboundFeedbackOut])
def get_inbound_feedbacks(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("warehouse_inbound:edit")),
):
    """获取入库记录的处理记录列表"""
    feedbacks = db.query(WarehouseInboundFeedback).filter(
        WarehouseInboundFeedback.record_id == record_id,
        WarehouseInboundFeedback.company_id == current_user.company_id,
    ).order_by(WarehouseInboundFeedback.created_at.asc()).all()
    return [
        WarehouseInboundFeedbackOut(
            id=fb.id,
            record_id=fb.record_id,
            user_id=fb.user_id,
            content=fb.content,
            created_at=fb.created_at,
            user_name=fb.user.name if fb.user else "",
        )
        for fb in feedbacks
    ]


@router.post("/inbound/{record_id}/feedback", response_model=WarehouseInboundFeedbackOut)
def add_inbound_feedback(
    record_id: int,
    data: WarehouseInboundFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("warehouse_outbound:view")),
):
    """添加入库记录的处理记录"""
    # 验证记录是否存在
    record = db.query(WarehouseInbound).filter(WarehouseInbound.id == record_id, WarehouseInbound.company_id == current_user.company_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="入库记录不存在")

    fb = WarehouseInboundFeedback(
        company_id=current_user.company_id,
        record_id=record_id,
        user_id=current_user.id,
        content=data.content,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return WarehouseInboundFeedbackOut(
        id=fb.id,
        record_id=fb.record_id,
        user_id=fb.user_id,
        content=fb.content,
        created_at=fb.created_at,
        user_name=current_user.name,
    )


# ══════════════════════════════════════════════════════
# 入库管理
# ══════════════════════════════════════════════════════

@router.get("/inbound", response_model=dict)
def list_inbound(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    search: str = Query(""),
    product_id: int = Query(0),
    start_date: str = Query(""),
    end_date: str = Query(""),
    all: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("warehouse_outbound:create")),
):
    query = db.query(WarehouseInbound).filter(WarehouseInbound.company_id == current_user.company_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (WarehouseInbound.product_name.like(pattern))
            | (WarehouseInbound.product_code.like(pattern))
            | (WarehouseInbound.operator.like(pattern))
        )
    if product_id:
        query = query.filter(WarehouseInbound.product_id == product_id)
    if start_date:
        query = query.filter(WarehouseInbound.date >= start_date)
    if end_date:
        query = query.filter(WarehouseInbound.date <= end_date)

    if all:
        items = query.order_by(WarehouseInbound.created_at.desc()).all()
        return {"total": len(items), "page": 1, "page_size": len(items),
                "items": [inbound_to_out(r) for r in items]}

    total = query.count()
    items = query.order_by(WarehouseInbound.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [inbound_to_out(r) for r in items],
    }


@router.post("/inbound", response_model=WarehouseInboundOut)
def create_inbound(
    data: WarehouseInboundCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("warehouse_outbound:edit")),
):
    product = db.query(WarehouseProduct).filter(WarehouseProduct.id == data.product_id, WarehouseProduct.company_id == current_user.company_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="货品不存在")
    r = WarehouseInbound(
        company_id=current_user.company_id,
        date=data.date,
        product_id=data.product_id,
        product_code=product.code,
        category=product.category,
        product_name=product.name,
        spec=product.spec,
        location=product.location,
        quantity=data.quantity,
        operator=data.operator,
        remark=data.remark,
        created_by=current_user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "create", "warehouse_inbound", r.id,
                      f"入库: {product.name}({product.code}) x{data.quantity}")
    return inbound_to_out(r)


@router.put("/inbound/{record_id}", response_model=WarehouseInboundOut)
def update_inbound(
    record_id: int,
    data: WarehouseInboundUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(WarehouseInbound).filter(WarehouseInbound.id == record_id, WarehouseInbound.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="记录不存在")
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(r, field, val)
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "update", "warehouse_inbound", r.id, f"更新入库记录: #{record_id}")
    return inbound_to_out(r)


@router.delete("/inbound/{record_id}")
def delete_inbound(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(WarehouseInbound).filter(WarehouseInbound.id == record_id, WarehouseInbound.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="记录不存在")
    audit_service.log(db, current_user, "delete", "warehouse_inbound", r.id,
                      f"删除入库记录: {r.product_name} x{r.quantity}")
    db.delete(r)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════
# 出库处理记录（必须在 /outbound 列表路由之前定义）
# ══════════════════════════════════════════════════════

@router.get("/outbound/{record_id}/feedbacks", response_model=list[WarehouseOutboundFeedbackOut])
def get_outbound_feedbacks(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取出库记录的处理记录列表"""
    feedbacks = db.query(WarehouseOutboundFeedback).filter(
        WarehouseOutboundFeedback.record_id == record_id,
        WarehouseOutboundFeedback.company_id == current_user.company_id,
    ).order_by(WarehouseOutboundFeedback.created_at.asc()).all()
    return [
        WarehouseOutboundFeedbackOut(
            id=fb.id,
            record_id=fb.record_id,
            user_id=fb.user_id,
            content=fb.content,
            created_at=fb.created_at,
            user_name=fb.user.name if fb.user else "",
        )
        for fb in feedbacks
    ]


@router.post("/outbound/{record_id}/feedback", response_model=WarehouseOutboundFeedbackOut)
def add_outbound_feedback(
    record_id: int,
    data: WarehouseOutboundFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """添加出库记录的处理记录"""
    # 验证记录是否存在
    record = db.query(WarehouseOutbound).filter(WarehouseOutbound.id == record_id, WarehouseOutbound.company_id == current_user.company_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="出库记录不存在")

    fb = WarehouseOutboundFeedback(
        company_id=current_user.company_id,
        record_id=record_id,
        user_id=current_user.id,
        content=data.content,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return WarehouseOutboundFeedbackOut(
        id=fb.id,
        record_id=fb.record_id,
        user_id=fb.user_id,
        content=fb.content,
        created_at=fb.created_at,
        user_name=current_user.name,
    )


# ══════════════════════════════════════════════════════
# 出库管理
# ══════════════════════════════════════════════════════

@router.get("/outbound", response_model=dict)
def list_outbound(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    search: str = Query(""),
    product_id: int = Query(0),
    start_date: str = Query(""),
    end_date: str = Query(""),
    all: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(WarehouseOutbound).filter(WarehouseOutbound.company_id == current_user.company_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (WarehouseOutbound.product_name.like(pattern))
            | (WarehouseOutbound.product_code.like(pattern))
            | (WarehouseOutbound.operator.like(pattern))
        )
    if product_id:
        query = query.filter(WarehouseOutbound.product_id == product_id)
    if start_date:
        query = query.filter(WarehouseOutbound.date >= start_date)
    if end_date:
        query = query.filter(WarehouseOutbound.date <= end_date)

    if all:
        items = query.order_by(WarehouseOutbound.created_at.desc()).all()
        return {"total": len(items), "page": 1, "page_size": len(items),
                "items": [outbound_to_out(r) for r in items]}

    total = query.count()
    items = query.order_by(WarehouseOutbound.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [outbound_to_out(r) for r in items],
    }


@router.post("/outbound", response_model=WarehouseOutboundOut)
def create_outbound(
    data: WarehouseOutboundCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(WarehouseProduct).filter(WarehouseProduct.id == data.product_id, WarehouseProduct.company_id == current_user.company_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="货品不存在")
    # 检查库存是否充足
    current_stock = _calc_stock(db, product.id, product.initial_qty or 0, current_user.company_id)
    if data.quantity > current_stock:
        raise HTTPException(status_code=400, detail=f"库存不足，当前库存: {current_stock} {product.unit}")
    r = WarehouseOutbound(
        company_id=current_user.company_id,
        date=data.date,
        product_id=data.product_id,
        product_code=product.code,
        category=product.category,
        product_name=product.name,
        spec=product.spec,
        location=product.location,
        quantity=data.quantity,
        operator=data.operator,
        remark=data.remark,
        created_by=current_user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "create", "warehouse_outbound", r.id,
                      f"出库: {product.name}({product.code}) x{data.quantity}")
    return outbound_to_out(r)


@router.put("/outbound/{record_id}", response_model=WarehouseOutboundOut)
def update_outbound(
    record_id: int,
    data: WarehouseOutboundUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(WarehouseOutbound).filter(WarehouseOutbound.id == record_id, WarehouseOutbound.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="记录不存在")
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(r, field, val)
    db.commit()
    db.refresh(r)
    audit_service.log(db, current_user, "update", "warehouse_outbound", r.id, f"更新出库记录: #{record_id}")
    return outbound_to_out(r)


@router.delete("/outbound/{record_id}")
def delete_outbound(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(WarehouseOutbound).filter(WarehouseOutbound.id == record_id, WarehouseOutbound.company_id == current_user.company_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="记录不存在")
    audit_service.log(db, current_user, "delete", "warehouse_outbound", r.id,
                      f"删除出库记录: {r.product_name} x{r.quantity}")
    db.delete(r)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════
# 库存统计（概览）
# ══════════════════════════════════════════════════════

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """返回库存概览统计数据"""
    products = db.query(WarehouseProduct).filter(WarehouseProduct.company_id == current_user.company_id).all()
    total_products = len(products)
    total_inbound = db.query(func.sum(WarehouseInbound.quantity)).filter(WarehouseInbound.company_id == current_user.company_id).scalar() or 0
    total_outbound = db.query(func.sum(WarehouseOutbound.quantity)).filter(WarehouseOutbound.company_id == current_user.company_id).scalar() or 0
    low_stock_items = []
    for p in products:
        stock = _calc_stock(db, p.id, p.initial_qty or 0, current_user.company_id)
        if stock <= 20:  # 库存 <= 20 视为低库存预警
            low_stock_items.append({
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "current_qty": stock,
                "unit": p.unit,
            })
    return {
        "total_products": total_products,
        "total_inbound": total_inbound,
        "total_outbound": total_outbound,
        "current_qty": (db.query(func.sum(WarehouseProduct.initial_qty)).filter(WarehouseProduct.company_id == current_user.company_id).scalar() or 0) + total_inbound - total_outbound,
        "low_stock_count": len(low_stock_items),
        "low_stock_items": low_stock_items[:10],
    }
