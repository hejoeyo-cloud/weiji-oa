import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)

# 数据库：默认 SQLite，设 DATABASE_URL 环境变量可切换 PostgreSQL
# 示例: export DATABASE_URL=postgresql://user:pass@host:5432/fries_oa
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(PROJECT_DIR, 'data.db')}")

UPLOAD_DIR = os.path.join(PROJECT_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

_jwt = os.getenv("JWT_SECRET")
if not _jwt:
    import warnings
    warnings.warn("⚠️ JWT_SECRET 未设置，使用开发默认值。生产环境必须配置！")
    _jwt = "fries-oa-dev-secret"
JWT_SECRET = _jwt
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

# 内网部署时，用 CORS_ORIGINS 环境变量覆盖允许来源（逗号分隔）
CORS_ORIGINS = [
    o.strip() for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:8000"
    ).split(",")
]

SERVER_HOST = "0.0.0.0"
SERVER_PORT = 8000

# ── SaaS subscription / Alipay settings ──────────────────────────────
TRIAL_DAYS = int(os.getenv("TRIAL_DAYS", "30"))
SUBSCRIPTION_GRACE_DAYS = int(os.getenv("SUBSCRIPTION_GRACE_DAYS", "7"))
FIRST_YEAR_PRICE = float(os.getenv("FIRST_YEAR_PRICE", "1599"))
RENEWAL_YEAR_PRICE = float(os.getenv("RENEWAL_YEAR_PRICE", "599"))

ALIPAY_ENV = os.getenv("ALIPAY_ENV", "sandbox")
ALIPAY_APP_ID = os.getenv("ALIPAY_APP_ID", "")
ALIPAY_PRIVATE_KEY = os.getenv("ALIPAY_PRIVATE_KEY", "")
ALIPAY_PUBLIC_KEY = os.getenv("ALIPAY_PUBLIC_KEY", "")
ALIPAY_NOTIFY_URL = os.getenv("ALIPAY_NOTIFY_URL", "")
ALIPAY_RETURN_URL = os.getenv("ALIPAY_RETURN_URL", "")
ALIPAY_GATEWAY = os.getenv(
    "ALIPAY_GATEWAY",
    "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
    if ALIPAY_ENV == "sandbox"
    else "https://openapi.alipay.com/gateway.do",
)
