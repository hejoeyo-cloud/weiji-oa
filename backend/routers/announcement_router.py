from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
import json

from database import get_db, Announcement, AnnouncementRead, User, Department
from schemas import AnnouncementCreate, AnnouncementUpdate, AnnouncementOut
from auth import get_current_user, require_admin
from services import audit_service

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


def ann_to_out(a: Announcement, user_id: int = 0, db: Session = None) -> AnnouncementOut:
    # 检查当前用户是否已读
    is_read = False
    if user_id and db:
        read_record = db.query(AnnouncementRead).filter(
            AnnouncementRead.announcement_id == a.id,
            AnnouncementRead.user_id == user_id,
            AnnouncementRead.company_id == a.company_id,
        ).first()
        is_read = read_record is not None

    # 解析目标部门
    target_depts = []
    target_dept_names = ""
    if a.target_departments:
        try:
            target_depts = json.loads(a.target_departments)
            if target_depts and db:
                depts = db.query(Department).filter(Department.id.in_(target_depts), Department.company_id == a.company_id).all()
                target_dept_names = "，".join([d.name for d in depts])
        except:
            target_depts = []

    return AnnouncementOut(
        id=a.id, title=a.title, content=a.content,
        is_pinned=a.is_pinned, is_active=a.is_active,
        target_departments=target_depts,
        target_department_names=target_dept_names,
        created_by=a.created_by,
        author_name=a.author.name if a.author else "",
        created_at=a.created_at, updated_at=a.updated_at,
        is_read=is_read,
    )


@router.get("", response_model=dict)
def list_announcements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Announcement).filter(Announcement.company_id == current_user.company_id)
    if active_only:
        query = query.filter(Announcement.is_active == True)

    # 按部门筛选：管理员看到所有公告，普通用户只看全员或自己部门的公告
    if current_user.role != "admin":
        user_dept_id = current_user.department_id
        from sqlalchemy import or_, and_
        dept_filter = or_(
            Announcement.target_departments == "",  # 全员公告
            Announcement.target_departments == None,
            # 检查用户部门是否在目标部门列表中
            and_(
                user_dept_id is not None,
                Announcement.target_departments.like(f'%" {user_dept_id}"%'),  # 简单匹配
            ),
        )
        # 更精确的匹配：解析JSON
        all_anns = query.all()
        visible_ids = []
        for a in all_anns:
            if not a.target_departments:
                visible_ids.append(a.id)  # 全员公告
            else:
                try:
                    targets = json.loads(a.target_departments)
                    if user_dept_id and user_dept_id in targets:
                        visible_ids.append(a.id)
                except:
                    visible_ids.append(a.id)
        query = query.filter(Announcement.id.in_(visible_ids)) if visible_ids else query.filter(Announcement.id == 0)

    total = query.count()
    # 置顶优先，再按时间倒序
    items = query.order_by(
        Announcement.is_pinned.desc(), Announcement.created_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [ann_to_out(a, current_user.id, db) for a in items],
    }


@router.get("/unread/count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的未读公告数量"""
    query = db.query(Announcement).filter(
        Announcement.is_active == True,
        Announcement.company_id == current_user.company_id,
        Announcement.id.not_in(select(AnnouncementRead.announcement_id).where(
            AnnouncementRead.user_id == current_user.id,
            AnnouncementRead.company_id == current_user.company_id,
        )),
    )

    # 按部门筛选
    if current_user.role != "admin":
        user_dept_id = current_user.department_id
        all_anns = query.all()
        visible_ids = []
        for a in all_anns:
            if not a.target_departments:
                visible_ids.append(a.id)
            else:
                try:
                    targets = json.loads(a.target_departments)
                    if user_dept_id and user_dept_id in targets:
                        visible_ids.append(a.id)
                except:
                    visible_ids.append(a.id)
        unread = len(visible_ids)
    else:
        unread = query.count()

    return {"unread_count": unread}


@router.get("/{ann_id}", response_model=AnnouncementOut)
def get_announcement(
    ann_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = db.query(Announcement).filter(Announcement.id == ann_id, Announcement.company_id == current_user.company_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return ann_to_out(a, current_user.id, db)


@router.post("", response_model=AnnouncementOut)
def create_announcement(
    req: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    a = Announcement(
        company_id=current_user.company_id,
        title=req.title, content=req.content,
        is_pinned=req.is_pinned,
        target_departments=json.dumps(req.target_departments) if req.target_departments else "",
        created_by=current_user.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    audit_service.log(db, current_user, "create", "announcement", a.id,
                      f"发布公告: {a.title}")
    return ann_to_out(a, current_user.id, db)


@router.put("/{ann_id}", response_model=AnnouncementOut)
def update_announcement(
    ann_id: int,
    req: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    a = db.query(Announcement).filter(Announcement.id == ann_id, Announcement.company_id == current_user.company_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Announcement not found")
    data = req.model_dump(exclude_none=True)
    if "target_departments" in data:
        data["target_departments"] = json.dumps(data["target_departments"]) if data["target_departments"] else ""
    for field, value in data.items():
        setattr(a, field, value)
    db.commit()
    db.refresh(a)
    audit_service.log(db, current_user, "update", "announcement", ann_id,
                      f"更新公告: {a.title}")
    return ann_to_out(a, current_user.id, db)


@router.delete("/{ann_id}")
def delete_announcement(
    ann_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    a = db.query(Announcement).filter(Announcement.id == ann_id, Announcement.company_id == current_user.company_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Announcement not found")
    audit_service.log(db, current_user, "delete", "announcement", ann_id,
                      f"删除公告: {a.title}")
    db.delete(a)
    db.commit()
    return {"message": "OK"}


@router.post("/{ann_id}/read")
def mark_announcement_read(
    ann_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """标记公告为已读"""
    a = db.query(Announcement).filter(Announcement.id == ann_id, Announcement.company_id == current_user.company_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Announcement not found")
    existing = db.query(AnnouncementRead).filter(
        AnnouncementRead.announcement_id == ann_id,
        AnnouncementRead.user_id == current_user.id,
        AnnouncementRead.company_id == current_user.company_id,
    ).first()
    if not existing:
        read_record = AnnouncementRead(
            company_id=current_user.company_id,
            announcement_id=ann_id,
            user_id=current_user.id,
        )
        db.add(read_record)
        db.commit()
    return {"message": "OK"}
