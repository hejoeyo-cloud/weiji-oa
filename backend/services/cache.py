"""简单的内存 TTL 缓存，用于报表等计算密集型接口"""
import time
import threading
from typing import Any, Optional
from functools import wraps

_cache: dict[str, tuple[float, Any]] = {}
_lock = threading.Lock()

DEFAULT_TTL = 300  # 5 分钟


def cache_get(key: str) -> Optional[Any]:
    with _lock:
        if key in _cache:
            expires, value = _cache[key]
            if time.time() < expires:
                return value
            del _cache[key]
    return None


def cache_set(key: str, value: Any, ttl: int = DEFAULT_TTL):
    with _lock:
        _cache[key] = (time.time() + ttl, value)


def cache_clear(pattern: str = ""):
    with _lock:
        if not pattern:
            _cache.clear()
        else:
            keys_to_delete = [k for k in _cache if pattern in k]
            for k in keys_to_delete:
                del _cache[k]


def cached(ttl: int = DEFAULT_TTL, key_prefix: str = ""):
    """装饰器：为函数结果添加 TTL 缓存"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 构建缓存 key：prefix + 函数名 + 参数
            cache_key = f"{key_prefix or func.__name__}:{str(args)}:{str(kwargs)}"
            result = cache_get(cache_key)
            if result is not None:
                return result
            result = func(*args, **kwargs)
            cache_set(cache_key, result, ttl)
            return result
        return wrapper
    return decorator
