"""财务业务路由：客户开票申请 / 销项发票台账 / 进项发票台账 / 报销发票"""
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import get_current_user, require_permission
from database import (
    CustomerInvoiceRequest, SalesInvoice, PurchaseInvoice, ExpenseInvoice,
    Role, User, get_db
)
from schemas import (
    CustomerInvoiceRequestCreate, CustomerInvoiceRequestUpdate, CustomerInvoiceRequestOut,
    SalesInvoiceCreate, SalesInvoiceUpdate, SalesInvoiceOut,
    PurchaseInvoiceCreate, PurchaseInvoiceUpdate, PurchaseInvoiceOut,
    ExpenseInvoiceCreate, ExpenseInvoiceUpdate, ExpenseInvoiceOut,
)
from config import UPLOAD_DIR
from storage import get_storage
storage = get_storage()
from services import notification_service

router = APIRouter(prefix="/finance", tags=["finance"])

# 财务用户识别：拥有财务业务编辑/删除权限的用户
FINANCE_EDIT_PERMISSIONS = [
    "finance_invoice_request:edit", "finance_invoice_request:delete",
    "finance_sales_invoice:edit", "finance_sales_invoice:delete",
    "finance_purchase_invoice:edit", "finance_purchase_invoice:delete",
    "finance_expense_invoice:edit", "finance_expense_invoice:delete",
]


def _get_finance_users(db: Session, company_id: int) -> list[User]:
    """获取所有财务用户（有编辑/删除权限的用户）"""
    users = db.query(User).filter(User.company_id == company_id).all()
    result = []
    for u in users:
        # 获取用户权限（从关联角色获取）
        perms = []
        if u.role_obj and u.role_obj.permissions:
            perms = u.role_obj.permissions
        elif u.role:  # 兼容旧的 role 字段
            role_obj = db.query(Role).filter(Role.name == u.role, Role.company_id == company_id).first()
            if role_obj and role_obj.permissions:
                perms = role_obj.permissions
        if any(p in perms for p in FINANCE_EDIT_PERMISSIONS):
            result.append(u)
    return result


def _user_name(db: Session, user_id: Optional[int]) -> str:
    if not user_id:
        return ""
    u = db.query(User).filter(User.id == user_id).first()
    return u.name if u else ""


# ══════════════════════════════════════════════════════════════
# 客户开票申请
# ══════════════════════════════════════════════════════════════

def _invoice_request_out(r: CustomerInvoiceRequest, db: Session) -> CustomerInvoiceRequestOut:
    d = CustomerInvoiceRequestOut.from_orm(r)
    d.created_by_name = _user_name(db, r.created_by)
    return d


@router.get("/invoice-requests", response_model=dict)
def list_invoice_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str = Query(""),
    status: str = Query(""),
    invoice_type: str = Query(""),
    start_date: str = Query(""),
    end_date: str = Query(""),
    all: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_invoice_request:view")),
):
    q = db.query(CustomerInvoiceRequest).filter(CustomerInvoiceRequest.company_id == current_user.company_id)
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(or_(
            CustomerInvoiceRequest.order_no.like(kw),
            CustomerInvoiceRequest.customer_name.like(kw),
            CustomerInvoiceRequest.shop_name.like(kw),
            CustomerInvoiceRequest.invoice_content.like(kw),
        ))
    if status:
        q = q.filter(CustomerInvoiceRequest.status == status)
    if invoice_type:
        q = q.filter(CustomerInvoiceRequest.invoice_type == invoice_type)
    if start_date:
        q = q.filter(CustomerInvoiceRequest.apply_date >= start_date)
    if end_date:
        q = q.filter(CustomerInvoiceRequest.apply_date <= end_date)
    q = q.order_by(CustomerInvoiceRequest.id.desc())
    total = q.count()
    if all:
        items = q.all()
    else:
        items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_invoice_request_out(r, db).dict() for r in items]}


@router.post("/invoice-requests", response_model=CustomerInvoiceRequestOut)
def create_invoice_request(
    data: CustomerInvoiceRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_invoice_request:create")),
):
    obj = CustomerInvoiceRequest(**data.dict(), company_id=current_user.company_id, created_by=current_user.id)
    db.add(obj)
    db.commit()
    db.refresh(obj)

    # 通知所有财务用户有新申请
    finance_users = _get_finance_users(db, current_user.company_id)
    for fu in finance_users:
        if fu.id != current_user.id:  # 不通知自己
            notification_service.create_and_push(
                db=db,
                user_id=fu.id,
                title="新的开票申请",
                content=f"{current_user.name} 提交了新的开票申请，订单号：{data.order_no}，请及时处理。",
                resource_type="invoice_request",
                resource_id=obj.id,
            )

    return _invoice_request_out(obj, db)


