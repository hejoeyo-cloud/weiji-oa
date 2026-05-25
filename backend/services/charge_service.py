"""收费审批服务 — 退换/维修通用"""
from sqlalchemy.orm import Session
from database import User, RepairRecord, RepairChargeRequest, AfterSalesRecord, AfterSalesChargeRequest
from routers.approval_rules_router import evaluate_rules


def create_repair_charge_request(
    db: Session,
    record: RepairRecord,
    current_user: User,
    expected_amount: float,
    charge_note: str = "",
):
    """创建维修收费申请，并调用审批规则引擎匹配审批人"""
    # 调用规则引擎
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
    # 存储规则匹配的审批人（附加到备注里，供前端参考）
    if approver_ids:
        charge.charge_note = f"{charge_note}\n[审批引擎匹配: {','.join(approver_names or [str(x) for x in approver_ids])}]" if charge_note else f"[审批引擎匹配: {','.join(approver_names or [str(x) for x in approver_ids])}]"
    
    db.add(charge)
    db.commit()
    db.refresh(charge)
    
    # 更新维修记录的收费状态
    record.charge_required = True
    record.charge_status = "pending_charge"
    record.last_charge_request_id = charge.id
    db.commit()
    
    return charge


def create_aftersales_charge_request(
    db: Session,
    record: AfterSalesRecord,
    current_user: User,
    expected_amount: float,
    charge_note: str = "",
):
    """创建售后收费申请，并调用审批规则引擎匹配审批人"""
    field_values = {"amount": expected_amount}
    matched = evaluate_rules("return_exchange", field_values, db, current_user.company_id)
    
    approver_ids = []
    approver_names = []
    for m in matched:
        approver_ids.extend(m["approver_ids"])
        approver_names.extend(m["approver_names"])
    
    charge = AfterSalesChargeRequest(
        company_id=current_user.company_id,
        after_sales_record_id=record.id,
        expected_amount=expected_amount,
        charge_note=charge_note or "",
        created_by=current_user.id,
    )
    if approver_ids:
        charge.charge_note = f"{charge_note}\n[审批引擎匹配: {','.join(approver_names or [str(x) for x in approver_ids])}]" if charge_note else f"[审批引擎匹配: {','.join(approver_names or [str(x) for x in approver_ids])}]"
    
    db.add(charge)
    db.commit()
    db.refresh(charge)
    
    record.charge_required = True
    record.charge_status = "pending_charge"
    record.last_charge_request_id = charge.id
    db.commit()
    
    return charge
