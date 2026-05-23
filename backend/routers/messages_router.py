from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_db, User, Message
from auth import get_current_user

router = APIRouter(prefix="/api/messages", tags=["messages"])

class MessageOut(BaseModel):
    id: int; sender_id: int; sender_name: str = ""; recipient_id: int; recipient_name: str = ""
    subject: str = ""; content: str = ""; is_read: bool = False; is_draft: bool = False
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

class MessageCreate(BaseModel):
    recipient_id: int; subject: str = ""; content: str

class DraftCreate(BaseModel):
    recipient_id: int; subject: str = ""; content: str


@router.get("/inbox", response_model=list[MessageOut])
def list_inbox(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msgs = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.recipient_id == current_user.id,
        Message.is_draft == False,
    ).order_by(Message.created_at.desc()).limit(100).all()
    return [_out(m) for m in msgs]

@router.get("/sent", response_model=list[MessageOut])
def list_sent(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msgs = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.sender_id == current_user.id,
        Message.is_draft == False,
    ).order_by(Message.created_at.desc()).limit(100).all()
    return [_out(m) for m in msgs]

@router.get("/drafts", response_model=list[MessageOut])
def list_drafts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msgs = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.sender_id == current_user.id,
        Message.is_draft == True,
    ).order_by(Message.created_at.desc()).all()
    return [_out(m) for m in msgs]

@router.post("", response_model=MessageOut)
def send_message(req: MessageCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    recipient = db.query(User).filter(User.id == req.recipient_id, User.company_id == current_user.company_id).first()
    if not recipient:
        raise HTTPException(404, "收件人不存在")
    msg = Message(company_id=current_user.company_id, sender_id=current_user.id,
                  recipient_id=req.recipient_id, subject=req.subject, content=req.content, is_draft=False)
    db.add(msg); db.commit(); db.refresh(msg)
    return _out(msg)

@router.post("/draft", response_model=MessageOut)
def save_draft(req: DraftCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = Message(company_id=current_user.company_id, sender_id=current_user.id,
                  recipient_id=req.recipient_id, subject=req.subject, content=req.content, is_draft=True)
    db.add(msg); db.commit(); db.refresh(msg)
    return _out(msg)

@router.put("/read/{msg_id}")
def mark_read(msg_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = db.query(Message).filter(Message.id == msg_id, Message.recipient_id == current_user.id).first()
    if msg:
        msg.is_read = True; db.commit()
    return {"ok": True}

@router.get("/unread-count")
def unread_count(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.recipient_id == current_user.id,
        Message.is_read == False, Message.is_draft == False,
    ).count()
    return {"count": count}

def _out(m: Message) -> MessageOut:
    return MessageOut(id=m.id, sender_id=m.sender_id, sender_name=m.sender.name if m.sender else "",
                      recipient_id=m.recipient_id, recipient_name=m.recipient.name if m.recipient else "",
                      subject=m.subject, content=m.content, is_read=m.is_read, is_draft=m.is_draft, created_at=m.created_at)
