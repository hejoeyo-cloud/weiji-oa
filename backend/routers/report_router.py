from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import (
    get_db, User, Ticket, AfterSalesRecord, ReturnExchangeRecord,
    RepairRecord, GiftRecord, GiftCashback, GiftResendRecord,
    AttendanceRecord, TaskBoard,
)
from schemas import DashboardStatsOut, TicketTrendItem, ModuleDistributionItem
from auth import get_current_user, require_permission

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/dashboard-stats", response_model=DashboardStatsOut)
def get_dashboard_stats(
    current_user: User = Depends(require_permission("reports:view")),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id

    # 工单月度趋势（最近12个月）
    ticket_trend = []
    now = datetime.now()
    for i in range(11, -1, -1):
        # 正确回溯 i 个月
        target = now.replace(day=1)
        for _ in range(i):
            target = (target - timedelta(days=1)).replace(day=1)
        next_month = (target.replace(day=28) + timedelta(days=4)).replace(day=1)
        count = db.query(func.count(Ticket.id)).filter(
            Ticket.company_id == company_id,
            Ticket.created_at >= target,
            Ticket.created_at < next_month,
        ).scalar() or 0
        ticket_trend.append(TicketTrendItem(
            month=target.strftime("%Y-%m"),
            count=count,
        ))

    # 模块业务分布
    module_distribution = [
        ModuleDistributionItem(name="工单", count=db.query(func.count(Ticket.id)).filter(Ticket.company_id == company_id).scalar() or 0),
        ModuleDistributionItem(name="退换", count=db.query(func.count(ReturnExchangeRecord.id)).filter(ReturnExchangeRecord.company_id == company_id).scalar() or 0),
        ModuleDistributionItem(name="维修", count=db.query(func.count(RepairRecord.id)).filter(RepairRecord.company_id == company_id).scalar() or 0),
        ModuleDistributionItem(name="发货", count=db.query(func.count(GiftRecord.id)).filter(GiftRecord.company_id == company_id).scalar() or 0),
        ModuleDistributionItem(name="补发", count=db.query(func.count(GiftResendRecord.id)).filter(GiftResendRecord.company_id == company_id).scalar() or 0),
    ]
    # Filter out zeros
    module_distribution = [m for m in module_distribution if m.count > 0]

    # 工单状态分布
    statuses = ["pending", "processing", "completed"]
    status_labels = {"pending": "待处理", "processing": "处理中", "completed": "已完成"}
    ticket_status_distribution = []
    for s in statuses:
        count = db.query(func.count(Ticket.id)).filter(
            Ticket.company_id == company_id,
            Ticket.status == s,
        ).scalar() or 0
        ticket_status_distribution.append(ModuleDistributionItem(
            name=status_labels[s],
            count=count,
        ))

    # 今日打卡人数
    today = datetime.now().strftime("%Y-%m-%d")
    today_attendance = db.query(func.count(AttendanceRecord.id)).filter(
        AttendanceRecord.company_id == company_id,
        AttendanceRecord.date == today,
    ).scalar() or 0

    # 任务统计
    total_tasks = db.query(func.count(TaskBoard.id)).filter(
        TaskBoard.company_id == company_id,
    ).scalar() or 0
    pending_tasks = db.query(func.count(TaskBoard.id)).filter(
        TaskBoard.company_id == company_id,
        TaskBoard.status.in_(["todo", "in_progress"]),
    ).scalar() or 0

    return DashboardStatsOut(
        ticket_trend=ticket_trend,
        module_distribution=module_distribution,
        ticket_status_distribution=ticket_status_distribution,
        today_attendance=today_attendance,
        total_tasks=total_tasks,
        pending_tasks=pending_tasks,
    )
