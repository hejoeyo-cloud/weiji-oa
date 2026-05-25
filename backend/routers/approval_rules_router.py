"""审批规则 — 支持条件分支 + 会签/或签"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from database import get_db, User, ApprovalRule
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api/approval-rules", tags=["approval_rules"])

class ApprovalRuleOut(BaseModel):
    id: int; name: str; target_module: str; condition_field: str = ""
    condition_op: str = ""; condition_value: str = ""; sign_mode: str = "or"
    approver_ids: str = ""; approver_names: str = ""; enabled: bool = True
    sort_order: int = 0
    class Config: from_attributes = True

class ApprovalRuleIn(BaseModel):
    name: str; target_module: str; condition_field: str = ""
    condition_op: str = ""; condition_value: str = ""; sign_mode: str = "or"
    approver_ids: str = ""; enabled: bool = True; sort_order: int = 0


@router.get("", response_model=List[ApprovalRuleOut])
def list_rules(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ApprovalRule).filter(
        ApprovalRule.company_id == current_user.company_id
    ).order_by(ApprovalRule.sort_order).all()


@router.post("", response_model=ApprovalRuleOut)
def create_rule(req: ApprovalRuleIn, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    rule = ApprovalRule(company_id=current_user.company_id, **req.model_dump())
    db.add(rule); db.commit(); db.refresh(rule)
    return rule


@router.put("/{rule_id}", response_model=ApprovalRuleOut)
def update_rule(rule_id: int, req: ApprovalRuleIn, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    rule = db.query(ApprovalRule).filter(ApprovalRule.id == rule_id, ApprovalRule.company_id == current_user.company_id).first()
    if not rule: raise HTTPException(404)
    for k, v in req.model_dump().items():
        setattr(rule, k, v)
    db.commit(); db.refresh(rule)
    return rule


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    rule = db.query(ApprovalRule).filter(ApprovalRule.id == rule_id, ApprovalRule.company_id == current_user.company_id).first()
    if not rule: raise HTTPException(404)
    db.delete(rule); db.commit()
    return {"ok": True}


def evaluate_rules(module: str, field_values: dict, db: Session, company_id: int) -> list[dict]:
    """根据模块和数据字段值，返回匹配的审批人列表"""
    rules = db.query(ApprovalRule).filter(
        ApprovalRule.company_id == company_id,
        ApprovalRule.target_module == module,
        ApprovalRule.enabled == True,
    ).order_by(ApprovalRule.sort_order).all()

    matched = []
    for rule in rules:
        if _match_condition(rule, field_values):
            ids = [int(x.strip()) for x in rule.approver_ids.split(",") if x.strip()]
            names = rule.approver_names.split(",") if rule.approver_names else [str(x) for x in ids]
            matched.append({
                "rule_id": rule.id,
                "approver_ids": ids,
                "approver_names": names,
                "sign_mode": rule.sign_mode,
            })
    return matched


def _match_condition(rule: ApprovalRule, values: dict) -> bool:
    if not rule.condition_field:
        return True
    val = values.get(rule.condition_field)
    if val is None:
        return False
    cv = rule.condition_value
    op = rule.condition_op
    if op == "gt": return float(val) > float(cv)
    if op == "gte": return float(val) >= float(cv)
    if op == "lt": return float(val) < float(cv)
    if op == "lte": return float(val) <= float(cv)
    if op == "eq": return str(val) == cv
    if op == "ne": return str(val) != cv
    if op == "contains": return cv in str(val)
    return True
