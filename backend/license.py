"""授权验证核心模块"""
import hashlib
import json
import os
import platform
import subprocess
import base64
from datetime import date, datetime
from typing import Optional

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from config import PROJECT_DIR

LICENSE_FILE = os.path.join(PROJECT_DIR, "license.lic")
PUBLIC_KEY_PATH = os.path.join(os.path.dirname(__file__), "keys", "public.pem")

# 生产模式下必须有 license 文件（部署包里设置 LICENSE_REQUIRED=1）
LICENSE_REQUIRED = os.getenv("LICENSE_REQUIRED", "0") == "1"

# Grace 期：过期后仍可只读访问的天数
GRACE_DAYS = 7
# 到期提醒天数
WARNING_DAYS = 15


def _collect_fingerprint() -> str:
    """采集本机硬件指纹"""
    parts = []

    # 主机名
    parts.append(platform.node())

    # MAC 地址
    try:
        if platform.system() == "Darwin":
            out = subprocess.check_output(
                ["ifconfig", "en0"], timeout=5, stderr=subprocess.DEVNULL
            ).decode()
            for line in out.split("\n"):
                if "ether" in line:
                    parts.append(line.split("ether")[1].strip())
                    break
        elif platform.system() == "Linux":
            out = subprocess.check_output(
                ["cat", "/sys/class/net/eth0/address"], timeout=5, stderr=subprocess.DEVNULL
            ).decode().strip()
            parts.append(out)
        elif platform.system() == "Windows":
            out = subprocess.check_output(
                ["getmac", "/nh"], timeout=5, stderr=subprocess.DEVNULL
            ).decode()
            for line in out.strip().split("\n"):
                mac = line.strip().split()[0].replace("-", ":")
                if mac and mac != "N/A":
                    parts.append(mac)
                    break
    except Exception:
        pass

    # CPU 信息
    parts.append(platform.processor() or platform.machine())

    # 组合后取 SHA256
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _load_public_key():
    """加载公钥"""
    if not os.path.exists(PUBLIC_KEY_PATH):
        return None
    with open(PUBLIC_KEY_PATH, "rb") as f:
        return serialization.load_pem_public_key(f.read())


def load_license() -> Optional[dict]:
    """读取并验证 license 文件，返回 payload 或 None"""
    if not os.path.exists(LICENSE_FILE):
        return None

    try:
        with open(LICENSE_FILE, "r", encoding="utf-8") as f:
            license_obj = json.load(f)
    except (json.JSONDecodeError, IOError):
        return None

    payload = license_obj.get("payload")
    sig_b64 = license_obj.get("signature")
    if not payload or not sig_b64:
        return None

    # 验签
    public_key = _load_public_key()
    if not public_key:
        return None

    data = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
    signature = base64.b64decode(sig_b64)

    try:
        public_key.verify(signature, data, padding.PKCS1v15(), hashes.SHA256())
    except Exception:
        return None

    # 验证机器指纹
    expected_fp = payload.get("machine_fingerprint", "")
    if expected_fp and expected_fp != _collect_fingerprint():
        return None

    return payload


def get_license_status() -> dict:
    """获取授权状态

    返回:
        {
            "valid": bool,
            "status": "valid" | "expiring" | "expired" | "locked" | "no_license",
            "company": str,
            "expires_at": str,
            "days_remaining": int,
            "max_users": int,
            "modules": list,
            "message": str,
        }
    """
    payload = load_license()

    if not payload:
        if LICENSE_REQUIRED:
            # 生产模式：没有 license → 锁定
            return {
                "valid": False,
                "status": "locked",
                "company": "",
                "expires_at": "",
                "days_remaining": 0,
                "max_users": 0,
                "modules": [],
                "message": "未检测到授权文件，系统已锁定，请联系管理员获取授权",
            }
        # 开发模式：没有 license → 允许使用
        return {
            "valid": True,
            "status": "dev",
            "company": "开发模式",
            "expires_at": "",
            "days_remaining": -1,
            "max_users": 0,
            "modules": [],
            "message": "未检测到授权文件，当前为开发模式",
        }

    today = date.today()
    expires_str = payload.get("expires_at", "")
    company = payload.get("company", "")
    max_users = payload.get("max_users", 0)
    modules = payload.get("modules", [])

    try:
        expires_at = date.fromisoformat(expires_str)
    except (ValueError, TypeError):
        return {
            "valid": False,
            "status": "locked",
            "company": company,
            "expires_at": expires_str,
            "days_remaining": 0,
            "max_users": max_users,
            "modules": modules,
            "message": "授权文件格式错误",
        }

    days_remaining = (expires_at - today).days

    if days_remaining > WARNING_DAYS:
        return {
            "valid": True,
            "status": "valid",
            "company": company,
            "expires_at": expires_str,
            "days_remaining": days_remaining,
            "max_users": max_users,
            "modules": modules,
            "message": "",
        }
    elif days_remaining > 0:
        return {
            "valid": True,
            "status": "expiring",
            "company": company,
            "expires_at": expires_str,
            "days_remaining": days_remaining,
            "max_users": max_users,
            "modules": modules,
            "message": f"授权将于 {days_remaining} 天后到期，请及时续期",
        }
    elif days_remaining > -GRACE_DAYS:
        return {
            "valid": True,
            "status": "expired",
            "company": company,
            "expires_at": expires_str,
            "days_remaining": days_remaining,
            "max_users": max_users,
            "modules": modules,
            "message": f"授权已过期 {abs(days_remaining)} 天，系统处于只读模式（{GRACE_DAYS} 天后将锁定）",
        }
    else:
        return {
            "valid": False,
            "status": "locked",
            "company": company,
            "expires_at": expires_str,
            "days_remaining": days_remaining,
            "max_users": max_users,
            "modules": modules,
            "message": "授权已过期，系统已锁定，请联系管理员续期",
        }


def is_write_allowed() -> bool:
    """是否允许写操作"""
    status = get_license_status()["status"]
    return status in ("valid", "expiring", "dev")


def is_login_allowed() -> bool:
    """是否允许登录"""
    status = get_license_status()["status"]
    return status != "locked"


def get_fingerprint() -> str:
    """获取本机指纹（供使用者提供给你生成授权）"""
    return _collect_fingerprint()
