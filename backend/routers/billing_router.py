from datetime import datetime
import json
import time
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from sqlalchemy.orm import Session
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from config import ALIPAY_APP_ID, ALIPAY_GATEWAY, ALIPAY_NOTIFY_URL, ALIPAY_RETURN_URL, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY
from database import get_db, PaymentOrder, Subscription, User
from schemas import CreatePaymentOrderRequest, PaymentOrderOut, SubscriptionInfo
from auth import get_current_user, get_subscription_state
from services.subscription_service import apply_paid_order, next_plan

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _normalize_key(key: str) -> str:
    return key.replace("\\n", "\n").strip()


def _sign_content(params: dict) -> str:
    return "&".join(f"{k}={v}" for k, v in sorted(params.items()) if k not in ("sign",) and v not in (None, ""))


def _rsa2_sign(params: dict) -> str:
    private_key = serialization.load_pem_private_key(_normalize_key(ALIPAY_PRIVATE_KEY).encode(), password=None)
    signature = private_key.sign(_sign_content(params).encode("utf-8"), padding.PKCS1v15(), hashes.SHA256())
    import base64
    return base64.b64encode(signature).decode()


def _rsa2_verify(params: dict) -> bool:
    if not ALIPAY_PUBLIC_KEY:
        return True
    sign = params.get("sign", "")
    if not sign:
        return False
    import base64
    public_key = serialization.load_pem_public_key(_normalize_key(ALIPAY_PUBLIC_KEY).encode())
    try:
        public_key.verify(base64.b64decode(sign), _sign_content(params).encode("utf-8"), padding.PKCS1v15(), hashes.SHA256())
        return True
    except Exception:
        return False


def _order_to_out(order: PaymentOrder) -> PaymentOrderOut:
    return PaymentOrderOut(
        id=order.id,
        order_no=order.order_no,
        company_id=order.company_id,
        company_name=order.company.name if order.company else "",
        plan_type=order.plan_type,
        amount=order.amount,
        years=order.years,
        status=order.status,
        alipay_trade_no=order.alipay_trade_no or "",
        paid_at=order.paid_at,
        created_at=order.created_at,
    )


@router.get("/subscription", response_model=SubscriptionInfo)
def get_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_subscription_state(db, current_user)


@router.get("/orders", response_model=list[PaymentOrderOut])
def list_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    orders = db.query(PaymentOrder).filter(
        PaymentOrder.company_id == current_user.company_id
    ).order_by(PaymentOrder.created_at.desc()).all()
    return [_order_to_out(o) for o in orders]


@router.post("/orders", response_model=dict)
def create_payment_order(
    req: CreatePaymentOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.company_id == current_user.company_id).first()
    if not sub:
        raise HTTPException(status_code=400, detail="订阅信息不存在")
    plan_type, amount = next_plan(sub)
    years = max(req.years or 1, 1)
    order_no = f"SUB{int(time.time())}{current_user.company_id:04d}{current_user.id:04d}"
    order = PaymentOrder(
        order_no=order_no,
        company_id=current_user.company_id,
        subscription_id=sub.id,
        plan_type=plan_type,
        amount=amount * years,
        years=years,
        status="pending",
        created_by=current_user.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    configured = bool(ALIPAY_APP_ID and ALIPAY_NOTIFY_URL and ALIPAY_PRIVATE_KEY)
    params = {
        "app_id": ALIPAY_APP_ID,
        "method": "alipay.trade.page.pay",
        "charset": "utf-8",
        "sign_type": "RSA2",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "version": "1.0",
        "notify_url": ALIPAY_NOTIFY_URL,
        "return_url": ALIPAY_RETURN_URL,
        "biz_content": json.dumps({
            "out_trade_no": order.order_no,
            "product_code": "FAST_INSTANT_TRADE_PAY",
            "total_amount": f"{order.amount:.2f}",
            "subject": "Fries OA 年度订阅",
        }, ensure_ascii=False),
    }
    if configured:
        params["sign"] = _rsa2_sign(params)
    pay_url = f"{ALIPAY_GATEWAY}?{urlencode(params)}" if configured else ""
    return {"order": _order_to_out(order), "pay_url": pay_url, "configured": configured}


@router.post("/alipay/notify")
async def alipay_notify(request: Request, db: Session = Depends(get_db)):
    form = dict(await request.form())
    order_no = form.get("out_trade_no", "")
    trade_status = form.get("trade_status", "")
    trade_no = form.get("trade_no", "")
    if ALIPAY_PUBLIC_KEY and not _rsa2_verify(form):
        return "fail"
    order = db.query(PaymentOrder).filter(PaymentOrder.order_no == order_no).first()
    if not order:
        return "fail"
    order.alipay_payload = json.dumps(form, ensure_ascii=False)
    if trade_status in ("TRADE_SUCCESS", "TRADE_FINISHED"):
        apply_paid_order(db, order, trade_no=trade_no)
    else:
        db.commit()
    return "success"


@router.post("/orders/{order_id}/dev-mark-paid", response_model=PaymentOrderOut)
def dev_mark_paid(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(PaymentOrder).filter(
        PaymentOrder.id == order_id,
        PaymentOrder.company_id == current_user.company_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    apply_paid_order(db, order, trade_no="DEV-MANUAL")
    db.refresh(order)
    return _order_to_out(order)
