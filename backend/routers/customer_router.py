from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from database import get_db, Ticket, RepairRecord, ReturnExchangeRecord, User
from auth import get_current_user

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("/{customer_id}/profile")
def get_customer_profile(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = current_user.company_id

    # 工单：customer_id 精确匹配
    ticket_count = db.query(func.count(Ticket.id)).filter(
        Ticket.company_id == cid,
        Ticket.customer_id == customer_id,
    ).scalar() or 0

    recent_tickets = db.query(Ticket).filter(
        Ticket.company_id == cid,
        Ticket.customer_id == customer_id,
    ).order_by(Ticket.created_at.desc()).limit(5).all()

    # 维修：customer_info LIKE 匹配
    pattern = f"%{customer_id}%"
    repair_count = db.query(func.count(RepairRecord.id)).filter(
        RepairRecord.company_id == cid,
        RepairRecord.customer_info.like(pattern),
    ).scalar() or 0

    recent_repairs = db.query(RepairRecord).filter(
        RepairRecord.company_id == cid,
        RepairRecord.customer_info.like(pattern),
    ).order_by(RepairRecord.created_at.desc()).limit(5).all()

    # 退换货：customer_info LIKE 匹配
    return_count = db.query(func.count(ReturnExchangeRecord.id)).filter(
        ReturnExchangeRecord.company_id == cid,
        ReturnExchangeRecord.customer_info.like(pattern),
        ReturnExchangeRecord.record_type == "return",
    ).scalar() or 0

    exchange_count = db.query(func.count(ReturnExchangeRecord.id)).filter(
        ReturnExchangeRecord.company_id == cid,
        ReturnExchangeRecord.customer_info.like(pattern),
        ReturnExchangeRecord.record_type == "exchange",
    ).scalar() or 0

    recent_returns = db.query(ReturnExchangeRecord).filter(
        ReturnExchangeRecord.company_id == cid,
        ReturnExchangeRecord.customer_info.like(pattern),
    ).order_by(ReturnExchangeRecord.created_at.desc()).limit(5).all()

    return {
        "customer_id": customer_id,
        "ticket_count": ticket_count,
        "repair_count": repair_count,
        "return_count": return_count,
        "exchange_count": exchange_count,
        "recent_tickets": [
            {
                "id": t.id,
                "status": t.status or "",
                "description": (t.description or "")[:100],
                "created_at": t.created_at,
            }
            for t in recent_tickets
        ],
        "recent_repairs": [
            {
                "id": r.id,
                "model": r.model or "",
                "repair_status": r.repair_status or "",
                "apply_date": r.apply_date or "",
            }
            for r in recent_repairs
        ],
        "recent_returns": [
            {
                "id": r.id,
                "model": r.model or "",
                "record_type": r.record_type or "",
                "progress": r.progress or "",
                "apply_date": r.apply_date or "",
            }
            for r in recent_returns
        ],
    }