@router.put("/invoice-requests/{rid}", response_model=CustomerInvoiceRequestOut)
def update_invoice_request(
    rid: int,
    data: CustomerInvoiceRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_invoice_request:edit")),
):
    obj = db.query(CustomerInvoiceRequest).filter(CustomerInvoiceRequest.id == rid, CustomerInvoiceRequest.company_id == current_user.company_id).first()
    if not obj:
        raise HTTPException(404, "记录不存在")
    for k, v in data.dict(exclude_none=True).items():
        setattr(obj, k, v)
    obj.updated_at = datetime.now()
    db.commit()
    db.refresh(obj)
    return _invoice_request_out(obj, db)


@router.delete("/invoice-requests/{rid}")
def delete_invoice_request(
    rid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_invoice_request:delete")),
):
    obj = db.query(CustomerInvoiceRequest).filter(CustomerInvoiceRequest.id == rid, CustomerInvoiceRequest.company_id == current_user.company_id).first()
    if not obj:
        raise HTTPException(404, "记录不存在")
    db.delete(obj)
    db.commit()
    return {"ok": True}


@router.post("/invoice-requests/{rid}/upload-invoice")
async def upload_invoice_file(
    rid: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_invoice_request:edit")),
):
    """上传发票附件（PDF 或图片），并通知申请人"""
    obj = db.query(CustomerInvoiceRequest).filter(CustomerInvoiceRequest.id == rid, CustomerInvoiceRequest.company_id == current_user.company_id).first()
    if not obj:
        raise HTTPException(404, "记录不存在")

    # 验证文件类型
    ext = os.path.splitext(file.filename or "")[1].lower()
    allowed_exts = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}
    if ext not in allowed_exts:
        raise HTTPException(400, "不支持的文件格式，仅支持 PDF 和图片")

    # 读取并保存文件
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, "文件过大，最大 20MB")

    filename = f"{uuid.uuid4().hex}{ext}"
    stored_path = storage.save(content, filename)

    # 更新记录
    obj.invoice_file = storage.get_url(stored_path)
    obj.invoice_filename = file.filename or filename
    obj.updated_at = datetime.now()
    db.commit()
    db.refresh(obj)

    # 通知申请人
    if obj.created_by and obj.created_by != current_user.id:
        notification_service.create_and_push(
            db=db,
            user_id=obj.created_by,
            title="发票已开具",
            content=f"您申请的开票发票已开具，订单号：{obj.order_no}，请前往查看并下载。",
            resource_type="invoice_request",
            resource_id=obj.id,
        )

    return {
        "url": obj.invoice_file,
        "filename": obj.invoice_filename,
        "record": _invoice_request_out(obj, db).dict(),
    }


# ══════════════════════════════════════════════════════════════
# 销项发票台账
# ══════════════════════════════════════════════════════════════

def _sales_invoice_out(r: SalesInvoice, db: Session) -> SalesInvoiceOut:
    d = SalesInvoiceOut.from_orm(r)
    d.created_by_name = _user_name(db, r.created_by)
    return d


@router.get("/sales-invoices", response_model=dict)
def list_sales_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str = Query(""),
    invoice_type: str = Query(""),
    start_date: str = Query(""),
    end_date: str = Query(""),
    all: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_sales_invoice:view")),
):
    q = db.query(SalesInvoice).filter(SalesInvoice.company_id == current_user.company_id)
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(or_(
            SalesInvoice.invoice_no.like(kw),
            SalesInvoice.buyer_name.like(kw),
            SalesInvoice.invoice_content.like(kw),
            SalesInvoice.order_no.like(kw),
            SalesInvoice.shop_name.like(kw),
        ))
    if invoice_type:
        q = q.filter(SalesInvoice.invoice_type == invoice_type)
    if start_date:
        q = q.filter(SalesInvoice.invoice_date >= start_date)
    if end_date:
        q = q.filter(SalesInvoice.invoice_date <= end_date)
    q = q.order_by(SalesInvoice.id.desc())
    total = q.count()
    if all:
        items = q.all()
    else:
        items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_sales_invoice_out(r, db).dict() for r in items]}


