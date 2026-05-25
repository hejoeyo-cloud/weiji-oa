"""API 限流中间件 — 滑动窗口"""
import time
from collections import defaultdict
from fastapi import Request, HTTPException

class RateLimitMiddleware:
    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._clients: dict[str, list[float]] = defaultdict(list)

    async def __call__(self, request: Request, call_next):
        # Skip health checks and static files
        path = request.url.path
        if path in ("/health", "/docs", "/openapi.json") or path.startswith("/api/upload"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window_start = now - self.window_seconds
        
        # Clean old entries
        self._clients[client_ip] = [t for t in self._clients[client_ip] if t > window_start]
        
        if len(self._clients[client_ip]) >= self.max_requests:
            raise HTTPException(status_code=429, detail="请求过于频繁，请稍后再试")

        self._clients[client_ip].append(now)
        response = await call_next(request)
        return response
