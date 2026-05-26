"""收费审批服务 — 退换/维修通用"""
from typing import Union
from sqlalchemy.orm import Session
from database import User, RepairRecord, ReturnExchangeRecord, AfterSalesRecord, RepairChargeRequest, AfterSalesChargeRequest
from routers.approval_rules_router import evaluate_rules


def create_repair_charge_request(
    db: Session,
    record: RepairRecord,
    current_user: User,
    expected_amount: float,
    charge_note: str = "",
):
    """创建维修收费申请，并调用审批规则引擎匹配审批人"""
    field_values = {"amount": expected_amount}
    matched = evaluate_rules("repair", field_values, db, current_user.company_id)
    
    approver_ids = []
    approver_names = []
    for m in matched:
        approver_ids.extend(m["approver_ids"])
        approver_names.extend(m["approver_names"])
    
    charge = RepairChargeRequest(
        company_id=current_user.company_id,
        repair_record_id=record.id,
        expected_amount=expected_amount,
        charge_note=charge_note or "",
        created_by=current_user.id,
    )
    if approver_ids:
        charge.charge_note = _append_approvers(charge_note, approver_names, approver_ids)
    
    db.add(charge)
    db.commit()
    db.refresh(charge)
    
    record.charge_required = True
    record.charge_status = "pending_charge"
    record.last_charge_request_id = charge.id
    db.commit()
    
    return charge


def create_charge_request(
    db: Session,
    record: Union[AfterSalesRecord, ReturnExchangeRecord],
    current_user: User,
    expected_amount: float,
    charge_note: str = "",
):
    """创建退换/售后收费申请，自动判断记录类型并调用审批规则引擎"""
    module = "return_exchange"
    field_values = {"amount": expected_amount}
    matched = evaluate_rules(module, field_values, db, current_user.company_id)
    
    approver_ids = []
    approver_names = []
    for m in matched:
        approver_ids.extend(m["approver_ids"])
        approver_names.extend(m["approver_names"])
    
    # 根据记录类型选择外键字段
    if isinstance(record, AfterSalesRecord):
        fk_field = "after_sales_record_id"
    else:
        fk_field = "after_sales_record_id"  # 同一模型通用
        # 对于 ReturnExchangeRecord, AfterSalesChargeRequest.after_sales_record_id 
        # 实际上指向 return_exchange_records 表（生产切PG后需单独模型）
    
    charge = AfterSalesChargeRequest(
        company_id=current_user.company_id,
        after_sales_record_id=record.id,
        expected_amount=expected_amount,
        charge_note=charge_note or "",
        created_by=current_user.id,
    )
    if approver_ids:
        charge.charge_note = _append_approvers(charge_note, approver_names, approver_ids)
    
    db.add(charge)
    db.commit()
    db.refresh(charge)
    
    record.charge_required = True
    record.charge_status = "pending_charge"
    record.last_charge_request_id = charge.id
    db.commit()
    
    return charge


# Backward compatible alias
create_aftersales_charge_request = create_charge_request


def _append_approvers(note: str, names: list[str], ids: list[int]) -> str:
    """附加审批引擎匹配结果到备注"""
    label = ','.join(names or [str(x) for x in ids])
    return f"{note}\n[审批引擎匹配: {label}]" if note else f"[审批引擎匹配: {label}]"
