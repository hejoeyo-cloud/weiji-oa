"""API 限流中间件 — 滑动窗口 + 本地开发豁免"""
import time
from collections import defaultdict
from fastapi import Request, HTTPException

# 内部 IP 段，不限流
_LOCAL_IPS = {"127.0.0.1", "::1", "localhost"}

class RateLimitMiddleware:
    def __init__(self, app, max_requests: int = 600, window_seconds: int = 60, burst_max: int = 30):
        self.app = app
        self.max_requests = max_requests      # 每分钟总量上限
        self.window_seconds = window_seconds
        self.burst_max = burst_max            # 每秒瞬时上限
        self._clients: dict[str, list[float]] = defaultdict(list)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        path = request.url.path
        # 跳过静态资源、文档和上传
        if path in ("/health", "/docs", "/openapi.json") or path.startswith("/api/upload"):
            await self.app(scope, receive, send)
            return

        client_ip = request.client.host if request.client else "unknown"

        # 本地开发 / 内网测试不限制
        if client_ip in _LOCAL_IPS:
            await self.app(scope, receive, send)
            return

        now = time.time()
        window_start = now - self.window_seconds
        burst_start = now - 1.0

        self._clients[client_ip] = [t for t in self._clients[client_ip] if t > window_start]

        # 检查瞬时突发
        burst_count = sum(1 for t in self._clients[client_ip] if t > burst_start)
        if burst_count >= self.burst_max:
            from starlette.responses import JSONResponse
            response = JSONResponse({"detail": "请求过于频繁，请稍后再试"}, status_code=429)
            await response(scope, receive, send)
            return

        # 检查窗口总量
        if len(self._clients[client_ip]) >= self.max_requests:
            from starlette.responses import JSONResponse
            response = JSONResponse({"detail": "请求过于频繁，请稍后再试"}, status_code=429)
            await response(scope, receive, send)
            return

        self._clients[client_ip].append(now)
        await self.app(scope, receive, send)
