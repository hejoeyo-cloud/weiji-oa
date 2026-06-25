"""授权状态查询 API"""
from fastapi import APIRouter, Depends
from auth import get_current_user
from database import User
from license import get_license_status, get_fingerprint

router = APIRouter(prefix="/api/license", tags=["license"])


@router.get("/status")
def license_status(current_user: User = Depends(get_current_user)):
    """查询授权状态（登录后可用）"""
    return get_license_status()


@router.get("/fingerprint")
def license_fingerprint():
    """获取本机机器指纹（无需登录，用于申请授权）"""
    return {"fingerprint": get_fingerprint()}
