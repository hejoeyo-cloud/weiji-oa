from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import os, uuid, shutil, hashlib

from database import get_db, User, Message, MessageAttachment
from auth import get_current_user
from config import UPLOAD_DIR

MAIL_UPLOAD = os.path.join(UPLOAD_DIR, "mail")
os.makedirs(MAIL_UPLOAD, exist_ok=True)

router = APIRouter(prefix="/api/messages", tags=["messages"])

# ── Schemas ──
class MessageOut(BaseModel):
    id: int; sender_id: int; sender_name: str = ""; recipient_id: int; recipient_name: str = ""
    subject: str = ""; content: str = ""; is_read: bool = False; is_draft: bool = False
    is_starred: bool = False; is_forward: bool = False; has_attachments: bool = False
    thread_id: Optional[int] = None; reply_to_id: Optional[int] = None
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

class MessageCreate(BaseModel):
    recipient_id: int; subject: str = ""; content: str; thread_id: Optional[int] = None

class AttachmentOut(BaseModel):
    id: int; filename: str; size: int; mime_type: str = ""
    class Config: from_attributes = True


# ── Helpers ──
def _out(m: Message) -> MessageOut:
    return MessageOut(
        id=m.id, sender_id=m.sender_id, sender_name=m.sender.name if m.sender else "",
        recipient_id=m.recipient_id, recipient_name=m.recipient.name if m.recipient else "",
        subject=m.subject, content=m.content, is_read=m.is_read, is_draft=m.is_draft,
        is_starred=m.is_starred, is_forward=m.is_forward, 
        has_attachments=bool(m.attachments) if hasattr(m, 'attachments') else False,
        thread_id=m.thread_id, reply_to_id=m.reply_to_id, created_at=m.created_at,
    )


# ── 收件箱 ──
@router.get("/inbox", response_model=list[MessageOut])
def list_inbox(q: str = "", starred: bool = False, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.recipient_id == current_user.id,
        Message.is_draft == False, Message.is_deleted == False,
    )
    if starred:
        query = query.filter(Message.is_starred == True)
    if q:
        query = query.filter(or_(Message.subject.ilike(f"%{q}%"), Message.content.ilike(f"%{q}%"),
                                 Message.sender.has(User.name.ilike(f"%{q}%"))))
    return [_out(m) for m in query.order_by(Message.created_at.desc()).limit(200).all()]


