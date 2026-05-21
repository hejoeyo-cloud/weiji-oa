import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)

DATABASE_URL = f"sqlite:///{os.path.join(PROJECT_DIR, 'data.db')}"

UPLOAD_DIR = os.path.join(PROJECT_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

JWT_SECRET = "laptop-support-secret-key-2024-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 480

# 内网部署时，修改为你的内网IP地址，例如：
CORS_ORIGINS = [
    "http://192.168.1.100:5173",  # 修改为实际内网IP
    "http://192.168.1.100:8000",
    "http://localhost:5173",
    "http://localhost:8000",
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
