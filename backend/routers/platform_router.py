from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from config import SUBSCRIPTION_GRACE_DAYS
from database import Company, PaymentOrder, Subscription, User, get_db
from schemas import CompanyOut, ManualSubscriptionUpdate, PaymentOrderOut
from auth import require_platform_admin
from services.subscription_service import normalize_subscription

router = APIRouter(prefix="/api/platform", tags=["platform"])


def _company_to_out(db: Session, c: Company) -> CompanyOut:
    sub = c.subscription
    return CompanyOut(
        id=c.id,
        name=c.name,
        status=c.status,
        user_count=db.query(User).filter(User.company_id == c.id).count(),
        subscription=normalize_subscription(sub),
        created_at=c.created_at,
    )


def _order_to_out(o: PaymentOrder) -> PaymentOrderOut:
    return PaymentOrderOut(
        id=o.id,
        order_no=o.order_no,
        company_id=o.company_id,
        company_name=o.company.name if o.company else "",
        plan_type=o.plan_type,
        amount=o.amount,
        years=o.years,
        status=o.status,
        alipay_trade_no=o.alipay_trade_no or "",
        paid_at=o.paid_at,
        created_at=o.created_at,
    )


@router.get("/companies", response_model=list[CompanyOut])
def list_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    companies = db.query(Company).order_by(Company.created_at.desc()).all()
    return [_company_to_out(db, c) for c in companies]


@router.put("/companies/{company_id}/subscription", response_model=CompanyOut)
def update_company_subscription(
    company_id: int,
    req: ManualSubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="公司不存在")
    sub = company.subscription
    if not sub:
        now = datetime.now()
        sub = Subscription(company_id=company.id, status="trial", trial_start_at=now, trial_end_at=now)
        db.add(sub)
        db.flush()
    now = datetime.now()
    if req.status:
        if req.status == "disabled":
            company.status = "disabled"
        elif req.status == "active":
            company.status = "active"
        sub.status = req.status
    if req.extend_days:
        base = sub.current_period_end if sub.current_period_end and sub.current_period_end > now else now
        sub.current_period_start = now
        sub.current_period_end = base + timedelta(days=req.extend_days)
        sub.grace_end_at = sub.current_period_end + timedelta(days=SUBSCRIPTION_GRACE_DAYS)
        sub.status = "active"
        if not sub.first_paid_at:
            sub.first_paid_at = now
        sub.last_paid_at = now
        company.status = "active"
    db.commit()
    db.refresh(company)
    return _company_to_out(db, company)


@router.get("/orders", response_model=list[PaymentOrderOut])
def list_platform_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    orders = db.query(PaymentOrder).order_by(PaymentOrder.created_at.desc()).limit(200).all()
    return [_order_to_out(o) for o in orders]
