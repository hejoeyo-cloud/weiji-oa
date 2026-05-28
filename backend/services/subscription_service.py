from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from config import FIRST_YEAR_PRICE, RENEWAL_YEAR_PRICE, SUBSCRIPTION_GRACE_DAYS
from database import PaymentOrder, Subscription


def normalize_subscription(sub: Subscription | None) -> dict:
    if not sub:
        return {
            "status": "expired",
            "trial_end_at": None,
            "current_period_end": None,
            "grace_end_at": None,
            "is_writable": False,
            "days_remaining": 0,
        }
    now = datetime.now()
    effective_end = sub.current_period_end or sub.trial_end_at
    if sub.status == "disabled":
        status = "disabled"
        is_writable = False
        days_remaining = 0
    elif effective_end and now <= effective_end:
        status = "active" if sub.first_paid_at else "trial"
        is_writable = True
        days_remaining = max(0, (effective_end.date() - now.date()).days)
    elif sub.grace_end_at and now <= sub.grace_end_at:
        status = "grace"
        is_writable = True
        days_remaining = max(0, (sub.grace_end_at.date() - now.date()).days)
    else:
        status = "expired"
        is_writable = False
        days_remaining = 0
    return {
        "status": status,
        "trial_end_at": sub.trial_end_at,
        "current_period_end": sub.current_period_end,
        "grace_end_at": sub.grace_end_at,
        "is_writable": is_writable,
        "days_remaining": days_remaining,
    }


def next_plan(sub: Subscription) -> tuple[str, float]:
    if sub.first_paid_at:
        return "renewal", RENEWAL_YEAR_PRICE
    return "first_year", FIRST_YEAR_PRICE


def apply_paid_order(db: Session, order: PaymentOrder, trade_no: str = "", paid_at: datetime | None = None) -> Subscription:
    if order.status == "paid":
        return order.subscription
    now = paid_at or datetime.now()
    sub = order.subscription
    base = sub.current_period_end if sub.current_period_end and sub.current_period_end > now else now
    new_end = base + timedelta(days=365 * max(order.years or 1, 1))
    sub.status = "active"
    sub.current_period_start = now
    sub.current_period_end = new_end
    sub.grace_end_at = new_end + timedelta(days=SUBSCRIPTION_GRACE_DAYS)
    if not sub.first_paid_at:
        sub.first_paid_at = now
    sub.last_paid_at = now
    order.status = "paid"
    order.alipay_trade_no = trade_no or order.alipay_trade_no
    order.paid_at = now
    db.commit()
    db.refresh(sub)
    return sub
