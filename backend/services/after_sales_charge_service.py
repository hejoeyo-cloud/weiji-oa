from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from database import AfterSalesChargeRequest, AfterSalesFeedback, AfterSalesRecord, Department, User
from services import audit_service, notification_service


def _is_customer_department(user: User) -> bool:
    return bool(user.department and "客服" in (user.department.name or ""))


def can_create_charge_request(user: User) -> bool:
    perms = user.role_obj.permissions if user.role_obj and user.role_obj.permissions else []
    return user.role in ("admin", "technician") or "return_exchange:process" in perms


def can_mark_charge_paid(user: User) -> bool:
    return user.role == "admin" or user.role == "customer" or _is_customer_department(user)


def can_cancel_charge_request(user: User) -> bool:
    return can_create_charge_request(user)


def get_customer_recipients(db: Session, company_id: int) -> list[User]:
    customer_departments = db.query(Department).filter(
        Department.name.like("%客服%"),
        Department.company_id == company_id,
    ).all()
    department_ids = [dept.id for dept in customer_departments]
    if department_ids:
        users = db.query(User).filter(User.department_id.in_(department_ids), User.company_id == company_id).all()
        if users:
            return users
    return db.query(User).filter(User.role == "customer", User.company_id == company_id).all()


def add_after_sales_feedback(db: Session, record_id: int, user_id: int, content: str):
    user = db.query(User).filter(User.id == user_id).first()
    feedback = AfterSalesFeedback(company_id=user.company_id if user else None, record_id=record_id, user_id=user_id, content=content)
    db.add(feedback)


def sync_record_charge_summary(db: Session, record: AfterSalesRecord):
    latest = db.query(AfterSalesChargeRequest).filter(
        AfterSalesChargeRequest.after_sales_record_id == record.id
    ).order_by(AfterSalesChargeRequest.id.desc()).first()
    if latest:
        record.last_charge_request_id = latest.id
        record.charge_required = latest.status != "cancelled"
        record.charge_status = latest.status
        record.current_expected_amount = latest.expected_amount or 0
        record.current_paid_amount = latest.paid_amount or 0
    else:
        record.last_charge_request_id = None
        record.charge_required = False
        record.charge_status = "none"
        record.current_expected_amount = 0
        record.current_paid_amount = 0
    record.updated_at = datetime.now()


def create_charge_request(
    db: Session,
    record: AfterSalesRecord,
    current_user: User,
    expected_amount: float,
    charge_note: str,
):
    if not can_create_charge_request(current_user):
        raise HTTPException(status_code=403, detail="无权限发起收费维修")
    if expected_amount <= 0:
        raise HTTPException(status_code=400, detail="预计收费金额必须大于 0")

    pending = db.query(AfterSalesChargeRequest).filter(
        AfterSalesChargeRequest.after_sales_record_id == record.id,
        AfterSalesChargeRequest.company_id == record.company_id,
        AfterSalesChargeRequest.status == "pending_charge",
    ).first()
    if pending:
        raise HTTPException(status_code=400, detail="当前已有待收费请求，请先完成或取消")

    charge_request = AfterSalesChargeRequest(
        company_id=record.company_id,
        after_sales_record_id=record.id,
        status="pending_charge",
        expected_amount=expected_amount,
        charge_note=charge_note or "",
        created_by=current_user.id,
    )
    db.add(charge_request)
    db.flush()
    sync_record_charge_summary(db, record)
    add_after_sales_feedback(
        db,
        record.id,
        current_user.id,
        f"发起收费维修，预计金额 ¥{expected_amount:.2f}" + (f"；说明：{charge_note}" if charge_note else ""),
    )
    audit_service.log(
        db, current_user, "create", "after_sales_charge_request", charge_request.id,
        f"发起售后收费维修: record=#{record.id}, expected={expected_amount:.2f}"
    )
    recipients = get_customer_recipients(db, record.company_id)
    recipient_ids = sorted({user.id for user in recipients if user.id != current_user.id})
    db.commit()
    db.refresh(charge_request)
    db.refresh(record)

    for user_id in recipient_ids:
        notification_service.create_and_push(
            db,
            user_id=user_id,
            title=f"售后单 #{record.id} 需客服收费",
            content=f"预计金额 ¥{expected_amount:.2f}",
            resource_type="after_sales",
            resource_id=record.id,
        )

    return charge_request


def mark_charge_paid(
    db: Session,
    charge_request: AfterSalesChargeRequest,
    current_user: User,
    paid_amount: float,
    amount_change_note: str,
):
    if not can_mark_charge_paid(current_user):
        raise HTTPException(status_code=403, detail="无权限确认收费")
    if charge_request.status != "pending_charge":
        raise HTTPException(status_code=400, detail="当前收费请求不处于待收费状态")
    if paid_amount <= 0:
        raise HTTPException(status_code=400, detail="实收金额必须大于 0")
    if paid_amount != (charge_request.expected_amount or 0) and not amount_change_note.strip():
        raise HTTPException(status_code=400, detail="金额有变更时必须填写修改说明")

    record = charge_request.record
    charge_request.status = "paid"
    charge_request.paid_amount = paid_amount
    charge_request.amount_change_note = amount_change_note.strip()
    charge_request.paid_by = current_user.id
    charge_request.paid_at = datetime.now()
    charge_request.updated_at = datetime.now()
    sync_record_charge_summary(db, record)
    content = f"客服已收费，实收金额 ¥{paid_amount:.2f}"
    if charge_request.amount_change_note:
        content += f"；改价说明：{charge_request.amount_change_note}"
    add_after_sales_feedback(db, record.id, current_user.id, content)
    audit_service.log(
        db, current_user, "update", "after_sales_charge_request", charge_request.id,
        f"确认售后收费: record=#{record.id}, paid={paid_amount:.2f}"
    )
    db.commit()
    db.refresh(charge_request)
    db.refresh(record)

    notification_service.create_and_push(
        db,
        user_id=charge_request.created_by,
        title=f"售后单 #{record.id} 已收费",
        content=f"实收金额 ¥{paid_amount:.2f}",
        resource_type="after_sales",
        resource_id=record.id,
    )
    return charge_request


def cancel_charge_request(
    db: Session,
    charge_request: AfterSalesChargeRequest,
    current_user: User,
    reason: str,
):
    if not can_cancel_charge_request(current_user):
        raise HTTPException(status_code=403, detail="无权限取消收费请求")
    if charge_request.status != "pending_charge":
        raise HTTPException(status_code=400, detail="仅待收费请求可取消")

    record = charge_request.record
    charge_request.status = "cancelled"
    charge_request.updated_at = datetime.now()
    sync_record_charge_summary(db, record)
    add_after_sales_feedback(
        db,
        record.id,
        current_user.id,
        "取消收费维修请求" + (f"；原因：{reason.strip()}" if reason.strip() else ""),
    )
    audit_service.log(
        db, current_user, "update", "after_sales_charge_request", charge_request.id,
        f"取消售后收费请求: record=#{record.id}"
    )
    db.commit()
    db.refresh(charge_request)
    db.refresh(record)
    return charge_request
