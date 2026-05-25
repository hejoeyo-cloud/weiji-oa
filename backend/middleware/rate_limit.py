"""API 限流中间件 — 滑动窗口"""
import time
from collections import defaultdict
from fastapi import Request, HTTPException

class RateLimitMiddleware:
    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        self.app = app
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._clients: dict[str, list[float]] = defaultdict(list)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request = Request(scope)
        path = request.url.path
        if path in ("/health", "/docs", "/openapi.json") or path.startswith("/api/upload"):
            await self.app(scope, receive, send)
            return

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window_start = now - self.window_seconds
        
        self._clients[client_ip] = [t for t in self._clients[client_ip] if t > window_start]
        
        if len(self._clients[client_ip]) >= self.max_requests:
            from starlette.responses import JSONResponse
            response = JSONResponse({"detail": "请求过于频繁，请稍后再试"}, status_code=429)
            await response(scope, receive, send)
            return

        self._clients[client_ip].append(now)
        await self.app(scope, receive, send)
