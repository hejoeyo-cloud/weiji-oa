from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class CustomerInvoiceRequestCreate(BaseModel):
    apply_date: str = ""
    order_no: str = ""
    shop_name: str = ""
    customer_name: str = ""
    tax_id: str = ""
    register_address: str = ""
    bank_account: str = ""
    invoice_type: str = "普通发票"
    invoice_content: str = ""
    amount: float = 0
    tax_rate: float = 0.03
    tax_amount: float = 0
    email: str = ""
    mail_address: str = ""
    status: str = "pending"
    remark: str = ""
    handler: str = ""
    sales_invoice_id: Optional[int] = None

class CustomerInvoiceRequestUpdate(BaseModel):
    apply_date: Optional[str] = None
    order_no: Optional[str] = None
    shop_name: Optional[str] = None
    customer_name: Optional[str] = None
    tax_id: Optional[str] = None
    register_address: Optional[str] = None
    bank_account: Optional[str] = None
    invoice_type: Optional[str] = None
    invoice_content: Optional[str] = None
    amount: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    email: Optional[str] = None
    mail_address: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    handler: Optional[str] = None
    sales_invoice_id: Optional[int] = None
    invoice_file: Optional[str] = None
    invoice_filename: Optional[str] = None

class CustomerInvoiceRequestOut(BaseModel):
    id: int
    apply_date: str = ""
    order_no: str = ""
    shop_name: str = ""
    customer_name: str = ""
    tax_id: str = ""
    register_address: str = ""
    bank_account: str = ""
    invoice_type: str = ""
    invoice_content: str = ""
    amount: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    email: str = ""
    mail_address: str = ""
    status: str = ""
    remark: str = ""
    handler: str = ""
    sales_invoice_id: Optional[int] = None
    invoice_file: str = ""
    invoice_filename: str = ""
    created_by: int
    created_by_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# 销项发票台账

class SalesInvoiceCreate(BaseModel):
    invoice_date: str = ""
    invoice_code: str = ""
    invoice_no: str = ""
    invoice_type: str = "普通发票"
    buyer_name: str = ""
    buyer_tax_id: str = ""
    invoice_content: str = ""
    amount: float = 0
    tax_rate: float = 0.03
    tax_amount: float = 0
    total_amount: float = 0
    order_no: str = ""
    shop_name: str = ""
    handler: str = ""
    remark: str = ""

class SalesInvoiceUpdate(BaseModel):
    invoice_date: Optional[str] = None
    invoice_code: Optional[str] = None
    invoice_no: Optional[str] = None
    invoice_type: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_tax_id: Optional[str] = None
    invoice_content: Optional[str] = None
    amount: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    order_no: Optional[str] = None
    shop_name: Optional[str] = None
    handler: Optional[str] = None
    remark: Optional[str] = None

class SalesInvoiceOut(BaseModel):
    id: int
    invoice_date: str = ""
    invoice_code: str = ""
    invoice_no: str = ""
    invoice_type: str = ""
    buyer_name: str = ""
    buyer_tax_id: str = ""
    invoice_content: str = ""
    amount: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    total_amount: float = 0
    order_no: str = ""
    shop_name: str = ""
    handler: str = ""
    remark: str = ""
    created_by: int
    created_by_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# 进项发票台账

class PurchaseInvoiceCreate(BaseModel):
    receive_date: str = ""
    invoice_date: str = ""
    invoice_code: str = ""
    invoice_no: str = ""
    invoice_type: str = "专用发票"
    seller_name: str = ""
    seller_tax_id: str = ""
    invoice_content: str = ""
    amount: float = 0
    tax_rate: float = 0.13
    tax_amount: float = 0
    total_amount: float = 0
    is_certified: bool = False
    certified_date: str = ""
    certification_result: str = ""
    due_date: str = ""
    related_contract: str = ""
    receiver: str = ""
    remark: str = ""

class PurchaseInvoiceUpdate(BaseModel):
    receive_date: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_code: Optional[str] = None
    invoice_no: Optional[str] = None
    invoice_type: Optional[str] = None
    seller_name: Optional[str] = None
    seller_tax_id: Optional[str] = None
    invoice_content: Optional[str] = None
    amount: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    is_certified: Optional[bool] = None
    certified_date: Optional[str] = None
    certification_result: Optional[str] = None
    due_date: Optional[str] = None
    related_contract: Optional[str] = None
    receiver: Optional[str] = None
    remark: Optional[str] = None

class PurchaseInvoiceOut(BaseModel):
    id: int
    receive_date: str = ""
    invoice_date: str = ""
    invoice_code: str = ""
    invoice_no: str = ""
    invoice_type: str = ""
    seller_name: str = ""
    seller_tax_id: str = ""
    invoice_content: str = ""
    amount: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    total_amount: float = 0
    is_certified: bool = False
    certified_date: str = ""
    certification_result: str = ""
    due_date: str = ""
    related_contract: str = ""
    receiver: str = ""
    remark: str = ""
    created_by: int
    created_by_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# 报销发票台账

class ExpenseInvoiceCreate(BaseModel):
    invoice_no: str = ""
    invoice_date: str = ""
    invoice_type: str = "普通发票"
    seller_name: str = ""
    summary: str = ""
    amount: float = 0
    tax_rate: float = 0.03
    tax_amount: float = 0
    reimbursement_amount: float = 0
    reimbursement_date: str = ""
    reimburser: str = ""
    department: str = ""
    is_paid: bool = False
    approval_id: Optional[int] = None
    remark: str = ""

class ExpenseInvoiceUpdate(BaseModel):
    invoice_no: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_type: Optional[str] = None
    seller_name: Optional[str] = None
    summary: Optional[str] = None
    amount: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    reimbursement_amount: Optional[float] = None
    reimbursement_date: Optional[str] = None
    reimburser: Optional[str] = None
    department: Optional[str] = None
    is_paid: Optional[bool] = None
    approval_id: Optional[int] = None
    remark: Optional[str] = None

class ExpenseInvoiceOut(BaseModel):
    id: int
    invoice_no: str = ""
    invoice_date: str = ""
    invoice_type: str = ""
    seller_name: str = ""
    summary: str = ""
    amount: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    reimbursement_amount: float = 0
    reimbursement_date: str = ""
    reimburser: str = ""
    department: str = ""
    is_paid: bool = False
    is_duplicate: bool = False
    approval_id: Optional[int] = None
    remark: str = ""
    created_by: int
    created_by_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 考勤打卡 ─────────────────────────────────────────────────────────
