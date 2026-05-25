import os
import json
from datetime import datetime

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    from models.init_db import init_db
    from seed_data import seed_knowledge
    init_db()
    seed_knowledge()
    yield

from middleware.rate_limit import RateLimitMiddleware
from middleware.company_guard import company_guard
from middleware.request_log import request_log_middleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import WebSocket, WebSocketDisconnect

from config import UPLOAD_DIR, CORS_ORIGINS, SERVER_HOST, SERVER_PORT
from database import SessionLocal, User
from models.init_db import init_db
from seed_data import seed_knowledge
from auth import get_current_user
from routers import (
    auth_router, ticket_router, user_router,
    upload_router, knowledge_router,
    notification_router,
)
from routers import department_router, gift_router
from routers import audit_log_router, announcement_router, approval_router
from routers import schedule_router, gift_resend_router
from routers import role_router
from routers import dashboard_router
from routers import warehouse_router
from routers import return_exchange_router, repair_router
from routers import gift_cashback_router
from routers import billing_router, platform_router
from routers import attendance_router
from routers import task_router
from routers import report_router
from routers import dingtalk_router
from routers import module_config_router
from routers import messages_router
from routers import approval_rules_router
import finance_router
from seed_data import seed_knowledge
from websocket.manager import manager

from contextlib import asynccontextmanager


app = FastAPI(title="Fries OA 内部系统", version="1.0.0", lifespan=lifespan)

app.add_middleware(RateLimitMiddleware, max_requests=60, window_seconds=60)
app.middleware("http")(request_log_middleware)
app.middleware("http")(company_guard)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(ticket_router.router)
app.include_router(user_router.router)
app.include_router(upload_router.router)
app.include_router(knowledge_router.router)
app.include_router(notification_router.router)
app.include_router(department_router.router)
app.include_router(gift_router.router)
app.include_router(audit_log_router.router)
app.include_router(announcement_router.router)
app.include_router(approval_router.router)
app.include_router(schedule_router.router)
app.include_router(gift_resend_router.router)
app.include_router(role_router.router)
app.include_router(dashboard_router.router)
app.include_router(warehouse_router.router)
app.include_router(return_exchange_router.router)
app.include_router(repair_router.router)
app.include_router(gift_cashback_router.router)
app.include_router(billing_router.router)
app.include_router(platform_router.router)
app.include_router(attendance_router.router)
app.include_router(task_router.router)
app.include_router(report_router.router)
app.include_router(dingtalk_router.router)
app.include_router(module_config_router.router)
app.include_router(messages_router.router)
app.include_router(approval_rules_router.router)
# ── WebSocket 实时推送 ──────────────────────────────────────────────
from websocket.manager import manager as ws_manager

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket, user_id: int):
    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except:
        ws_manager.disconnect(user_id)

app.include_router(finance_router.router, prefix="/api")


@app.middleware("http")
async def subscription_write_guard(request, call_next):
    path = request.url.path
    if (
        request.method in ("POST", "PUT", "PATCH", "DELETE")
        and path.startswith("/api/")
        and not path.startswith("/api/auth/")
        and not path.startswith("/api/billing/")
        and not path.startswith("/api/platform/")
        and not path.startswith("/api/attendance/")
        and not path.startswith("/api/tasks/")
        and not path.startswith("/api/reports/")
        and path != "/api/upload"
    ):
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            from jose import JWTError, jwt
            from config import JWT_SECRET, JWT_ALGORITHM
            from auth import get_subscription_state

            token = auth_header.split(" ", 1)[1]
            db = SessionLocal()
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                user = db.query(User).filter(User.id == payload.get("user_id")).first()
                if user and not user.is_platform_admin:
                    state = get_subscription_state(db, user)
                    if not state["is_writable"]:
                        return JSONResponse(
                            status_code=402,
                            content={"detail": "订阅已到期，请续费后继续使用"},
                        )
            except JWTError:
                pass
            finally:
                db.close()
    return await call_next(request)


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(user_id)


@app.get("/api/upload/{filename}")
def serve_upload(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(filepath):
        return FileResponse(filepath)
    return {"error": "File not found"}


frontend_dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"error": "Frontend not built"}


from contextlib import asynccontextmanager



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=SERVER_HOST, port=SERVER_PORT, reload=True)
