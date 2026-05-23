from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_db, User, Message
from auth import get_current_user

router = APIRouter(prefix="/api/messages", tags=["messages"])

# ── Schemas ──
class MessageOut(BaseModel):
    id: int
    sender_id: int
    sender_name: str = ""
    recipient_id: int
    recipient_name: str = ""
    content: str = ""
    is_read: bool = False
    is_draft: bool = False
    reply_to_id: Optional[int] = None
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

class MessageCreate(BaseModel):
    recipient_id: int
    content: str

class DraftCreate(BaseModel):
    recipient_id: int
    content: str

# ── 收件箱（按对话聚合） ──
@router.get("")
def list_conversations(
    keyword: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回当前用户的对话列表 — 每个对话显示最后一条消息"""
    cid = current_user.company_id
    uid = current_user.id

    # 找到所有与当前用户有消息往来的 user_id
    sub = db.query(
        Message.sender_id, Message.recipient_id, func.max(Message.created_at).label("latest")
    ).filter(
        Message.company_id == cid,
        Message.is_draft == False,
        or_(Message.sender_id == uid, Message.recipient_id == uid),
    ).group_by(
        func.min(Message.sender_id, Message.recipient_id),
        func.max(Message.sender_id, Message.recipient_id),
    )

    if keyword:
        sub = sub.join(User, or_(User.id == Message.sender_id, User.id == Message.recipient_id)).filter(
            User.name.ilike(f"%{keyword}%"), User.id != uid
        )

    sub = sub.all()
    
    conversations = []
    for sender_id, recipient_id, latest_time in sub:
        partner_id = sender_id if recipient_id == uid else recipient_id
        # Get last message between these two
        last_msg = db.query(Message).filter(
            Message.company_id == cid,
            Message.is_draft == False,
            or_(
                and_(Message.sender_id == uid, Message.recipient_id == partner_id),
                and_(Message.sender_id == partner_id, Message.recipient_id == uid),
            ),
        ).order_by(Message.created_at.desc()).first()

        unread_count = db.query(Message).filter(
            Message.company_id == cid,
            Message.sender_id == partner_id,
            Message.recipient_id == uid,
            Message.is_read == False,
            Message.is_draft == False,
        ).count()

        partner = db.query(User).filter(User.id == partner_id).first()
        if not last_msg:
            continue

        conversations.append({
            "partner_id": partner_id,
            "partner_name": partner.name if partner else "",
            "last_content": last_msg.content[:50] if last_msg.content else "",
            "last_time": last_msg.created_at.isoformat() if last_msg.created_at else "",
            "unread_count": unread_count,
        })

    conversations.sort(key=lambda x: x["last_time"], reverse=True)
    return conversations


# ── 与某人的对话记录 ──
@router.get("/conversation/{partner_id}", response_model=list[MessageOut])
def get_conversation(
    partner_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    messages = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.is_draft == False,
        or_(
            and_(Message.sender_id == current_user.id, Message.recipient_id == partner_id),
            and_(Message.sender_id == partner_id, Message.recipient_id == current_user.id),
        ),
    ).order_by(Message.created_at.asc()).all()

    # Mark as read
    for m in messages:
        if m.recipient_id == current_user.id and not m.is_read:
            m.is_read = True
    db.commit()

    return [_msg_to_out(m) for m in messages]


# ── 已发送 ──
@router.get("/sent", response_model=list[MessageOut])
def list_sent(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.sender_id == current_user.id,
        Message.is_draft == False,
    ).order_by(Message.created_at.desc()).limit(50).all()
    return [_msg_to_out(m) for m in messages]


# ── 草稿 ──
@router.get("/drafts", response_model=list[MessageOut])
def list_drafts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.sender_id == current_user.id,
        Message.is_draft == True,
    ).order_by(Message.created_at.desc()).all()
    return [_msg_to_out(m) for m in messages]


# ── 发送消息 ──
@router.post("", response_model=MessageOut)
def send_message(
    req: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipient = db.query(User).filter(User.id == req.recipient_id, User.company_id == current_user.company_id).first()
    if not recipient:
        raise HTTPException(404, "收件人不存在")

    msg = Message(
        company_id=current_user.company_id,
        sender_id=current_user.id,
        recipient_id=req.recipient_id,
        content=req.content,
        is_draft=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _msg_to_out(msg)


# ── 保存草稿 ──
@router.post("/draft", response_model=MessageOut)
def save_draft(
    req: DraftCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = Message(
        company_id=current_user.company_id,
        sender_id=current_user.id,
        recipient_id=req.recipient_id,
        content=req.content,
        is_draft=True,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _msg_to_out(msg)


# ── 标记已读 ──
@router.put("/read/{partner_id}")
def mark_read(
    partner_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msgs = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.sender_id == partner_id,
        Message.recipient_id == current_user.id,
        Message.is_read == False,
    ).all()
    for m in msgs:
        m.is_read = True
    db.commit()
    return {"ok": True}


# ── 未读数量 ──
@router.get("/unread-count")
def unread_count(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.recipient_id == current_user.id,
        Message.is_read == False,
        Message.is_draft == False,
    ).count()
    return {"count": count}


# ── Helper ──
def _msg_to_out(m: Message) -> MessageOut:
    return MessageOut(
        id=m.id,
        sender_id=m.sender_id,
        sender_name=m.sender.name if m.sender else "",
        recipient_id=m.recipient_id,
        recipient_name=m.recipient.name if m.recipient else "",
        content=m.content,
        is_read=m.is_read,
        is_draft=m.is_draft,
        reply_to_id=m.reply_to_id,
        created_at=m.created_at,
    )