# ── 已发送 ──
@router.get("/sent", response_model=list[MessageOut])
def list_sent(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msgs = db.query(Message).filter(
        Message.company_id == current_user.company_id, Message.sender_id == current_user.id,
        Message.is_draft == False, Message.is_deleted == False,
    ).order_by(Message.created_at.desc()).limit(100).all()
    return [_out(m) for m in msgs]


# ── 草稿 ──
@router.get("/drafts", response_model=list[MessageOut])
def list_drafts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msgs = db.query(Message).filter(
        Message.company_id == current_user.company_id, Message.sender_id == current_user.id,
        Message.is_draft == True, Message.is_deleted == False,
    ).order_by(Message.created_at.desc()).all()
    return [_out(m) for m in msgs]


# ── 回收站 ──
@router.get("/trash", response_model=list[MessageOut])
def list_trash(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msgs = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.is_deleted == True,
        or_(Message.sender_id == current_user.id, Message.recipient_id == current_user.id),
    ).order_by(Message.created_at.desc()).limit(100).all()
    return [_out(m) for m in msgs]


# ── 文件夹计数 ──
@router.get("/counts")
def get_counts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cid, uid = current_user.company_id, current_user.id
    base = db.query(Message).filter(Message.company_id == cid, Message.is_deleted == False)
    return {
        "inbox": base.filter(Message.recipient_id == uid, Message.is_draft == False, Message.is_read == False).count(),
        "drafts": base.filter(Message.sender_id == uid, Message.is_draft == True).count(),
        "starred": base.filter(Message.recipient_id == uid, Message.is_starred == True).count(),
        "trash": db.query(Message).filter(Message.company_id == cid, Message.is_deleted == True,
            or_(Message.sender_id == uid, Message.recipient_id == uid)).count(),
    }


# ── 发送 ──
@router.post("", response_model=MessageOut)
def send_message(req: MessageCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    recipient = db.query(User).filter(User.id == req.recipient_id, User.company_id == current_user.company_id).first()
    if not recipient: raise HTTPException(404, "收件人不存在")
    thread_id = req.thread_id
    if not thread_id: thread_id = None
    msg = Message(company_id=current_user.company_id, sender_id=current_user.id,
                  recipient_id=req.recipient_id, subject=req.subject, content=req.content,
                  is_draft=False, thread_id=thread_id)
    db.add(msg); db.commit(); db.refresh(msg)
    return _out(msg)


# ── 保存草稿 ──
@router.post("/draft", response_model=MessageOut)
def save_draft(req: MessageCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = Message(company_id=current_user.company_id, sender_id=current_user.id,
                  recipient_id=req.recipient_id, subject=req.subject, content=req.content, is_draft=True)
    db.add(msg); db.commit(); db.refresh(msg)
    return _out(msg)


# ── 回复 ──
@router.post("/{msg_id}/reply", response_model=MessageOut)
def reply_message(msg_id: int, req: MessageCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orig = db.query(Message).filter(Message.id == msg_id, Message.company_id == current_user.company_id).first()
    if not orig: raise HTTPException(404)
    quoted = f'<blockquote style="margin-left:12px;border-left:2px solid #ccc;padding-left:12px;color:#666">{orig.sender.name if orig.sender else "?"}: {orig.content}</blockquote>'
    thread_id = orig.thread_id or orig.id
    msg = Message(company_id=current_user.company_id, sender_id=current_user.id,
                  recipient_id=orig.sender_id, subject=f"Re: {orig.subject.replace('Re: ','')}",
                  content=req.content + quoted, is_draft=False, thread_id=thread_id,
                  reply_to_id=orig.id)
    db.add(msg); db.commit(); db.refresh(msg)
    return _out(msg)


# ── 转发 ──
@router.post("/{msg_id}/forward", response_model=MessageOut)
def forward_message(msg_id: int, req: MessageCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orig = db.query(Message).filter(Message.id == msg_id, Message.company_id == current_user.company_id).first()
    if not orig: raise HTTPException(404)
    quoted = f'<hr><p style="color:#666;font-size:12px">转自 {orig.sender.name if orig.sender else "?"}:</p>{orig.content}'
    msg = Message(company_id=current_user.company_id, sender_id=current_user.id,
                  recipient_id=req.recipient_id, subject=f"Fwd: {orig.subject.replace('Fwd: ','')}",
                  content=req.content + quoted, is_draft=False, is_forward=True)
    db.add(msg); db.commit(); db.refresh(msg)
    return _out(msg)


# ── 标星 ──
@router.put("/{msg_id}/star")
def toggle_star(msg_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = db.query(Message).filter(Message.id == msg_id, Message.company_id == current_user.company_id).first()
    if not msg: raise HTTPException(404)
    msg.is_starred = not msg.is_starred; db.commit()
    return {"ok": True, "is_starred": msg.is_starred}


# ── 软删除 ──
@router.delete("/{msg_id}")
def soft_delete(msg_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = db.query(Message).filter(Message.id == msg_id, Message.company_id == current_user.company_id).first()
    if not msg: raise HTTPException(404)
    msg.is_deleted = True; db.commit()
    return {"ok": True}


# ── 恢复 ──
@router.put("/{msg_id}/restore")
def restore(msg_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = db.query(Message).filter(Message.id == msg_id, Message.company_id == current_user.company_id).first()
    if not msg: raise HTTPException(404)
    msg.is_deleted = False; db.commit()
    return {"ok": True}


# ── 彻底删除 ──
@router.delete("/{msg_id}/permanent")
def permanent_delete(msg_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = db.query(Message).filter(Message.id == msg_id, Message.company_id == current_user.company_id).first()
    if not msg: raise HTTPException(404)
    
    # Delete orphaned attachments
    atts = db.query(MessageAttachment).filter(MessageAttachment.message_id == msg_id).all()
    for att in atts:
        # Check if any other record references same hash
        other_count = db.query(MessageAttachment).filter(
            MessageAttachment.hash == att.hash, MessageAttachment.id != att.id
        ).count()
        if other_count == 0:
            filepath = os.path.join(MAIL_UPLOAD, att.filepath)
            if os.path.exists(filepath): os.remove(filepath)
        db.delete(att)
    
    db.delete(msg); db.commit()
    return {"ok": True}


# ── 标记已读 ──
@router.put("/{msg_id}/read")
def mark_read(msg_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = db.query(Message).filter(Message.id == msg_id, Message.recipient_id == current_user.id).first()
    if msg: msg.is_read = True; db.commit()
    return {"ok": True}


# ── 附件 ──
@router.post("/upload", response_model=AttachmentOut)
def upload(file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if file.size and file.size > 150 * 1024 * 1024: raise HTTPException(400, "≤150MB")
    
    # Read content and compute SHA-256 hash for dedup
    content = file.file.read()
    file_hash = hashlib.sha256(content).hexdigest()
    
    # Check if same hash already exists in this company
    existing = db.query(MessageAttachment).filter(
        MessageAttachment.hash == file_hash,
        MessageAttachment.company_id == current_user.company_id,
    ).first()
    
    if existing:
        # Dedup: reuse existing file, just create new DB record
        att = MessageAttachment(
            company_id=current_user.company_id, message_id=0,
            filename=file.filename or "file", filepath=existing.filepath,
            size=len(content), mime_type=file.content_type or "",
            hash=file_hash,
        )
    else:
        # New file: save to disk with hash-based name
        ext = os.path.splitext(file.filename or "")[1]
        save_name = f"{file_hash[:16]}{ext}"
        save_path = os.path.join(MAIL_UPLOAD, save_name)
        if not os.path.exists(save_path):
            with open(save_path, "wb") as f: f.write(content)
        att = MessageAttachment(
            company_id=current_user.company_id, message_id=0,
            filename=file.filename or "file", filepath=save_name,
            size=len(content), mime_type=file.content_type or "",
            hash=file_hash,
        )
    
    db.add(att); db.commit(); db.refresh(att)
    return att

@router.get("/attachments/{msg_id}", response_model=List[AttachmentOut])
def get_attachments(msg_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(MessageAttachment).filter(MessageAttachment.message_id == msg_id, MessageAttachment.company_id == current_user.company_id).all()

@router.get("/attachment/{att_id}")
def download(att_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    att = db.query(MessageAttachment).filter(MessageAttachment.id == att_id, MessageAttachment.company_id == current_user.company_id).first()
    if not att: raise HTTPException(404)
    from fastapi.responses import FileResponse
    return FileResponse(os.path.join(MAIL_UPLOAD, att.filepath), filename=att.filename)

@router.put("/attach/{att_id}/link/{msg_id}")
def link(att_id: int, msg_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    att = db.query(MessageAttachment).filter(MessageAttachment.id == att_id, MessageAttachment.company_id == current_user.company_id).first()
    if not att: raise HTTPException(404)
    att.message_id = msg_id; db.commit()
    return {"ok": True}
