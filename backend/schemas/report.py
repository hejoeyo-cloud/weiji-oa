from pydantic import BaseModel
from typing import List, Optional


class MonthValue(BaseModel):
    month: str
    value: float


class NameValue(BaseModel):
    name: str
    value: float


# ── 总览 ─────────────────────────────────────────────────────────

class OverviewCard(BaseModel):
    label: str
    value: float
    change: float = 0  # 同比上月百分比变化


class OverviewData(BaseModel):
    cards: List[OverviewCard] = []
    shipping_vs_return: List[dict] = []  # [{month, shipping_qty, return_qty, return_rate}]
    module_distribution: List[NameValue] = []


# ── 发货分析 ─────────────────────────────────────────────────────

class ProfitItem(BaseModel):
    month: str
    revenue: float = 0
    cost: float = 0
    gift_cost: float = 0
    cashback: float = 0
    shipping_fee: float = 0
    profit: float = 0


class ShippingData(BaseModel):
    qty_trend: List[MonthValue] = []
    amount_trend: List[dict] = []  # [{month, order_amount, cost, shipping_fee}]
    profit_trend: List[ProfitItem] = []
    top_products: List[NameValue] = []
    status_distribution: List[NameValue] = []


# ── 售后分析 ─────────────────────────────────────────────────────

class AftersalesData(BaseModel):
    return_exchange_trend: List[dict] = []  # [{month, return_count, exchange_count}]
    return_reasons: List[NameValue] = []
    repair_trend: List[MonthValue] = []
    repair_charge_rate: float = 0
    damage_count: int = 0
    damage_amount: float = 0
    status_distribution: List[NameValue] = []


# ── 财务分析 ─────────────────────────────────────────────────────

class FinanceData(BaseModel):
    income_expense_trend: List[dict] = []  # [{month, income, expense}]
    cashback_trend: List[MonthValue] = []
    cashback_reasons: List[NameValue] = []
    invoice_status: List[NameValue] = []
    invoice_type_amount: List[NameValue] = []


# ── 店铺分析 ─────────────────────────────────────────────────────

class ShopRankItem(BaseModel):
    shop_name: str
    shipping_qty: int = 0
    return_qty: int = 0
    return_rate: float = 0
    order_amount: float = 0
    repair_count: int = 0


class ShopData(BaseModel):
    shipping_rank: List[NameValue] = []
    return_rate_rank: List[NameValue] = []
    amount_rank: List[NameValue] = []
    detail_table: List[ShopRankItem] = []
