from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import os, uuid, shutil

from database import get_db, User, Message, MessageAttachment
from auth import get_current_user
from config import UPLOAD_DIR

MAIL_UPLOAD = os.path.join(UPLOAD_DIR, "mail")
os.makedirs(MAIL_UPLOAD, exist_ok=True)

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


class AttachmentOut(BaseModel):
    id: int; filename: str; size: int; mime_type: str = ""
    class Config: from_attributes = True


@router.post("/upload", response_model=AttachmentOut)
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.size and file.size > 150 * 1024 * 1024:
        raise HTTPException(400, "文件不能超过 150MB")
    ext = os.path.splitext(file.filename or "file")[1]
    save_name = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(MAIL_UPLOAD, save_name)
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    att = MessageAttachment(
        company_id=current_user.company_id,
        message_id=0,  # temp, linked later
        filename=file.filename or "file",
        filepath=save_name,
        size=os.path.getsize(save_path),
        mime_type=file.content_type or "",
    )
    db.add(att); db.commit(); db.refresh(att)
    return att


@router.get("/attachment/{att_id}")
def download_attachment(att_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    att = db.query(MessageAttachment).filter(MessageAttachment.id == att_id, MessageAttachment.company_id == current_user.company_id).first()
    if not att:
        raise HTTPException(404)
    from fastapi.responses import FileResponse
    return FileResponse(os.path.join(MAIL_UPLOAD, att.filepath), filename=att.filename)


@router.get("/attachments/{msg_id}", response_model=List[AttachmentOut])
def get_attachments(msg_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    atts = db.query(MessageAttachment).filter(MessageAttachment.message_id == msg_id, MessageAttachment.company_id == current_user.company_id).all()
    return atts


@router.put("/attach/{att_id}/link/{msg_id}")
def link_attachment(att_id: int, msg_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    att = db.query(MessageAttachment).filter(MessageAttachment.id == att_id, MessageAttachment.company_id == current_user.company_id).first()
    if not att:
        raise HTTPException(404)
    att.message_id = msg_id
    db.commit()
    return {"ok": True}