@router.post("/sales-invoices", response_model=SalesInvoiceOut)
def create_sales_invoice(
    data: SalesInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_sales_invoice:create")),
):
    obj = SalesInvoice(**data.dict(), company_id=current_user.company_id, created_by=current_user.id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _sales_invoice_out(obj, db)


@router.put("/sales-invoices/{rid}", response_model=SalesInvoiceOut)
def update_sales_invoice(
    rid: int,
    data: SalesInvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_sales_invoice:edit")),
):
    obj = db.query(SalesInvoice).filter(SalesInvoice.id == rid, SalesInvoice.company_id == current_user.company_id).first()
    if not obj:
        raise HTTPException(404, "记录不存在")
    for k, v in data.dict(exclude_none=True).items():
        setattr(obj, k, v)
    obj.updated_at = datetime.now()
    db.commit()
    db.refresh(obj)
    return _sales_invoice_out(obj, db)


@router.delete("/sales-invoices/{rid}")
def delete_sales_invoice(
    rid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_sales_invoice:delete")),
):
    obj = db.query(SalesInvoice).filter(SalesInvoice.id == rid, SalesInvoice.company_id == current_user.company_id).first()
    if not obj:
        raise HTTPException(404, "记录不存在")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
# 进项发票台账
# ══════════════════════════════════════════════════════════════

def _purchase_invoice_out(r: PurchaseInvoice, db: Session) -> PurchaseInvoiceOut:
    d = PurchaseInvoiceOut.from_orm(r)
    d.created_by_name = _user_name(db, r.created_by)
    return d


@router.get("/purchase-invoices", response_model=dict)
def list_purchase_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str = Query(""),
    invoice_type: str = Query(""),
    is_certified: Optional[bool] = Query(None),
    start_date: str = Query(""),
    end_date: str = Query(""),
    all: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_purchase_invoice:view")),
):
    q = db.query(PurchaseInvoice).filter(PurchaseInvoice.company_id == current_user.company_id)
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(or_(
            PurchaseInvoice.invoice_no.like(kw),
            PurchaseInvoice.seller_name.like(kw),
            PurchaseInvoice.invoice_content.like(kw),
            PurchaseInvoice.related_contract.like(kw),
        ))
    if invoice_type:
        q = q.filter(PurchaseInvoice.invoice_type == invoice_type)
    if is_certified is not None:
        q = q.filter(PurchaseInvoice.is_certified == is_certified)
    if start_date:
        q = q.filter(PurchaseInvoice.invoice_date >= start_date)
    if end_date:
        q = q.filter(PurchaseInvoice.invoice_date <= end_date)
    q = q.order_by(PurchaseInvoice.id.desc())
    total = q.count()
    if all:
        items = q.all()
    else:
        items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_purchase_invoice_out(r, db).dict() for r in items]}


@router.post("/purchase-invoices", response_model=PurchaseInvoiceOut)
def create_purchase_invoice(
    data: PurchaseInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_purchase_invoice:create")),
):
    obj = PurchaseInvoice(**data.dict(), company_id=current_user.company_id, created_by=current_user.id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _purchase_invoice_out(obj, db)


@router.put("/purchase-invoices/{rid}", response_model=PurchaseInvoiceOut)
def update_purchase_invoice(
    rid: int,
    data: PurchaseInvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_purchase_invoice:edit")),
):
    obj = db.query(PurchaseInvoice).filter(PurchaseInvoice.id == rid, PurchaseInvoice.company_id == current_user.company_id).first()
    if not obj:
        raise HTTPException(404, "记录不存在")
    for k, v in data.dict(exclude_none=True).items():
        setattr(obj, k, v)
    obj.updated_at = datetime.now()
    db.commit()
    db.refresh(obj)
    return _purchase_invoice_out(obj, db)


@router.delete("/purchase-invoices/{rid}")
def delete_purchase_invoice(
    rid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_purchase_invoice:delete")),
):
    obj = db.query(PurchaseInvoice).filter(PurchaseInvoice.id == rid, PurchaseInvoice.company_id == current_user.company_id).first()
    if not obj:
        raise HTTPException(404, "记录不存在")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
# 报销发票台账
# ══════════════════════════════════════════════════════════════

def _expense_invoice_out(r: ExpenseInvoice, db: Session) -> ExpenseInvoiceOut:
    d = ExpenseInvoiceOut.from_orm(r)
    d.created_by_name = _user_name(db, r.created_by)
    return d


@router.get("/expense-invoices", response_model=dict)
def list_expense_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str = Query(""),
    is_paid: Optional[bool] = Query(None),
    is_duplicate: Optional[bool] = Query(None),
    start_date: str = Query(""),
    end_date: str = Query(""),
    all: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_expense_invoice:view")),
):
    q = db.query(ExpenseInvoice).filter(ExpenseInvoice.company_id == current_user.company_id)
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(or_(
            ExpenseInvoice.invoice_no.like(kw),
            ExpenseInvoice.seller_name.like(kw),
            ExpenseInvoice.summary.like(kw),
            ExpenseInvoice.reimburser.like(kw),
            ExpenseInvoice.department.like(kw),
        ))
    if is_paid is not None:
        q = q.filter(ExpenseInvoice.is_paid == is_paid)
    if is_duplicate is not None:
        q = q.filter(ExpenseInvoice.is_duplicate == is_duplicate)
    if start_date:
        q = q.filter(ExpenseInvoice.reimbursement_date >= start_date)
    if end_date:
        q = q.filter(ExpenseInvoice.reimbursement_date <= end_date)
    q = q.order_by(ExpenseInvoice.id.desc())
    total = q.count()
    if all:
        items = q.all()
    else:
        items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_expense_invoice_out(r, db).dict() for r in items]}


