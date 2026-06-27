"""数据清理策略：audit_logs 归档 + notifications 清理"""
from datetime import datetime, timedelta
from sqlalchemy import text
from models.base import engine, SessionLocal
from models.audit import AuditLog, AuditLogArchive
from models.notification import Notification


def cleanup_audit_logs(months: int = 6):
    """将超过 N 个月的操作日志归档到 audit_logs_archive 表"""
    db = SessionLocal()
    try:
        cutoff = datetime.now() - timedelta(days=months * 30)

        # 确保归档表存在
        with engine.connect() as conn:
            dialect = engine.dialect.name
            if dialect == "postgresql":
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS audit_logs_archive (
                        id SERIAL PRIMARY KEY,
                        company_id INTEGER,
                        user_id INTEGER,
                        username VARCHAR(50) DEFAULT '',
                        action VARCHAR(50) DEFAULT '',
                        resource_type VARCHAR(50) DEFAULT '',
                        resource_id INTEGER,
                        detail TEXT DEFAULT '',
                        changes JSONB DEFAULT '{}'::jsonb,
                        ip_address VARCHAR(50) DEFAULT '',
                        created_at TIMESTAMP,
                        archived_at TIMESTAMP
                    )
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS audit_logs_archive (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        company_id INTEGER,
                        user_id INTEGER,
                        username VARCHAR(50) DEFAULT '',
                        action VARCHAR(50) DEFAULT '',
                        resource_type VARCHAR(50) DEFAULT '',
                        resource_id INTEGER,
                        detail TEXT DEFAULT '',
                        changes TEXT DEFAULT '{}',
                        ip_address VARCHAR(50) DEFAULT '',
                        created_at DATETIME,
                        archived_at DATETIME
                    )
                """))
            conn.commit()

        # 查询待归档记录
        old_logs = db.query(AuditLog).filter(AuditLog.created_at < cutoff).all()
        if not old_logs:
            print(f"[cleanup] audit_logs: 无超过 {months} 个月的记录")
            return

        # 复制到归档表
        archived_count = 0
        for log in old_logs:
            archive = AuditLogArchive(
                id=log.id,
                company_id=log.company_id,
                user_id=log.user_id,
                username=log.username,
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                detail=log.detail,
                changes=log.changes,
                ip_address=log.ip_address,
                created_at=log.created_at,
                archived_at=datetime.now(),
            )
            db.add(archive)
            archived_count += 1

        # 批量提交归档
        db.commit()

        # 删除原表中已归档的记录
        deleted = db.query(AuditLog).filter(AuditLog.created_at < cutoff).delete()
        db.commit()

        print(f"[cleanup] audit_logs: 归档 {archived_count} 条，删除 {deleted} 条（超过 {months} 个月）")

    except Exception as e:
        db.rollback()
        print(f"[cleanup] audit_logs 归档失败: {e}")
    finally:
        db.close()


def cleanup_notifications():
    """清理过期通知：已读超过 30 天 + 未读超过 90 天"""
    db = SessionLocal()
    try:
        now = datetime.now()

        # 已读超过 30 天
        read_cutoff = now - timedelta(days=30)
        read_deleted = db.query(Notification).filter(
            Notification.is_read == True,
            Notification.created_at < read_cutoff,
        ).delete()

        # 未读超过 90 天
        unread_cutoff = now - timedelta(days=90)
        unread_deleted = db.query(Notification).filter(
            Notification.is_read == False,
            Notification.created_at < unread_cutoff,
        ).delete()

        db.commit()

        total = read_deleted + unread_deleted
        if total > 0:
            print(f"[cleanup] notifications: 清理 {read_deleted} 条已读(>30天) + {unread_deleted} 条未读(>90天)")
        else:
            print("[cleanup] notifications: 无需清理")

    except Exception as e:
        db.rollback()
        print(f"[cleanup] notifications 清理失败: {e}")
    finally:
        db.close()


def run_all_cleanup():
    """执行所有清理任务"""
    print("[cleanup] 开始数据清理...")
    cleanup_audit_logs()
    cleanup_notifications()
    print("[cleanup] 数据清理完成")
