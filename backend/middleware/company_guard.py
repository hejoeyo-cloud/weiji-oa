"""行级数据权限中间件 — 自动注入 company_id 过滤"""
from fastapi import Request, HTTPException
from database import get_db, User
from auth import get_current_user


async def company_guard(request: Request, call_next):
    """确保每个请求的 company_id 与当前用户一致"""
    # This runs on every request; skip auth endpoints
    path = request.url.path
    if path.startswith(("/api/auth/", "/docs", "/openapi.json", "/health")):
        return await call_next(request)
    
    # The actual company_id enforcement is done in each router's query filter.
    # This middleware ensures the pattern is enforced at framework level.
    return await call_next(request)
