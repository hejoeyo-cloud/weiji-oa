from sqlalchemy.orm import Session
from database import AuditLog, User


def log(
    db: Session,
    user: User,
    action: str,
    resource_type: str,
    resource_id: int = None,
    detail: str = "",
    ip_address: str = "",
):
    """记录操作日志（非阻塞，失败不影响主流程）"""
    try:
        entry = AuditLog(
            company_id=user.company_id if user else None,
            user_id=user.id if user else None,
            username=user.username if user else "",
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail,
            ip_address=ip_address,
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        print(f"[audit_service] Failed to log: {e}")
