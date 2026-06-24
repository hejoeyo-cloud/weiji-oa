"""定时数据库备份（仅 SQLite）"""
import os
import shutil
from datetime import datetime, timedelta

from config import PROJECT_DIR

BACKUP_DIR = os.path.join(PROJECT_DIR, "backups")
DB_PATH = os.path.join(PROJECT_DIR, "data.db")
KEEP_DAYS = 30


def backup_database():
    """复制 data.db 到 backups/ 目录，保留最近 30 天"""
    if not os.path.exists(DB_PATH):
        return

    os.makedirs(BACKUP_DIR, exist_ok=True)

    today = datetime.now().strftime("%Y%m%d")
    dest = os.path.join(BACKUP_DIR, f"data_{today}.db")

    # 当天已备份则跳过
    if os.path.exists(dest):
        return

    try:
        shutil.copy2(DB_PATH, dest)
        print(f"[backup] 数据库已备份: {dest}")
    except Exception as e:
        print(f"[backup] 备份失败: {e}")

    # 清理旧备份
    cutoff = datetime.now() - timedelta(days=KEEP_DAYS)
    for fname in os.listdir(BACKUP_DIR):
        if not fname.startswith("data_") or not fname.endswith(".db"):
            continue
        fpath = os.path.join(BACKUP_DIR, fname)
        try:
            date_str = fname.replace("data_", "").replace(".db", "")
            file_date = datetime.strptime(date_str, "%Y%m%d")
            if file_date < cutoff:
                os.remove(fpath)
                print(f"[backup] 已清理旧备份: {fname}")
        except (ValueError, OSError):
            pass
