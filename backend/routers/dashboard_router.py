from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from auth import get_current_user
from database import (
    ALL_PERMISSIONS,
    Announcement,
    AnnouncementRead,
    ApprovalRequest,
    ApprovalStep,
    GiftRecord,
    GiftResendRecord,
    ScheduleShift,
    ScheduleSlot,
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

    if current_user.role == "admin":
        return [
            {
                "key": "pending_approvals",
                "title": "待审批事项",
                "value": pending_approval_count,
                "subtext": "全系统仍处于审批中的申请",
                "status": "warning",
                "path": "/approvals",
            },
            {
                "key": "announcement_unread",
                "title": "公告未读",
                "value": announcement_summary["unread_count"],
                "subtext": "当前账号尚未确认的公告数量",
                "status": "info",
                "path": "/announcements",
            },
            {
                "key": "schedule_coverage",
                "title": "本月我的班次",
                "value": month_schedule_coverage,
                "subtext": "当前月份已排班天数",
                "status": "success",
                "path": "/schedule",
            },
            {
                "key": "open_tickets",
                "title": "开放工单",
                "value": open_ticket_count,
                "subtext": "待处理、处理中与需寄回工单总量",
                "status": "warning",
                "path": "/tickets",
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
                "key": "processing_tickets",
                "title": "处理中工单",
                "value": processing_ticket_count,
                "subtext": "当前技术处理中工单",
                "status": "info",
                "path": "/tickets",
            },
            {
                "key": "pending_my_approval",
                "title": "待我审批",
                "value": pending_my_approval_count,
                "subtext": "需要当前账号处理的审批事项",
                "status": "info",
                "path": "/approvals",
            },
        ]

    return [
        {
            "key": "my_approvals",
            "title": "我发起的审批",
            "value": my_approval_count,
            "subtext": "含进行中与已处理审批",
            "status": "info",
            "path": "/approvals",
        },
        {
            "key": "my_tickets",
            "title": "我创建的工单",
            "value": my_ticket_count,
            "subtext": f"其中 {my_open_ticket_count} 条仍在流转中",
            "status": "warning",
            "path": "/tickets",
        },
        {
            "key": "announcement_unread",
            "title": "公告未读",
            "value": announcement_summary["unread_count"],
            "subtext": "建议及时查看组织通知",
            "status": "info",
            "path": "/announcements",
        },
        {
            "key": "schedule_coverage",
            "title": "本月排班天数",
            "value": month_schedule_coverage,
            "subtext": "已写入排班表的当月班次数量",
            "status": "success",
            "path": "/schedule",
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

    for model, kind, title_prefix, path in [
        (GiftRecord, "gift", "发货登记", "/gifts"),
        (GiftResendRecord, "gift_resend", "礼品补发", "/gift-resend"),
    ]:
        records = db.query(model).filter(
            model.created_by == current_user.id,
            model.company_id == current_user.company_id,
        ).order_by(model.updated_at.desc()).limit(3).all()
        for record in records:
            items.append({
                "key": f"{kind}-{record.id}",
                "kind": kind,
                "title": f"{title_prefix} #{record.id}",
                "description": "最近有更新",
                "time": format_datetime(record.updated_at or record.created_at),
                "path": path,
            })

    items.sort(key=lambda item: item["time"], reverse=True)
    return items[:5]


@router.get("")
def get_dashboard(
    year_month: str = Query("", description="Optional YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    }
