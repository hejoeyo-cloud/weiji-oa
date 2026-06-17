from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from auth import get_current_user, require_permission
from database import (
    ALL_PERMISSIONS,
    Announcement,
    AnnouncementRead,
    ApprovalRequest,
    ApprovalStep,
    CustomerInvoiceRequest,
    GiftRecord,
    GiftResendRecord,
    RepairRecord,
    ReturnExchangeRecord,
    ScheduleShift,
    ScheduleSlot,
    TaskBoard,
    Ticket,
    User,
    get_db,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def get_user_permissions(user: User) -> list[str]:
    if user.role == "admin":
        return ALL_PERMISSIONS.copy()
    if user.role_obj and user.role_obj.permissions:
        return user.role_obj.permissions
    return []


def has_permission(user_perms: list[str], *required: str) -> bool:
    return any(p in user_perms for p in required)


def format_datetime(value: Optional[datetime]) -> str:
    return value.isoformat() if value else ""


def get_month_range(year_month: str) -> tuple[str, str]:
    year, month = map(int, year_month.split("-"))
    start = f"{year}-{month:02d}-01"
    if month == 12:
        end = f"{year + 1}-01-01"
    else:
        end = f"{year}-{month + 1:02d}-01"
    return start, end


def build_announcement_summary(db: Session, current_user: User) -> dict:
    import json
    # 获取用户可见的公告
    all_active = db.query(Announcement).filter(
        Announcement.is_active == True,
        Announcement.company_id == current_user.company_id,
    ).all()
    visible_ids = []
    user_dept_id = current_user.department_id if current_user.role != "admin" else None

    for ann in all_active:
        if not ann.target_departments:
            visible_ids.append(ann.id)  # 全员公告
        else:
            try:
                targets = json.loads(ann.target_departments) if ann.target_departments else []
                if user_dept_id and user_dept_id in targets:
                    visible_ids.append(ann.id)
                elif not user_dept_id:
                    visible_ids.append(ann.id)
            except:
                visible_ids.append(ann.id)

    visible_anns = db.query(Announcement).filter(
        Announcement.id.in_(visible_ids)
    ).order_by(
        Announcement.is_pinned.desc(),
        Announcement.created_at.desc(),
    ).limit(3).all()

    read_ids = [r.announcement_id for r in db.query(AnnouncementRead.announcement_id).filter(
        AnnouncementRead.user_id == current_user.id,
        AnnouncementRead.announcement_id.in_(visible_ids),
        AnnouncementRead.company_id == current_user.company_id,
    ).all()]

    items = []
    for ann in visible_anns:
        items.append({
            "id": ann.id,
            "title": ann.title,
            "content": ann.content,
            "author_name": ann.author.name if ann.author else "",
            "created_at": format_datetime(ann.created_at),
            "is_pinned": bool(ann.is_pinned),
            "is_read": ann.id in read_ids,
        })

    unread_count = len([a for a in visible_anns if a.id not in read_ids])
    return {
        "unread_count": unread_count,
        "has_pinned": any(item["is_pinned"] for item in items),
        "items": items,
    }


def build_schedule_summary(db: Session, current_user: User, year_month: str) -> dict:
    start, end = get_month_range(year_month)
    shifts = db.query(ScheduleShift).filter(
        ScheduleShift.company_id == current_user.company_id,
    ).order_by(
        ScheduleShift.sort_order,
        ScheduleShift.id,
    ).all()
    slots = db.query(ScheduleSlot).filter(
        ScheduleSlot.user_id == current_user.id,
        ScheduleSlot.date >= start,
        ScheduleSlot.date < end,
        ScheduleSlot.company_id == current_user.company_id,
    ).order_by(ScheduleSlot.date.asc()).all()
    slot_items = [{
        "id": slot.id,
        "date": slot.date,
        "shift_id": slot.shift_id,
        "shift_name": slot.shift.name if slot.shift else "",
        "shift_short_name": slot.shift.short_name if slot.shift else "",
        "shift_color": slot.shift.color if slot.shift else "#94a3b8",
        "shift_is_rest": bool(slot.shift.is_rest) if slot.shift else False,
    } for slot in slots]
    shift_items = [{
        "id": shift.id,
        "name": shift.name,
        "short_name": shift.short_name,
        "color": shift.color,
        "start_time": shift.start_time,
        "end_time": shift.end_time,
        "is_rest": bool(shift.is_rest),
    } for shift in shifts]

    today = datetime.now().date()
    tomorrow = today + timedelta(days=1)
    slot_map = {slot["date"]: slot for slot in slot_items}
    return {
        "year_month": year_month,
        "today": today.isoformat(),
        "tomorrow": tomorrow.isoformat(),
        "today_slot": slot_map.get(today.isoformat()),
        "tomorrow_slot": slot_map.get(tomorrow.isoformat()),
        "shifts": shift_items,
        "slots": slot_items,
    }


def build_overview_cards(
    db: Session,
    current_user: User,
    announcement_summary: dict,
    schedule_summary: dict,
) -> list[dict]:
    open_ticket_count = db.query(Ticket).filter(
        Ticket.status.in_(["pending", "processing", "need_return"])
        , Ticket.company_id == current_user.company_id
    ).count()
    pending_ticket_count = db.query(Ticket).filter(Ticket.status == "pending", Ticket.company_id == current_user.company_id).count()
    processing_ticket_count = db.query(Ticket).filter(Ticket.status == "processing", Ticket.company_id == current_user.company_id).count()
    my_ticket_count = db.query(Ticket).filter(Ticket.created_by == current_user.id, Ticket.company_id == current_user.company_id).count()
    my_open_ticket_count = db.query(Ticket).filter(
        Ticket.created_by == current_user.id,
        Ticket.status.in_(["pending", "processing", "need_return"]),
        Ticket.company_id == current_user.company_id,
    ).count()
    pending_approval_count = db.query(ApprovalRequest).filter(
        ApprovalRequest.status == "pending"
        , ApprovalRequest.company_id == current_user.company_id
    ).count()
    my_approval_count = db.query(ApprovalRequest).filter(
        ApprovalRequest.applicant_id == current_user.id
        , ApprovalRequest.company_id == current_user.company_id
    ).count()
    pending_my_approval_count = db.query(func.count(func.distinct(ApprovalStep.request_id))).filter(
        ApprovalStep.approver_id == current_user.id,
        ApprovalStep.status == "pending",
        ApprovalStep.company_id == current_user.company_id,
    ).scalar() or 0
    month_schedule_coverage = len([
        slot for slot in schedule_summary["slots"]
        if not slot.get("shift_is_rest")
    ])

    # 待发货订单（发货登记中 status=pending）
    pending_delivery_count = db.query(GiftRecord).filter(
        GiftRecord.status == "pending",
        GiftRecord.company_id == current_user.company_id,
    ).count()

    # 退换待处理（退换登记中 progress=pending 或 processing）
    pending_return_exchange_count = db.query(ReturnExchangeRecord).filter(
        ReturnExchangeRecord.progress.in_(["pending", "processing"]),
        ReturnExchangeRecord.company_id == current_user.company_id,
    ).count()

    # 待开票数量（客户开票申请中 status=pending）
    pending_invoices_count = db.query(CustomerInvoiceRequest).filter(
        CustomerInvoiceRequest.status == "pending",
        CustomerInvoiceRequest.company_id == current_user.company_id,
    ).count()

    # 待处理维修
    pending_repair_count = db.query(RepairRecord).filter(
        RepairRecord.repair_status.in_(["pending_repair", "processing_repair"]),
        RepairRecord.company_id == current_user.company_id,
    ).count()

    if current_user.role == "admin":
        return [
            {
                "key": "pending_invoices",
                "title": "待开发票",
                "value": pending_invoices_count,
                "subtext": "客户开票申请中待处理的数量",
                "status": "info",
                "path": "/finance",
            },
            {
                "key": "pending_delivery",
                "title": "待发货订单",
                "value": pending_delivery_count,
                "subtext": "发货登记中待发货的订单数量",
                "status": "info",
                "path": "/gifts",
            },
            {
                "key": "pending_return_exchange",
                "title": "退换待处理",
                "value": pending_return_exchange_count,
                "subtext": "退换登记中待处理与处理中的记录",
                "status": "warning",
                "path": "/return-exchange",
            },
            {
                "key": "pending_repair",
                "title": "待处理维修",
                "value": pending_repair_count,
                "subtext": "维修登记中待维修与维修中的记录",
                "status": "warning",
                "path": "/repair",
            },
        ]

    if current_user.role == "technician":
        return [
            {
                "key": "pending_tickets",
                "title": "待处理工单",
                "value": pending_ticket_count,
                "subtext": "尚未进入处理流程的工单",
                "status": "warning",
                "path": "/tickets",
            },
            {
                "key": "pending_delivery",
                "title": "待发货订单",
                "value": pending_delivery_count,
                "subtext": "发货登记中待发货的订单数量",
                "status": "info",
                "path": "/gifts",
            },
            {
                "key": "pending_return_exchange",
                "title": "退换待处理",
                "value": pending_return_exchange_count,
                "subtext": "退换登记中待处理与处理中的记录",
                "status": "warning",
                "path": "/return-exchange",
            },
            {
                "key": "pending_repair",
                "title": "待处理维修",
                "value": pending_repair_count,
                "subtext": "维修登记中待维修与维修中的记录",
                "status": "warning",
                "path": "/repair",
            },
        ]

    return [
        {
            "key": "pending_invoices",
            "title": "待开发票",
            "value": pending_invoices_count,
            "subtext": "客户开票申请中待处理的数量",
            "status": "info",
            "path": "/finance",
        },
        {
            "key": "pending_delivery",
            "title": "待发货订单",
            "value": pending_delivery_count,
            "subtext": "发货登记中待发货的订单数量",
            "status": "info",
            "path": "/gifts",
        },
        {
            "key": "pending_return_exchange",
            "title": "退换待处理",
            "value": pending_return_exchange_count,
            "subtext": "退换登记中待处理与处理中的记录",
            "status": "warning",
            "path": "/return-exchange",
        },
        {
            "key": "pending_repair",
            "title": "待处理维修",
            "value": pending_repair_count,
            "subtext": "维修登记中待维修与维修中的记录",
            "status": "warning",
            "path": "/repair",
        },
    ]


def build_shortcuts(user_perms: list[str]) -> list[dict]:
    shortcuts = [
        {
            "key": "create_ticket",
            "label": "创建工单",
            "description": "快速提交新的工单记录",
            "path": "/tickets/create",
            "icon": "ticket",
            "permissions": ["tickets:create"],
        },
        {
            "key": "gifts",
            "label": "发货登记",
            "description": "进入发货业务登记页",
            "path": "/gifts",
            "icon": "gift_box",
            "permissions": ["gifts:view"],
        },
        {
            "key": "gift_resend",
            "label": "礼品补发",
            "description": "处理礼品补发申请",
            "path": "/gift-resend",
            "icon": "gift_resend",
            "permissions": ["gift_resend:view"],
        },
        {
            "key": "approvals",
            "label": "发起审批",
            "description": "进入审批中心提交申请",
            "path": "/approvals",
            "icon": "approval",
            "permissions": ["approvals:view", "approvals:create"],
        },
        {
            "key": "schedule",
            "label": "查看排班",
            "description": "查看个人与团队排班表",
            "path": "/schedule",
            "icon": "calendar",
            "permissions": ["schedule:view"],
        },
    ]
    return [{
        "key": item["key"],
        "label": item["label"],
        "description": item["description"],
        "path": item["path"],
        "icon": item["icon"],
    } for item in shortcuts if has_permission(user_perms, *item["permissions"])]


def build_my_todo(db: Session, current_user: User) -> list[dict]:
    """我的待办事项（最多8条）"""
    items = []

    # 待我审批
    from database import ApprovalStep
    pending_steps = db.query(ApprovalStep).filter(
        ApprovalStep.approver_id == current_user.id,
        ApprovalStep.status == "pending",
        ApprovalStep.company_id == current_user.company_id,
    ).order_by(ApprovalStep.id.desc()).limit(3).all()
    for step in pending_steps:
        req = step.request
        if req:
            items.append({
                "type": "approval",
                "label": "待审批",
                "title": req.title or "审批申请",
                "time": format_datetime(req.created_at),
                "path": "/approvals",
            })

    # 分配给我的未完成任务
    tasks = db.query(TaskBoard).filter(
        TaskBoard.assignee_id == current_user.id,
        TaskBoard.status.in_(["todo", "in_progress"]),
        TaskBoard.company_id == current_user.company_id,
    ).order_by(TaskBoard.created_at.desc()).limit(3).all()
    for t in tasks:
        items.append({
            "type": "task",
            "label": "任务",
            "title": t.title or "未命名任务",
            "time": format_datetime(t.created_at),
            "path": "/tasks",
        })

    # 我创建的待发货订单
    gifts = db.query(GiftRecord).filter(
        GiftRecord.created_by == current_user.id,
        GiftRecord.status == "pending",
        GiftRecord.company_id == current_user.company_id,
    ).order_by(GiftRecord.created_at.desc()).limit(3).all()
    for g in gifts:
        items.append({
            "type": "delivery",
            "label": "待发货",
            "title": f"订单 {g.order_no or '#'+str(g.id)} - {g.shop_name or ''}",
            "time": format_datetime(g.created_at),
            "path": "/gifts",
        })

    items.sort(key=lambda x: x["time"] or "", reverse=True)
    return items[:8]


def build_unread_messages(db: Session, current_user: User) -> list[dict]:
    """未读邮件列表 (最多5条)"""
    from database import Message
    msgs = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.recipient_id == current_user.id,
        Message.is_read == False,
        Message.is_draft == False,
        Message.is_deleted == False,
    ).order_by(Message.created_at.desc()).limit(5).all()
    return [{
        "id": m.id, "subject": m.subject or "(无主题)",
        "sender_name": m.sender.name if m.sender else "",
        "content_preview": (m.content or "")[:80],
        "created_at": m.created_at.isoformat() if m.created_at else "",
    } for m in msgs]


