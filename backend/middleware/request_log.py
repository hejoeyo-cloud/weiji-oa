"""请求日志中间件"""
import time
import logging
from fastapi import Request

logger = logging.getLogger("request")
handler = logging.FileHandler("logs/requests.log")
handler.setFormatter(logging.Formatter('%(asctime)s | %(message)s'))
logger.addHandler(handler)
logger.setLevel(logging.INFO)


async def request_log_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"{request.method:6} {request.url.path:40} {response.status_code} {duration:7.1f}ms {client_ip}")
    return response
