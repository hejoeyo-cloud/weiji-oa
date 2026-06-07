from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db, AuditLog, User
from schemas import AuditLogOut
from auth import require_admin

router = APIRouter(prefix="/api/audit-logs", tags=["audit_logs"])

RETENTION_MONTHS = 3


@router.get("", response_model=dict)
def list_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    resource_type: str = Query("", description="Filter by resource type"),
    action: str = Query("", description="Filter by action"),
    username: str = Query("", description="Filter by username"),
    start_date: str = Query("", description="Start date (YYYY-MM-DD)"),
    end_date: str = Query("", description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(AuditLog)
    if not current_user.is_platform_admin:
        query = query.filter(AuditLog.company_id == current_user.company_id)

    # 默认只返回最近3个月的记录
    retention_cutoff = datetime.now() - timedelta(days=RETENTION_MONTHS * 30)
    query = query.filter(AuditLog.created_at >= retention_cutoff)

    if start_date:
        try:
            query = query.filter(AuditLog.created_at >= datetime.strptime(start_date, "%Y-%m-%d"))
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(AuditLog.created_at < end_dt)
        except ValueError:
            pass
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if action:
        query = query.filter(AuditLog.action == action)
    if username:
        query = query.filter(AuditLog.username.like(f"%{username}%"))
    total = query.count()
    items = query.order_by(AuditLog.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [
            AuditLogOut(
                id=log.id, user_id=log.user_id, username=log.username,
                action=log.action, resource_type=log.resource_type,
                resource_id=log.resource_id, detail=log.detail,
                ip_address=log.ip_address, created_at=log.created_at,
            )
            for log in items
        ],
    }
