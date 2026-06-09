from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import (
    ApprovalStep,
    CustomerInvoiceRequest,
    GiftRecord,
    Message,
    RepairRecord,
    ReturnExchangeRecord,
    ShiftSwapRequest,
    TaskBoard,
    Ticket,
    User,
    get_db,
)

router = APIRouter(prefix="/api/sidebar-badges", tags=["sidebar-badges"])


@router.get("")
def get_sidebar_badges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回侧边栏各模块的待处理数量，用于红点提醒"""
    uid = current_user.id
    cid = current_user.company_id

    # 待我审批
    pending_my_approval = db.query(func.count(func.distinct(ApprovalStep.request_id))).filter(
        ApprovalStep.approver_id == uid,
        ApprovalStep.status == "pending",
        ApprovalStep.company_id == cid,
    ).scalar() or 0

    # 任务看板（分配给我的未完成任务）
    pending_tasks = db.query(TaskBoard).filter(
        TaskBoard.assignee_id == uid,
        TaskBoard.status.in_(["todo", "in_progress"]),
        TaskBoard.company_id == cid,
    ).count()

    # 内部邮件（未读）
    unread_messages = db.query(Message).filter(
        Message.recipient_id == uid,
        Message.is_read == False,
        Message.is_deleted == False,
        Message.is_draft == False,
    ).count()

    # 工单池（待处理工单）
    pending_tickets = db.query(Ticket).filter(
        Ticket.status.in_(["pending", "processing", "need_return"]),
        Ticket.company_id == cid,
    ).count()

    # 发货登记（待发货）
    pending_delivery = db.query(GiftRecord).filter(
        GiftRecord.status == "pending",
        GiftRecord.company_id == cid,
    ).count()

    # 退换登记（待处理 + 处理中）
    pending_return_exchange = db.query(ReturnExchangeRecord).filter(
        ReturnExchangeRecord.progress.in_(["pending", "processing"]),
        ReturnExchangeRecord.company_id == cid,
    ).count()

    # 维修登记（待维修）
    pending_repair = db.query(RepairRecord).filter(
        RepairRecord.repair_status == "pending_repair",
        RepairRecord.company_id == cid,
    ).count()

    # 财务管理（待处理开票申请）
    pending_finance = db.query(CustomerInvoiceRequest).filter(
        CustomerInvoiceRequest.status == "pending",
        CustomerInvoiceRequest.company_id == cid,
    ).count()

    # 排班表（待审批换班申请，仅管理员可见）
    pending_schedule = 0
    if current_user.role == "admin":
        pending_schedule = db.query(ShiftSwapRequest).filter(
            ShiftSwapRequest.status == "pending",
            ShiftSwapRequest.company_id == cid,
        ).count()

    return {
        "pending_my_approval": pending_my_approval,
        "pending_tasks": pending_tasks,
        "unread_messages": unread_messages,
        "pending_tickets": pending_tickets,
        "pending_delivery": pending_delivery,
        "pending_return_exchange": pending_return_exchange,
        "pending_repair": pending_repair,
        "pending_finance": pending_finance,
        "pending_schedule": pending_schedule,
    }