def build_recent_activity(db: Session, current_user: User) -> list[dict]:
    import json
    items: list[dict] = []

    # 获取用户可见的公告
    all_active = db.query(Announcement).filter(
        Announcement.is_active == True,
        Announcement.company_id == current_user.company_id,
    ).all()
    visible_ids = []
    user_dept_id = current_user.department_id if current_user.role != "admin" else None

    for ann in all_active:
        if not ann.target_departments:
            visible_ids.append(ann.id)
        else:
            try:
                targets = json.loads(ann.target_departments) if ann.target_departments else []
                if user_dept_id and user_dept_id in targets:
                    visible_ids.append(ann.id)
                elif not user_dept_id:
                    visible_ids.append(ann.id)
            except:
                visible_ids.append(ann.id)

    announcements = db.query(Announcement).filter(
        Announcement.id.in_(visible_ids)
        , Announcement.company_id == current_user.company_id
    ).order_by(Announcement.created_at.desc()).limit(3).all()
    for ann in announcements:
        items.append({
            "key": f"announcement-{ann.id}",
            "kind": "announcement",
            "title": ann.title,
            "description": f"{ann.author.name if ann.author else '系统'} 发布了公告",
            "time": format_datetime(ann.created_at),
            "path": "/announcements",
        })

    approvals = db.query(ApprovalRequest).filter(
        or_(
            ApprovalRequest.applicant_id == current_user.id,
            ApprovalRequest.id.in_(
                db.query(ApprovalStep.request_id).filter(
                    ApprovalStep.approver_id == current_user.id,
                    ApprovalStep.company_id == current_user.company_id,
                )
            ),
        )
        , ApprovalRequest.company_id == current_user.company_id
    ).order_by(ApprovalRequest.updated_at.desc()).limit(5).all()
    for req in approvals:
        items.append({
            "key": f"approval-{req.id}",
            "kind": "approval",
            "title": req.title or "审批申请",
            "description": f"审批状态：{req.status}",
            "time": format_datetime(req.updated_at or req.created_at),
            "path": "/approvals",
        })

    tickets = db.query(Ticket).filter(
        or_(
            Ticket.created_by == current_user.id,
            Ticket.assigned_to == current_user.id,
        )
        , Ticket.company_id == current_user.company_id
    ).order_by(Ticket.updated_at.desc()).limit(5).all()
    for ticket in tickets:
        items.append({
            "key": f"ticket-{ticket.id}",
            "kind": "ticket",
            "title": f"工单 #{ticket.id}",
            "description": f"当前状态：{ticket.status}",
            "time": format_datetime(ticket.updated_at or ticket.created_at),
            "path": f"/tickets/{ticket.id}",
        })

    # 发货记录
    gifts = db.query(GiftRecord).filter(
        GiftRecord.created_by == current_user.id,
        GiftRecord.company_id == current_user.company_id,
    ).order_by(GiftRecord.updated_at.desc()).limit(3).all()
    for r in gifts:
        status_label = "已发货" if r.status == "sent" else "待发货"
        items.append({
            "key": f"gift-{r.id}",
            "kind": "gift",
            "title": f"发货 #{r.id}",
            "description": f"订单 {r.order_no or '-'} | {r.shop_name or '-'} | {status_label}",
            "time": format_datetime(r.updated_at or r.created_at),
            "path": "/gifts",
        })

    # 补发记录
    resends = db.query(GiftResendRecord).filter(
        GiftResendRecord.created_by == current_user.id,
        GiftResendRecord.company_id == current_user.company_id,
    ).order_by(GiftResendRecord.updated_at.desc()).limit(3).all()
    for r in resends:
        detail = ""
        if r.gift_items:
            detail = "、".join(f"{g.get('name','')}" for g in r.gift_items[:3] if isinstance(g, dict))
        items.append({
            "key": f"gift_resend-{r.id}",
            "kind": "gift_resend",
            "title": f"补发 #{r.id}",
            "description": f"订单 {r.order_no or '-'} | {detail or r.shop_name or '-'}",
            "time": format_datetime(r.updated_at or r.created_at),
            "path": "/gift-resend",
        })

    # 退换记录
    re_records = db.query(ReturnExchangeRecord).filter(
        ReturnExchangeRecord.created_by == current_user.id,
        ReturnExchangeRecord.company_id == current_user.company_id,
    ).order_by(ReturnExchangeRecord.updated_at.desc()).limit(3).all()
    for r in re_records:
        type_label = "退货" if r.record_type == "return" else "换货"
        status_map = {"pending": "待处理", "processing": "处理中", "completed": "已完成"}
        items.append({
            "key": f"return_exchange-{r.id}",
            "kind": "return_exchange",
            "title": f"{type_label} #{r.id}",
            "description": f"订单 {r.order_no or '-'} | {status_map.get(r.progress, r.progress)}",
            "time": format_datetime(r.updated_at or r.created_at),
            "path": "/return-exchange",
        })

    # 维修记录
    repairs = db.query(RepairRecord).filter(
        RepairRecord.created_by == current_user.id,
        RepairRecord.company_id == current_user.company_id,
    ).order_by(RepairRecord.updated_at.desc()).limit(3).all()
    for r in repairs:
        status_map = {"pending_repair": "待维修", "processing_repair": "维修中", "completed_repair": "已完成"}
        items.append({
            "key": f"repair-{r.id}",
            "kind": "repair",
            "title": f"维修 #{r.id}",
            "description": f"订单 {r.order_no or '-'} | {status_map.get(r.repair_status, r.repair_status)}",
            "time": format_datetime(r.updated_at or r.created_at),
            "path": "/repair",
        })

    items.sort(key=lambda item: item["time"] or "", reverse=True)
    return items[:10]


@router.get("")
def get_dashboard(
    year_month: str = Query("", description="Optional YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("dashboard:view")),
):
    current_year_month = year_month or datetime.now().strftime("%Y-%m")
    user_perms = get_user_permissions(current_user)
    announcement_summary = build_announcement_summary(db, current_user)
    schedule_summary = build_schedule_summary(db, current_user, current_year_month)

    return {
        "user_summary": {
            "name": current_user.name,
            "role": current_user.role,
            "role_label": current_user.role_obj.label if current_user.role_obj else current_user.role,
            "department_name": current_user.department.name if current_user.department else "",
            "is_manager": bool(current_user.is_manager),
        },
        "announcement_summary": announcement_summary,
        "schedule_summary": schedule_summary,
        "overview_cards": build_overview_cards(
            db, current_user, announcement_summary, schedule_summary
        ),
        "shortcuts": build_shortcuts(user_perms),
        "recent_activity": build_recent_activity(db, current_user),
        "unread_messages": build_unread_messages(db, current_user),
        "my_todo": build_my_todo(db, current_user),
    }
