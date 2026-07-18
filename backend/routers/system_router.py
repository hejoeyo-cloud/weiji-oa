"""系统管理 API（自动更新、系统状态等）"""
import threading
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user, require_permission
from database import User
from services.updater import check_for_update, apply_update, UpdaterError
from version import get_current_version

router = APIRouter(prefix="/api/system", tags=["system"])


# ── 请求模型 ─────────────────────────────────────────────────────────

class ApplyUpdateRequest(BaseModel):
    download_url: str
    sha256: str


# ── API 端点 ─────────────────────────────────────────────────────────

@router.get("/status")
def system_status(current_user: User = Depends(get_current_user)):
    """获取系统版本及运行状态（登录后可用）"""
    from config import AUTO_UPDATE_ENABLED, AUTO_UPDATE_INTERVAL_HOURS
    ver = get_current_version()
    return {
        "version": ver.get("version", "unknown"),
        "release_date": ver.get("release_date", ""),
        "server_time": datetime.now().isoformat(),
        "auto_update_enabled": AUTO_UPDATE_ENABLED,
        "auto_update_interval_hours": AUTO_UPDATE_INTERVAL_HOURS,
    }


@router.get("/check-update")
async def system_check_update(current_user: User = Depends(get_current_user)):
    """检查是否有新版本可用（登录后可用）

    并行请求 GitHub 和 Gitee 更新源，任一个成功即可。
    返回更新信息包括版本号、更新日志、下载地址和 SHA256。
    """
    try:
        return await check_for_update()
    except UpdaterError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/apply-update")
def system_apply_update(
    req: ApplyUpdateRequest,
    current_user: User = Depends(require_permission("departments:view")),
):
    """执行系统更新（管理员或拥有部门管理权限的用户可操作）

    后台下载更新包、校验 SHA256、解压、备份、启动更新脚本后退出。
    更新脚本会自动替换文件并重启服务。
    """
    if not req.download_url:
        raise HTTPException(status_code=400, detail="缺少 download_url")
    if not req.sha256:
        raise HTTPException(status_code=400, detail="缺少 sha256")

    def _run():
        try:
            apply_update(req.download_url, req.sha256)
        except UpdaterError as e:
            print(f"[updater] Update failed: {e}")
        except Exception as e:
            print(f"[updater] Unexpected error: {e}")

    try:
        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动更新失败: {e}")

    return {
        "status": "installing",
        "message": "更新已启动，系统将在数秒后自动重启",
    }
