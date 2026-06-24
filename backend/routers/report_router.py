from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from database import (
    get_db, User, Ticket, AfterSalesRecord, ReturnExchangeRecord,
    RepairRecord, GiftRecord, GiftCashback, GiftResendRecord,
    AttendanceRecord, TaskBoard, SalesInvoice, PurchaseInvoice,
    ExpenseInvoice, CustomerInvoiceRequest,
)
from schemas.dashboard import DashboardStatsOut, TicketTrendItem, ModuleDistributionItem
from schemas.report import (
    OverviewData, OverviewCard, ShippingData, ProfitItem,
    AftersalesData, FinanceData, ShopData, ShopRankItem,
    MonthValue, NameValue,
)
from auth import get_current_user, require_permission

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _month_range(year: int, month: int) -> tuple[str, str]:
    start = f"{year}-{month:02d}-01"
    if month == 12:
        end = f"{year + 1}-01-01"
    else:
        end = f"{year}-{month + 1:02d}-01"
    return start, end


def _year_range(year: int) -> tuple[str, str]:
    return f"{year}-01-01", f"{year + 1}-01-01"


def _safe_div(a, b):
    return round(a / b * 100, 2) if b else 0


# ── 旧接口（兼容）──────────────────────────────────────────────

@router.get("/dashboard-stats", response_model=DashboardStatsOut)
def get_dashboard_stats(
    current_user: User = Depends(require_permission("reports:view")),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    ticket_trend = []
    now = datetime.now()
    for i in range(11, -1, -1):
        target = now.replace(day=1)
        for _ in range(i):
            target = (target - timedelta(days=1)).replace(day=1)
        next_month = (target.replace(day=28) + timedelta(days=4)).replace(day=1)
        count = db.query(func.count(Ticket.id)).filter(
            Ticket.company_id == company_id,
            Ticket.created_at >= target, Ticket.created_at < next_month,
        ).scalar() or 0
        ticket_trend.append(TicketTrendItem(month=target.strftime("%Y-%m"), count=count))

    module_distribution = [
        ModuleDistributionItem(name="工单", count=db.query(func.count(Ticket.id)).filter(Ticket.company_id == company_id).scalar() or 0),
        ModuleDistributionItem(name="退换", count=db.query(func.count(ReturnExchangeRecord.id)).filter(ReturnExchangeRecord.company_id == company_id).scalar() or 0),
        ModuleDistributionItem(name="维修", count=db.query(func.count(RepairRecord.id)).filter(RepairRecord.company_id == company_id).scalar() or 0),
        ModuleDistributionItem(name="发货", count=db.query(func.count(GiftRecord.id)).filter(GiftRecord.company_id == company_id).scalar() or 0),
        ModuleDistributionItem(name="补发", count=db.query(func.count(GiftResendRecord.id)).filter(GiftResendRecord.company_id == company_id).scalar() or 0),
    ]
    module_distribution = [m for m in module_distribution if m.count > 0]

    statuses = ["pending", "processing", "completed"]
    status_labels = {"pending": "待处理", "processing": "处理中", "completed": "已完成"}
    ticket_status_distribution = []
    for s in statuses:
        count = db.query(func.count(Ticket.id)).filter(Ticket.company_id == company_id, Ticket.status == s).scalar() or 0
        ticket_status_distribution.append(ModuleDistributionItem(name=status_labels[s], count=count))

    today = datetime.now().strftime("%Y-%m-%d")
    today_attendance = db.query(func.count(AttendanceRecord.id)).filter(
        AttendanceRecord.company_id == company_id, AttendanceRecord.date == today,
    ).scalar() or 0
    total_tasks = db.query(func.count(TaskBoard.id)).filter(TaskBoard.company_id == company_id).scalar() or 0
    pending_tasks = db.query(func.count(TaskBoard.id)).filter(
        TaskBoard.company_id == company_id, TaskBoard.status.in_(["todo", "in_progress"]),
    ).scalar() or 0

    return DashboardStatsOut(
        ticket_trend=ticket_trend, module_distribution=module_distribution,
        ticket_status_distribution=ticket_status_distribution,
        today_attendance=today_attendance, total_tasks=total_tasks, pending_tasks=pending_tasks,
    )


# ── 总览 ─────────────────────────────────────────────────────────

@router.get("/overview", response_model=OverviewData)
def get_report_overview(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    current_user: User = Depends(require_permission("reports:view")),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    start, end = _month_range(year, month) if month else _year_range(year)

    # 上一期
    if month:
        if month == 1:
            prev_start, prev_end = _month_range(year - 1, 12)
        else:
            prev_start, prev_end = _month_range(year, month - 1)
    else:
        prev_start, prev_end = _year_range(year - 1)

    # 发货量
    ship_qty = db.query(func.sum(GiftRecord.quantity)).filter(
        GiftRecord.company_id == cid, GiftRecord.date >= start, GiftRecord.date < end,
    ).scalar() or 0
    prev_ship = db.query(func.sum(GiftRecord.quantity)).filter(
        GiftRecord.company_id == cid, GiftRecord.date >= prev_start, GiftRecord.date < prev_end,
    ).scalar() or 0

    # 退货量（仅退货）
    ret_qty = db.query(func.sum(ReturnExchangeRecord.quantity)).filter(
        ReturnExchangeRecord.company_id == cid, ReturnExchangeRecord.record_type == "return",
        ReturnExchangeRecord.apply_date >= start, ReturnExchangeRecord.apply_date < end,
    ).scalar() or 0
    prev_ret = db.query(func.sum(ReturnExchangeRecord.quantity)).filter(
        ReturnExchangeRecord.company_id == cid, ReturnExchangeRecord.record_type == "return",
        ReturnExchangeRecord.apply_date >= prev_start, ReturnExchangeRecord.apply_date < prev_end,
    ).scalar() or 0

    # 退货率
    ret_rate = _safe_div(ret_qty, ship_qty)
    prev_ret_rate = _safe_div(prev_ret, prev_ship)

    # 销售额
    sales = db.query(func.sum(GiftRecord.order_amount)).filter(
        GiftRecord.company_id == cid, GiftRecord.date >= start, GiftRecord.date < end,
    ).scalar() or 0
    prev_sales = db.query(func.sum(GiftRecord.order_amount)).filter(
        GiftRecord.company_id == cid, GiftRecord.date >= prev_start, GiftRecord.date < prev_end,
    ).scalar() or 0

    def _change(cur, prev):
        return round((cur - prev) / prev * 100, 1) if prev else (100 if cur else 0)

    cards = [
        OverviewCard(label="发货量", value=ship_qty, change=_change(ship_qty, prev_ship)),
        OverviewCard(label="退货量", value=ret_qty, change=_change(ret_qty, prev_ret)),
        OverviewCard(label="退货率", value=ret_rate, change=round(ret_rate - prev_ret_rate, 2)),
        OverviewCard(label="销售额", value=round(sales, 2), change=_change(sales, prev_sales)),
    ]

    # 发货量 vs 退货率月度对比
    shipping_vs_return = []
    for m in range(1, 13):
        ms, me = _month_range(year, m)
        sq = db.query(func.sum(GiftRecord.quantity)).filter(
            GiftRecord.company_id == cid, GiftRecord.date >= ms, GiftRecord.date < me,
        ).scalar() or 0
        rq = db.query(func.sum(ReturnExchangeRecord.quantity)).filter(
            ReturnExchangeRecord.company_id == cid, ReturnExchangeRecord.record_type == "return",
            ReturnExchangeRecord.apply_date >= ms, ReturnExchangeRecord.apply_date < me,
        ).scalar() or 0
        shipping_vs_return.append({
            "month": f"{m}月",
            "shipping_qty": sq,
            "return_qty": rq,
            "return_rate": _safe_div(rq, sq),
        })

    # 模块分布
    md_start, md_end = start, end
    module_distribution = [
        NameValue(name="发货", value=db.query(func.count(GiftRecord.id)).filter(GiftRecord.company_id == cid, GiftRecord.date >= md_start, GiftRecord.date < md_end).scalar() or 0),
        NameValue(name="退换", value=db.query(func.count(ReturnExchangeRecord.id)).filter(ReturnExchangeRecord.company_id == cid, ReturnExchangeRecord.apply_date >= md_start, ReturnExchangeRecord.apply_date < md_end).scalar() or 0),
        NameValue(name="维修", value=db.query(func.count(RepairRecord.id)).filter(RepairRecord.company_id == cid, RepairRecord.apply_date >= md_start, RepairRecord.apply_date < md_end).scalar() or 0),
        NameValue(name="补发", value=db.query(func.count(GiftResendRecord.id)).filter(GiftResendRecord.company_id == cid, GiftResendRecord.apply_date >= md_start, GiftResendRecord.apply_date < md_end).scalar() or 0),
        NameValue(name="返现", value=db.query(func.count(GiftCashback.id)).filter(GiftCashback.company_id == cid, GiftCashback.created_at >= md_start, GiftCashback.created_at < md_end).scalar() or 0),
    ]
    module_distribution = [m for m in module_distribution if m.value > 0]

    return OverviewData(cards=cards, shipping_vs_return=shipping_vs_return, module_distribution=module_distribution)


# ── 发货分析 ─────────────────────────────────────────────────────

@router.get("/shipping", response_model=ShippingData)
def get_report_shipping(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    current_user: User = Depends(require_permission("reports:view")),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id

    # 排除已撕单/已取消/拦截快递/已退货
    _valid = GiftRecord.status.notin_(["intercepted", "torn", "cancelled", "returned"])

    if month:
        # 单月：按天统计
        start, end = _month_range(year, month)
        days_in_month = (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(start, "%Y-%m-%d")).days
        qty_trend = []
        for d in range(1, days_in_month + 1):
            ds = f"{year}-{month:02d}-{d:02d}"
            de = f"{year}-{month:02d}-{d + 1:02d}" if d < days_in_month else end
            v = db.query(func.sum(GiftRecord.quantity)).filter(
                GiftRecord.company_id == cid, _valid, GiftRecord.date >= ds, GiftRecord.date < de,
            ).scalar() or 0
            qty_trend.append(MonthValue(month=f"{d}日", value=v))
    else:
        # 全年：按月统计
        qty_trend = []
        for m in range(1, 13):
            ms, me = _month_range(year, m)
            v = db.query(func.sum(GiftRecord.quantity)).filter(
                GiftRecord.company_id == cid, _valid, GiftRecord.date >= ms, GiftRecord.date < me,
            ).scalar() or 0
            qty_trend.append(MonthValue(month=f"{m}月", value=v))

    # 金额趋势
    amount_trend = []
    for m in range(1, 13):
        ms, me = _month_range(year, m)
        oa = db.query(func.sum(GiftRecord.order_amount)).filter(GiftRecord.company_id == cid, _valid, GiftRecord.date >= ms, GiftRecord.date < me).scalar() or 0
        co = db.query(func.sum(GiftRecord.cost)).filter(GiftRecord.company_id == cid, _valid, GiftRecord.date >= ms, GiftRecord.date < me).scalar() or 0
        sf = db.query(func.sum(GiftRecord.shipping_fee)).filter(GiftRecord.company_id == cid, _valid, GiftRecord.date >= ms, GiftRecord.date < me).scalar() or 0
        amount_trend.append({"month": f"{m}月", "order_amount": round(oa, 2), "cost": round(co, 2), "shipping_fee": round(sf, 2)})

    # 利润趋势
    profit_trend = []
    for m in range(1, 13):
        ms, me = _month_range(year, m)
        oa = db.query(func.sum(GiftRecord.order_amount)).filter(GiftRecord.company_id == cid, _valid, GiftRecord.date >= ms, GiftRecord.date < me).scalar() or 0
        co = db.query(func.sum(GiftRecord.cost)).filter(GiftRecord.company_id == cid, _valid, GiftRecord.date >= ms, GiftRecord.date < me).scalar() or 0
        sf = db.query(func.sum(GiftRecord.shipping_fee)).filter(GiftRecord.company_id == cid, _valid, GiftRecord.date >= ms, GiftRecord.date < me).scalar() or 0
        cb = db.query(func.sum(GiftCashback.cashback_amount)).filter(GiftCashback.company_id == cid, GiftCashback.created_at >= ms, GiftCashback.created_at < me).scalar() or 0
        gc = 0
        records = db.query(GiftRecord.gift_costs).filter(GiftRecord.company_id == cid, _valid, GiftRecord.date >= ms, GiftRecord.date < me).all()
        for (costs_json,) in records:
            if costs_json:
                for item in costs_json:
                    gc += item.get("amount", 0) if isinstance(item, dict) else 0
        profit = oa - co - gc - cb - sf
        profit_trend.append(ProfitItem(
            month=f"{m}月", revenue=round(oa, 2), cost=round(co, 2),
            gift_cost=round(gc, 2), cashback=round(cb, 2),
            shipping_fee=round(sf, 2), profit=round(profit, 2),
        ))

    # 热销配置 Top 10
    start, end = _year_range(year)
    if month:
        start, end = _month_range(year, month)
    top_config_rows = db.query(GiftRecord.config, func.sum(GiftRecord.quantity)).filter(
        GiftRecord.company_id == cid, _valid, GiftRecord.date >= start, GiftRecord.date < end,
        GiftRecord.config != "",
    ).group_by(GiftRecord.config).order_by(func.sum(GiftRecord.quantity).desc()).limit(10).all()
    top_configs = [NameValue(name=r[0], value=r[1]) for r in top_config_rows]

    # 热销型号 Top 10
    top_model_rows = db.query(GiftRecord.model, func.sum(GiftRecord.quantity)).filter(
        GiftRecord.company_id == cid, _valid, GiftRecord.date >= start, GiftRecord.date < end,
        GiftRecord.model != "",
    ).group_by(GiftRecord.model).order_by(func.sum(GiftRecord.quantity).desc()).limit(10).all()
    top_models = [NameValue(name=r[0], value=r[1]) for r in top_model_rows]

    # 客户颜色偏好
    color_rows = db.query(GiftRecord.color, func.sum(GiftRecord.quantity)).filter(
        GiftRecord.company_id == cid, _valid, GiftRecord.date >= start, GiftRecord.date < end,
        GiftRecord.color != "",
    ).group_by(GiftRecord.color).order_by(func.sum(GiftRecord.quantity).desc()).all()
    color_preference = [NameValue(name=r[0], value=r[1]) for r in color_rows]

    return ShippingData(
        qty_trend=qty_trend, amount_trend=amount_trend,
        profit_trend=profit_trend, top_configs=top_configs,
        top_models=top_models, color_preference=color_preference,
    )


# ── 售后分析 ─────────────────────────────────────────────────────

@router.get("/aftersales", response_model=AftersalesData)
def get_report_aftersales(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    current_user: User = Depends(require_permission("reports:view")),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id

    # 退货 vs 换货月度趋势
    re_trend = []
    for m in range(1, 13):
        ms, me = _month_range(year, m)
        rc = db.query(func.count(ReturnExchangeRecord.id)).filter(
            ReturnExchangeRecord.company_id == cid, ReturnExchangeRecord.record_type == "return",
            ReturnExchangeRecord.apply_date >= ms, ReturnExchangeRecord.apply_date < me,
        ).scalar() or 0
        ec = db.query(func.count(ReturnExchangeRecord.id)).filter(
            ReturnExchangeRecord.company_id == cid, ReturnExchangeRecord.record_type == "exchange",
            ReturnExchangeRecord.apply_date >= ms, ReturnExchangeRecord.apply_date < me,
        ).scalar() or 0
        re_trend.append({"month": f"{m}月", "return_count": rc, "exchange_count": ec})

    # 退货原因 Top 10
    start, end = _month_range(year, month) if month else _year_range(year)
    reason_rows = db.query(ReturnExchangeRecord.return_reason, func.count(ReturnExchangeRecord.id)).filter(
        ReturnExchangeRecord.company_id == cid, ReturnExchangeRecord.record_type == "return",
        ReturnExchangeRecord.apply_date >= start, ReturnExchangeRecord.apply_date < end,
        ReturnExchangeRecord.return_reason != "",
    ).group_by(ReturnExchangeRecord.return_reason).order_by(func.count(ReturnExchangeRecord.id).desc()).limit(10).all()
    return_reasons = [NameValue(name=r[0][:20], value=r[1]) for r in reason_rows]

    # 维修趋势
    repair_trend = []
    for m in range(1, 13):
        ms, me = _month_range(year, m)
        v = db.query(func.count(RepairRecord.id)).filter(
            RepairRecord.company_id == cid, RepairRecord.apply_date >= ms, RepairRecord.apply_date < me,
        ).scalar() or 0
        repair_trend.append(MonthValue(month=f"{m}月", value=v))

    # 维修收费率
    total_repair = db.query(func.count(RepairRecord.id)).filter(
        RepairRecord.company_id == cid, RepairRecord.apply_date >= start, RepairRecord.apply_date < end,
    ).scalar() or 0
    charge_repair = db.query(func.count(RepairRecord.id)).filter(
        RepairRecord.company_id == cid, RepairRecord.charge_required == True,
        RepairRecord.apply_date >= start, RepairRecord.apply_date < end,
    ).scalar() or 0
    repair_charge_rate = _safe_div(charge_repair, total_repair)

    # 货损统计
    damage_count = db.query(func.count(ReturnExchangeRecord.id)).filter(
        ReturnExchangeRecord.company_id == cid, ReturnExchangeRecord.has_damage == True,
        ReturnExchangeRecord.apply_date >= start, ReturnExchangeRecord.apply_date < end,
    ).scalar() or 0
    damage_records = db.query(ReturnExchangeRecord.damage_items).filter(
        ReturnExchangeRecord.company_id == cid, ReturnExchangeRecord.has_damage == True,
        ReturnExchangeRecord.apply_date >= start, ReturnExchangeRecord.apply_date < end,
    ).all()
    damage_amount = 0
    for (items,) in damage_records:
        if items:
            for item in items:
                damage_amount += item.get("amount", 0) if isinstance(item, dict) else 0

    # 售后状态分布
    status_rows = db.query(ReturnExchangeRecord.progress, func.count(ReturnExchangeRecord.id)).filter(
        ReturnExchangeRecord.company_id == cid,
        ReturnExchangeRecord.apply_date >= start, ReturnExchangeRecord.apply_date < end,
    ).group_by(ReturnExchangeRecord.progress).all()
    status_labels = {"pending": "待处理", "processing": "处理中", "completed": "已完成"}
    status_distribution = [NameValue(name=status_labels.get(r[0], r[0]), value=r[1]) for r in status_rows]

    return AftersalesData(
        return_exchange_trend=re_trend, return_reasons=return_reasons,
        repair_trend=repair_trend, repair_charge_rate=repair_charge_rate,
        damage_count=damage_count, damage_amount=round(damage_amount, 2),
        status_distribution=status_distribution,
    )


# ── 财务分析 ─────────────────────────────────────────────────────

@router.get("/finance", response_model=FinanceData)
def get_report_finance(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    current_user: User = Depends(require_permission("reports:view")),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id

    # 收入 vs 支出月度趋势
    ie_trend = []
    for m in range(1, 13):
        ms, me = _month_range(year, m)
        income = db.query(func.sum(SalesInvoice.total_amount)).filter(
            SalesInvoice.company_id == cid, SalesInvoice.invoice_date >= ms, SalesInvoice.invoice_date < me,
        ).scalar() or 0
        purchase = db.query(func.sum(PurchaseInvoice.total_amount)).filter(
            PurchaseInvoice.company_id == cid, PurchaseInvoice.invoice_date >= ms, PurchaseInvoice.invoice_date < me,
        ).scalar() or 0
        expense = db.query(func.sum(ExpenseInvoice.reimbursement_amount)).filter(
            ExpenseInvoice.company_id == cid, ExpenseInvoice.invoice_date >= ms, ExpenseInvoice.invoice_date < me,
        ).scalar() or 0
        ie_trend.append({"month": f"{m}月", "income": round(income, 2), "expense": round(purchase + expense, 2)})

    # 返现趋势
    cb_trend = []
    for m in range(1, 13):
        ms, me = _month_range(year, m)
        v = db.query(func.sum(GiftCashback.cashback_amount)).filter(
            GiftCashback.company_id == cid, GiftCashback.created_at >= ms, GiftCashback.created_at < me,
        ).scalar() or 0
        cb_trend.append(MonthValue(month=f"{m}月", value=round(v, 2)))

    # 返现原因分布
    start, end = _month_range(year, month) if month else _year_range(year)
    cb_reason_rows = db.query(GiftCashback.reason, func.sum(GiftCashback.cashback_amount)).filter(
        GiftCashback.company_id == cid, GiftCashback.created_at >= start, GiftCashback.created_at < end,
        GiftCashback.reason != "",
    ).group_by(GiftCashback.reason).order_by(func.sum(GiftCashback.cashback_amount).desc()).limit(10).all()
    cashback_reasons = [NameValue(name=r[0][:20], value=round(r[1], 2)) for r in cb_reason_rows]

    # 开票申请状态分布
    inv_status_rows = db.query(CustomerInvoiceRequest.status, func.count(CustomerInvoiceRequest.id)).filter(
        CustomerInvoiceRequest.company_id == cid,
    ).group_by(CustomerInvoiceRequest.status).all()
    inv_status_labels = {
        "pending": "待处理", "processing": "开票中", "issued": "已开具",
        "mailed": "已邮寄", "signed": "已签收", "voided": "已作废",
    }
    invoice_status = [NameValue(name=inv_status_labels.get(r[0], r[0]), value=r[1]) for r in inv_status_rows]

    # 发票类型金额对比
    sales_total = db.query(func.sum(SalesInvoice.total_amount)).filter(SalesInvoice.company_id == cid).scalar() or 0
    purchase_total = db.query(func.sum(PurchaseInvoice.total_amount)).filter(PurchaseInvoice.company_id == cid).scalar() or 0
    expense_total = db.query(func.sum(ExpenseInvoice.reimbursement_amount)).filter(ExpenseInvoice.company_id == cid).scalar() or 0
    invoice_type_amount = [
        NameValue(name="销项票", value=round(sales_total, 2)),
        NameValue(name="进项票", value=round(purchase_total, 2)),
        NameValue(name="费用票", value=round(expense_total, 2)),
    ]

    return FinanceData(
        income_expense_trend=ie_trend, cashback_trend=cb_trend,
        cashback_reasons=cashback_reasons, invoice_status=invoice_status,
        invoice_type_amount=invoice_type_amount,
    )


# ── 店铺分析 ─────────────────────────────────────────────────────

@router.get("/shop", response_model=ShopData)
def get_report_shop(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    current_user: User = Depends(require_permission("reports:view")),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    start, end = _month_range(year, month) if month else _year_range(year)

    # 发货量排名
    ship_rows = db.query(GiftRecord.shop_name, func.sum(GiftRecord.quantity)).filter(
        GiftRecord.company_id == cid, GiftRecord.date >= start, GiftRecord.date < end,
        GiftRecord.shop_name != "",
    ).group_by(GiftRecord.shop_name).order_by(func.sum(GiftRecord.quantity).desc()).all()
    shipping_rank = [NameValue(name=r[0], value=r[1]) for r in ship_rows]

    # 退货量按店铺
    ret_rows = db.query(ReturnExchangeRecord.shop_name, func.sum(ReturnExchangeRecord.quantity)).filter(
        ReturnExchangeRecord.company_id == cid, ReturnExchangeRecord.record_type == "return",
        ReturnExchangeRecord.apply_date >= start, ReturnExchangeRecord.apply_date < end,
        ReturnExchangeRecord.shop_name != "",
    ).group_by(ReturnExchangeRecord.shop_name).all()
    ret_map = {r[0]: r[1] for r in ret_rows}

    # 退货率排名
    ship_map = {r[0]: r[1] for r in ship_rows}
    return_rate_list = []
    for shop, ship_q in ship_map.items():
        ret_q = ret_map.get(shop, 0)
        return_rate_list.append({"shop": shop, "rate": _safe_div(ret_q, ship_q)})
    return_rate_list.sort(key=lambda x: x["rate"], reverse=True)
    return_rate_rank = [NameValue(name=x["shop"], value=x["rate"]) for x in return_rate_list]

    # 销售额排名
    amt_rows = db.query(GiftRecord.shop_name, func.sum(GiftRecord.order_amount)).filter(
        GiftRecord.company_id == cid, GiftRecord.date >= start, GiftRecord.date < end,
        GiftRecord.shop_name != "",
    ).group_by(GiftRecord.shop_name).order_by(func.sum(GiftRecord.order_amount).desc()).all()
    amount_rank = [NameValue(name=r[0], value=round(r[1], 2)) for r in amt_rows]

    # 维修量按店铺
    repair_rows = db.query(RepairRecord.shop_name, func.count(RepairRecord.id)).filter(
        RepairRecord.company_id == cid, RepairRecord.apply_date >= start, RepairRecord.apply_date < end,
        RepairRecord.shop_name != "",
    ).group_by(RepairRecord.shop_name).all()
    repair_map = {r[0]: r[1] for r in repair_rows}

    # 详情表格
    all_shops = set(ship_map.keys()) | set(ret_map.keys()) | set(repair_map.keys())
    detail_table = []
    for shop in all_shops:
        sq = ship_map.get(shop, 0)
        rq = ret_map.get(shop, 0)
        oa = 0
        for r in amt_rows:
            if r[0] == shop:
                oa = r[1]
                break
        detail_table.append(ShopRankItem(
            shop_name=shop, shipping_qty=sq, return_qty=rq,
            return_rate=_safe_div(rq, sq), order_amount=round(oa, 2),
            repair_count=repair_map.get(shop, 0),
        ))
    detail_table.sort(key=lambda x: x.shipping_qty, reverse=True)

    return ShopData(
        shipping_rank=shipping_rank, return_rate_rank=return_rate_rank,
        amount_rank=amount_rank, detail_table=detail_table,
    )
