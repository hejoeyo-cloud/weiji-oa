from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db, User, Ticket, TicketFeedback, Notification
from schemas import (
    TicketCreate, TicketUpdate, TicketOut, TicketFeedbackOut,
    FeedbackCreate, UserInfo
)
from auth import get_current_user, require_admin, require_admin_or_tech, require_permission
from services import notification_service, audit_service

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


def ticket_to_out(t: Ticket) -> TicketOut:
    creator = t.creator
    assignee = t.assignee
    feedbacks_out = []
    for f in (t.feedbacks or []):
        feedbacks_out.append(TicketFeedbackOut(
            id=f.id, ticket_id=f.ticket_id, user_id=f.user_id,
            content=f.content, feedback_type=f.feedback_type,
            created_at=f.created_at, user_name=f.user.name if f.user else "",
        ))
    return TicketOut(
        id=t.id, platform=t.platform, customer_id=t.customer_id,
        description=t.description, images=t.images or [],
        remote_tool=t.remote_tool, remote_code=t.remote_code,
        verify_code=t.verify_code, priority=t.priority,
        status=t.status, diagnosis_result=t.diagnosis_result or "",
        diagnosis_log=t.diagnosis_log or [],
        created_by=t.created_by, assigned_to=t.assigned_to,
        created_at=t.created_at, updated_at=t.updated_at,
        completed_at=t.completed_at,
        creator_name=creator.name if creator else "",
        assignee_name=assignee.name if assignee else None,
        feedbacks=feedbacks_out,
    )


@router.post("", response_model=TicketOut)
def create_ticket(
    req: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = Ticket(
        company_id=current_user.company_id,
        platform=req.platform,
        customer_id=req.customer_id,
        description=req.description,
        images=req.images,
        remote_tool=req.remote_tool,
        remote_code=req.remote_code,
        verify_code=req.verify_code,
        priority=req.priority,
        diagnosis_result=req.diagnosis_result,
        diagnosis_log=req.diagnosis_log,
        created_by=current_user.id,
        status="pending",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    audit_service.log(db, current_user, "create", "ticket", ticket.id,
                      f"创建工单: #{ticket.id} {ticket.customer_id}")
    return ticket_to_out(ticket)


@router.get("", response_model=dict)
def list_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query("", description="Filter by status"),
    priority: str = Query("", description="Filter by priority"),
    search: str = Query("", description="Search in description/customer_id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Ticket).filter(Ticket.company_id == current_user.company_id)
    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Ticket.description.like(search_pattern))
            | (Ticket.customer_id.like(search_pattern))
        )
    total = query.count()
    tickets = query.order_by(Ticket.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [ticket_to_out(t) for t in tickets],
    }


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.company_id == current_user.company_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket_to_out(ticket)


@router.put("/{ticket_id}", response_model=TicketOut)
def update_ticket(
    ticket_id: int,
    req: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_tech),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.company_id == current_user.company_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if req.status is not None:
        old_status = ticket.status
        ticket.status = req.status
        if req.status == "completed" and old_status != "completed":
            ticket.completed_at = datetime.now()
            notification_service.create_and_push(
                db, ticket.created_by, ticket.id,
                f"工单 #{ticket_id} 已完结",
                f"技术员 {current_user.name} 已完成处理您的工单",
            )
        if req.status == "need_return" and old_status != "need_return":
            notification_service.create_and_push(
                db, ticket.created_by, ticket.id,
                f"工单 #{ticket_id} 需要寄回",
                f"技术员 {current_user.name} 判定需要寄回售后部处理",
            )
    if req.assigned_to is not None:
        assignee = db.query(User).filter(User.id == req.assigned_to, User.company_id == current_user.company_id).first()
        if not assignee:
            raise HTTPException(status_code=400, detail="指派用户不存在")
        if req.assigned_to != ticket.assigned_to:
            notification_service.create_and_push(
                db, req.assigned_to, ticket.id,
                f"工单 #{ticket_id} 已分配给您",
                f"{current_user.name} 将工单分配给您处理",
            )
        ticket.assigned_to = req.assigned_to
    if req.diagnosis_result is not None:
        ticket.diagnosis_result = req.diagnosis_result
    ticket.updated_at = datetime.now()
    db.commit()
    db.refresh(ticket)
    audit_service.log(db, current_user, "update", "ticket", ticket_id,
                      f"更新工单状态: #{ticket_id} -> {ticket.status}")
    return ticket_to_out(ticket)


@router.post("/{ticket_id}/feedback", response_model=TicketFeedbackOut)
def add_feedback(
    ticket_id: int,
    req: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_tech),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.company_id == current_user.company_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    feedback = TicketFeedback(
        company_id=current_user.company_id,
        ticket_id=ticket_id,
        user_id=current_user.id,
        content=req.content,
        feedback_type=req.feedback_type,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    if feedback.user:
        return TicketFeedbackOut(
            id=feedback.id, ticket_id=feedback.ticket_id,
            user_id=feedback.user_id, content=feedback.content,
            feedback_type=feedback.feedback_type,
            created_at=feedback.created_at,
            user_name=feedback.user.name,
        )
    return TicketFeedbackOut(
        id=feedback.id, ticket_id=feedback.ticket_id,
        user_id=feedback.user_id, content=feedback.content,
        feedback_type=feedback.feedback_type,
        created_at=feedback.created_at, user_name="",
    )


@router.delete("/{ticket_id}")
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tickets:delete")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.company_id == current_user.company_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    # 删除关联的反馈记录
    db.query(TicketFeedback).filter(TicketFeedback.ticket_id == ticket_id, TicketFeedback.company_id == current_user.company_id).delete()
    # 删除关联的通知
    db.query(Notification).filter(Notification.ticket_id == ticket_id, Notification.company_id == current_user.company_id).delete()
    audit_service.log(db, current_user, "delete", "ticket", ticket_id,
                      f"删除工单: #{ticket_id} {ticket.customer_id}")
    db.delete(ticket)
    db.commit()
    return {"message": "Ticket deleted"}
