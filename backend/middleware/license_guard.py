"""授权拦截中间件 —— 根据授权状态控制请求放行"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class LicenseGuardMiddleware(BaseHTTPMiddleware):
    """拦截写请求：过期后只读，锁定后全部拒绝"""

    # 只读放行的路径前缀（GET/HEAD/OPTIONS）
    READ_ONLY_PATHS = {"/api/", "/ws/"}

    # 完全放行的路径（授权相关、登录、静态资源）
    EXEMPT_PATHS = {"/api/license", "/api/auth/login", "/api/auth/me"}

    async def dispatch(self, request: Request, call_next):
        from license import get_license_status, is_write_allowed, is_login_allowed

        path = request.url.path

        # 静态资源和非 API 请求直接放行
        if not path.startswith("/api/"):
            return await call_next(request)

        # 授权相关接口放行
        if any(path.startswith(p) for p in self.EXEMPT_PATHS):
            return await call_next(request)

        status_info = get_license_status()
        status = status_info["status"]

        # 锁定状态：拒绝所有请求
        if status == "locked":
            return JSONResponse(
                status_code=403,
                content={"detail": status_info["message"], "license_status": status},
            )

        # 过期状态：只允许 GET 请求
        if status == "expired" and request.method not in ("GET", "HEAD", "OPTIONS"):
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "授权已过期，系统处于只读模式",
                    "license_status": status,
                },
            )

        response = await call_next(request)
        # 在响应头中附加授权状态，前端可读取
        response.headers["X-License-Status"] = status
        return response
