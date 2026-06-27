"""定时数据库备份 — 支持 SQLite 和 PostgreSQL"""
import os
import shutil
import subprocess
from datetime import datetime, timedelta

from config import PROJECT_DIR, DATABASE_URL

BACKUP_DIR = os.path.join(PROJECT_DIR, "backups")
DB_PATH = os.path.join(PROJECT_DIR, "data.db")
KEEP_DAYS = 30

_is_postgres = "postgresql" in DATABASE_URL


def _cleanup_old_backups(ext: str):
    """清理超过 KEEP_DAYS 天的旧备份"""
    cutoff = datetime.now() - timedelta(days=KEEP_DAYS)
    for fname in os.listdir(BACKUP_DIR):
        if not fname.startswith("data_") or not fname.endswith(ext):
            continue
        fpath = os.path.join(BACKUP_DIR, fname)
        try:
            date_str = fname.replace("data_", "").replace(ext, "")
            file_date = datetime.strptime(date_str, "%Y%m%d")
            if file_date < cutoff:
                os.remove(fpath)
                print(f"[backup] 已清理旧备份: {fname}")
        except (ValueError, OSError):
            pass


def _backup_sqlite():
    """SQLite：复制 data.db 文件"""
    if not os.path.exists(DB_PATH):
        return
    today = datetime.now().strftime("%Y%m%d")
    dest = os.path.join(BACKUP_DIR, f"data_{today}.db")
    if os.path.exists(dest):
        return
    try:
        shutil.copy2(DB_PATH, dest)
        print(f"[backup] SQLite 已备份: {dest}")
    except Exception as e:
        print(f"[backup] SQLite 备份失败: {e}")
    _cleanup_old_backups(".db")


def _backup_postgres():
    """PostgreSQL：调用 pg_dump 导出 SQL"""
    today = datetime.now().strftime("%Y%m%d")
    dest = os.path.join(BACKUP_DIR, f"data_{today}.sql")
    if os.path.exists(dest):
        return
    try:
        env = os.environ.copy()
        result = subprocess.run(
            ["pg_dump", DATABASE_URL, "--no-owner", "--no-privileges", "-f", dest],
            capture_output=True, text=True, timeout=300, env=env,
        )
        if result.returncode == 0:
            print(f"[backup] PostgreSQL 已备份: {dest}")
        else:
            print(f"[backup] PostgreSQL 备份失败: {result.stderr}")
    except FileNotFoundError:
        print("[backup] pg_dump 未安装，跳过 PostgreSQL 备份")
    except Exception as e:
        print(f"[backup] PostgreSQL 备份失败: {e}")
    _cleanup_old_backups(".sql")


def backup_database():
    """自动检测数据库类型并备份"""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    if _is_postgres:
        _backup_postgres()
    else:
        _backup_sqlite()
