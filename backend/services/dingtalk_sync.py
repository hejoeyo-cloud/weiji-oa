"""
钉钉考勤数据同步服务
使用经典 OAPI 接口：https://open.dingtalk.com/document/orgapp-server/attendance-clock-in-record-is-open
"""
from datetime import datetime, timedelta
from typing import Optional
import json
import time

import requests
from sqlalchemy.orm import Session

from database import DingtalkConfig, AttendanceRecord, User


def _get_access_token(config: DingtalkConfig) -> Optional[str]:
    """获取钉钉 access_token"""
    if not config.app_key or not config.app_secret:
        return None
    try:
        resp = requests.get(
            "https://oapi.dingtalk.com/gettoken",
            params={"appkey": config.app_key, "appsecret": config.app_secret},
            timeout=10,
        )
        data = resp.json()
        if data.get("errcode") == 0:
            return data["access_token"]
        return None
    except Exception:
        return None


def _get_user_ids_by_dingtalk(db: Session, company_id: int) -> dict[str, int]:
    """获取公司内已绑定钉钉的用户映射: dingtalk_user_id -> local user_id"""
    users = db.query(User).filter(
        User.company_id == company_id,
        User.dingtalk_user_id.isnot(None),
        User.dingtalk_user_id != "",
    ).all()
    return {u.dingtalk_user_id: u.id for u in users}


def sync_attendance_for_company(db: Session, company_id: int) -> dict:
    """同步单个公司的钉钉考勤数据"""
    config = db.query(DingtalkConfig).filter(
        DingtalkConfig.company_id == company_id,
        DingtalkConfig.enabled == True,
    ).first()
    if not config:
        return {"ok": False, "error": "钉钉配置未启用"}

    token = _get_access_token(config)
    if not token:
        return {"ok": False, "error": "获取钉钉 access_token 失败，请检查 AppKey 和 AppSecret"}

    user_map = _get_user_ids_by_dingtalk(db, company_id)
    if not user_map:
        return {"ok": False, "error": "公司内没有员工绑定钉钉账号"}

    # 同步最近7天的数据
    today = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

    synced = 0
    skipped = 0
    overwrote = 0
    errors = []

    for dingtalk_uid, local_uid in user_map.items():
        try:
            resp = requests.post(
                "https://oapi.dingtalk.com/attendance/listRecord",
                json={
                    "userIds": [dingtalk_uid],
                    "checkDateFrom": start_date + " 00:00:00",
                    "checkDateTo": today + " 23:59:59",
                },
                params={"access_token": token},
                timeout=30,
            )
            data = resp.json()
            if data.get("errcode") != 0:
                errors.append(f"用户 {dingtalk_uid}: {data.get('errmsg', 'unknown')}")
                continue

            records = data.get("recordresult", [])
            for r in records:
                record_date = datetime.fromtimestamp(
                    r.get("userCheckTime", 0) / 1000
                ).strftime("%Y-%m-%d")

                # 检查是否已有钉钉同步记录（不重复处理）
                existing_dt = db.query(AttendanceRecord).filter(
                    AttendanceRecord.user_id == local_uid,
                    AttendanceRecord.date == record_date,
                    AttendanceRecord.source == "dingtalk",
                    AttendanceRecord.company_id == company_id,
                ).first()
                if existing_dt:
                    skipped += 1
                    continue

                # 钉钉优先级高于手动打卡：删除同一天的手动记录
                manual_records = db.query(AttendanceRecord).filter(
                    AttendanceRecord.user_id == local_uid,
                    AttendanceRecord.date == record_date,
                    AttendanceRecord.source == "manual",
                    AttendanceRecord.company_id == company_id,
                ).all()
                for mr in manual_records:
                    db.delete(mr)
                    overwrote += 1

                check_type = r.get("checkType", "")
                record_time = datetime.fromtimestamp(r.get("userCheckTime", 0) / 1000)

                if check_type == "OnDuty":
                    status = "normal"
                    if record_time.hour >= 9:
                        status = "late"
                    db.add(AttendanceRecord(
                        company_id=company_id,
                        user_id=local_uid,
                        date=record_date,
                        check_in=record_time,
                        status=status,
                        source="dingtalk",
                        location=r.get("locationResult", ""),
                    ))
                    synced += 1
                elif check_type == "OffDuty":
                    day_record = db.query(AttendanceRecord).filter(
                        AttendanceRecord.user_id == local_uid,
                        AttendanceRecord.date == record_date,
                        AttendanceRecord.source == "dingtalk",
                        AttendanceRecord.company_id == company_id,
                    ).first()
                    if day_record and not day_record.check_out:
                        day_record.check_out = record_time
                        skipped += 1
                    elif not day_record:
                        db.add(AttendanceRecord(
                            company_id=company_id,
                            user_id=local_uid,
                            date=record_date,
                            check_out=record_time,
                            status="normal",
                            source="dingtalk",
                        ))
                        synced += 1
            time.sleep(0.3)  # 避免频率限制
        except Exception as e:
            errors.append(f"用户 {dingtalk_uid}: {str(e)}")

    db.commit()

    config.last_sync_at = datetime.now()
    db.commit()

    return {
        "ok": True,
        "synced": synced,
        "skipped": skipped,
        "overwrote": overwrote,
        "errors": errors[:5],
        "synced_at": config.last_sync_at.isoformat() if config.last_sync_at else None,
    }


def sync_all_enabled_companies(db: Session) -> list[dict]:
    """同步所有启用钉钉的公司"""
    configs = db.query(DingtalkConfig).filter(DingtalkConfig.enabled == True).all()
    results = []
    for config in configs:
        result = sync_attendance_for_company(db, config.company_id)
        result["company_id"] = config.company_id
        results.append(result)
    return results
