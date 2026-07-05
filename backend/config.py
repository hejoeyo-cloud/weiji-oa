import os
import sys


def _get_project_dir():
    """获取项目根目录（数据目录）。

    开发模式：源码所在目录的上一级（config.py 在 backend/ 下）。
    PyInstaller 打包后：可执行文件所在目录，数据文件与部署包放在一起。
    """
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _get_bundle_dir():
    """获取资源包目录。

    PyInstaller 单文件模式将资源解压到临时目录（sys._MEIPASS），
    前端静态文件、public.pem 等打包资源从此读取。开发模式返回项目根目录。
    """
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = _get_project_dir()
BUNDLE_DIR = _get_bundle_dir()

# 数据库：默认 SQLite，设 DATABASE_URL 环境变量可切换 PostgreSQL
# 示例: export DATABASE_URL=postgresql://user:pass@host:5432/fries_oa
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(PROJECT_DIR, 'data.db').replace(chr(92), '/')}")

UPLOAD_DIR = os.path.join(PROJECT_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

import secrets as _secrets

_jwt = os.getenv("JWT_SECRET")
if not _jwt:
    # 尝试从持久化文件中读取（生产环境自动生成后保存）
    _jwt_file = os.path.join(PROJECT_DIR, ".jwt_secret")
    if os.path.exists(_jwt_file):
        with open(_jwt_file, "r") as f:
            _jwt = f.read().strip()
    if not _jwt:
        # 首次启动：自动生成随机密钥并持久化
        _jwt = _secrets.token_hex(32)
        try:
            with open(_jwt_file, "w") as f:
                f.write(_jwt)
        except Exception:
            pass  # 写文件失败也不影响运行
JWT_SECRET = _jwt
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

# 内网部署时，用 CORS_ORIGINS 环境变量覆盖允许来源（逗号分隔）
# 默认允许所有来源，方便局域网内其他设备访问
CORS_ORIGINS = [
    o.strip() for o in os.getenv(
        "CORS_ORIGINS",
        "*"
    ).split(",")
]

SERVER_HOST = "0.0.0.0"
SERVER_PORT = 8000

# ── 本地版：无订阅/计费配置 ──────────────────────────────
