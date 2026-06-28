import os
import json
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    from models.init_db import init_db
    from seed_data import seed_knowledge
    from license import get_license_status
    init_db()
    seed_knowledge()

    # 启动时检查授权状态
    lic = get_license_status()
    print(f"[license] 授权状态: {lic['status']} | 公司: {lic['company']} | 到期: {lic['expires_at'] or '无'}")
    if lic["message"]:
        print(f"[license] {lic['message']}")

    # 启动定时任务（每天凌晨3点备份，4点清理）
    from apscheduler.schedulers.background import BackgroundScheduler
    from backup import backup_database
    from services.data_cleanup import run_all_cleanup
    scheduler = BackgroundScheduler()
    scheduler.add_job(backup_database, "cron", hour=3, minute=0, id="db_backup")
    scheduler.add_job(run_all_cleanup, "cron", hour=4, minute=0, id="data_cleanup")
    scheduler.start()
    # 启动时立即执行一次备份
    backup_database()

    yield

    scheduler.shutdown()

from middleware.rate_limit import RateLimitMiddleware
from middleware.request_log import request_log_middleware
from middleware.license_guard import LicenseGuardMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import WebSocket, WebSocketDisconnect

from config import CORS_ORIGINS, SERVER_HOST, SERVER_PORT
from storage import get_storage
storage = get_storage()
from database import SessionLocal, User
from models.init_db import init_db
from seed_data import seed_knowledge
from auth import get_current_user, get_current_user_flexible
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
from routers import gift_preset_router
from routers import gift_resend_preset_router
from routers import attendance_router
from routers import task_router
from routers import report_router
from routers import dingtalk_router
from routers import module_config_router
from routers import messages_router
from routers import shop_router
from routers import approval_rules_router
from routers import field_option_router
from routers import sidebar_badge_router
from routers import product_router
from routers import finance_router
from routers import license_router
from routers import customer_router
from websocket.manager import manager

app = FastAPI(title="微迹OA 内部系统", version="1.0.0", lifespan=lifespan)

app.add_middleware(RateLimitMiddleware, max_requests=600, window_seconds=60, burst_max=30)
app.add_middleware(LicenseGuardMiddleware)
app.middleware("http")(request_log_middleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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
app.include_router(gift_preset_router.router)
app.include_router(gift_resend_preset_router.router)
app.include_router(attendance_router.router)
app.include_router(task_router.router)
app.include_router(report_router.router)
app.include_router(dingtalk_router.router)
app.include_router(module_config_router.router)
app.include_router(messages_router.router)
app.include_router(shop_router.router)
app.include_router(approval_rules_router.router)
app.include_router(field_option_router.router)
app.include_router(sidebar_badge_router.router)
app.include_router(product_router.router)
app.include_router(finance_router.router)
app.include_router(license_router.router)
app.include_router(customer_router.router)


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


@app.get("/api/files/{filepath:path}")
def serve_file(filepath: str, current_user: User = Depends(get_current_user_flexible)):
    """通过存储抽象层提供文件下载 / 展示"""
    try:
        content = storage.read(filepath)
        import mimetypes
        mime_type, _ = mimetypes.guess_type(filepath)
        from fastapi.responses import Response
        headers = {"Content-Disposition": f'inline; filename="{os.path.basename(filepath)}"'}
        return Response(content=content, media_type=mime_type or "application/octet-stream", headers=headers)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")


frontend_dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"error": "Frontend not built"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=SERVER_HOST,
        port=SERVER_PORT,
    )