@router.post("/expense-invoices", response_model=ExpenseInvoiceOut)
def create_expense_invoice(
    data: ExpenseInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_expense_invoice:create")),
):
    # 查重逻辑：同一发票号是否已存在
    is_dup = False
    if data.invoice_no:
        existing = db.query(ExpenseInvoice).filter(
            ExpenseInvoice.invoice_no == data.invoice_no
            , ExpenseInvoice.company_id == current_user.company_id
        ).first()
        if existing:
            is_dup = True
    obj = ExpenseInvoice(**data.dict(), company_id=current_user.company_id, is_duplicate=is_dup, created_by=current_user.id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _expense_invoice_out(obj, db)


@router.put("/expense-invoices/{rid}", response_model=ExpenseInvoiceOut)
def update_expense_invoice(
    rid: int,
    data: ExpenseInvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_expense_invoice:edit")),
):
    obj = db.query(ExpenseInvoice).filter(ExpenseInvoice.id == rid, ExpenseInvoice.company_id == current_user.company_id).first()
    if not obj:
        raise HTTPException(404, "记录不存在")
    update_data = data.dict(exclude_none=True)
    # 如果修改了发票号，重新校验查重
    if "invoice_no" in update_data and update_data["invoice_no"]:
        dup = db.query(ExpenseInvoice).filter(
            ExpenseInvoice.invoice_no == update_data["invoice_no"],
            ExpenseInvoice.id != rid,
            ExpenseInvoice.company_id == current_user.company_id,
        ).first()
        update_data["is_duplicate"] = bool(dup)
    for k, v in update_data.items():
        setattr(obj, k, v)
    obj.updated_at = datetime.now()
    db.commit()
    db.refresh(obj)
    return _expense_invoice_out(obj, db)


@router.delete("/expense-invoices/{rid}")
def delete_expense_invoice(
    rid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance_expense_invoice:delete")),
):
    obj = db.query(ExpenseInvoice).filter(ExpenseInvoice.id == rid, ExpenseInvoice.company_id == current_user.company_id).first()
    if not obj:
        raise HTTPException(404, "记录不存在")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
# 统计摘要
# ══════════════════════════════════════════════════════════════

@router.get("/stats")
def get_finance_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取财务模块概览统计"""
    from sqlalchemy import func

    # 开票申请统计
    req_total = db.query(CustomerInvoiceRequest).filter(CustomerInvoiceRequest.company_id == current_user.company_id).count()
    req_pending = db.query(CustomerInvoiceRequest).filter(
        CustomerInvoiceRequest.status == "pending",
        CustomerInvoiceRequest.company_id == current_user.company_id,
    ).count()

    # 销项发票统计
    sales_total_amount = db.query(func.sum(SalesInvoice.total_amount)).filter(SalesInvoice.company_id == current_user.company_id).scalar() or 0
    sales_count = db.query(SalesInvoice).filter(SalesInvoice.company_id == current_user.company_id).count()

    # 进项发票统计
    purchase_total = db.query(PurchaseInvoice).filter(PurchaseInvoice.company_id == current_user.company_id).count()
    purchase_uncertified = db.query(PurchaseInvoice).filter(
        PurchaseInvoice.is_certified == False,
        PurchaseInvoice.company_id == current_user.company_id,
    ).count()

    # 报销发票统计
    expense_total = db.query(ExpenseInvoice).filter(ExpenseInvoice.company_id == current_user.company_id).count()
    expense_duplicate = db.query(ExpenseInvoice).filter(
        ExpenseInvoice.is_duplicate == True,
        ExpenseInvoice.company_id == current_user.company_id,
    ).count()

    return {
        "invoice_requests": {"total": req_total, "pending": req_pending},
        "sales_invoices": {"count": sales_count, "total_amount": round(sales_total_amount, 2)},
        "purchase_invoices": {"total": purchase_total, "uncertified": purchase_uncertified},
        "expense_invoices": {"total": expense_total, "duplicate": expense_duplicate},
    }
