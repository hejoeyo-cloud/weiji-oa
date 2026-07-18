"""版本信息读取"""
import json
import os
from config import PROJECT_DIR

VERSION_FILE = os.path.join(PROJECT_DIR, "version.json")


def get_current_version() -> dict:
    """读取当前版本信息，如果文件不存在则返回默认值"""
    if os.path.exists(VERSION_FILE):
        try:
            with open(VERSION_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {"version": "0.0.0", "release_date": ""}


def save_current_version(version_info: dict):
    """保存版本信息到文件"""
    with open(VERSION_FILE, "w", encoding="utf-8") as f:
        json.dump(version_info, f, indent=2, ensure_ascii=False)
