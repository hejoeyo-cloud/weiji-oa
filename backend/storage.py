"""文件存储抽象层 — 本地存储"""
import os
from abc import ABC, abstractmethod

from config import UPLOAD_DIR


class StorageBackend(ABC):
    @abstractmethod
    def save(self, file_content: bytes, filename: str) -> str:
        """保存文件，返回存储路径标识"""
        ...

    @abstractmethod
    def read(self, filepath: str) -> bytes:
        """读取文件"""
        ...

    @abstractmethod
    def delete(self, filepath: str) -> bool:
        """删除文件，返回是否成功"""
        ...

    @abstractmethod
    def get_url(self, filepath: str) -> str:
        """获取可访问URL"""
        ...


class LocalStorage(StorageBackend):
    def __init__(self):
        self.base = os.path.join(UPLOAD_DIR, "storage")
        os.makedirs(self.base, exist_ok=True)

    def save(self, content: bytes, filename: str) -> str:
        path = os.path.join(self.base, filename)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(content)
        return filename

    def read(self, filepath: str) -> bytes:
        path = os.path.realpath(os.path.join(self.base, filepath))
        if not path.startswith(os.path.realpath(self.base)):
            raise FileNotFoundError(filepath)
        if not os.path.exists(path):
            raise FileNotFoundError(filepath)
        with open(path, "rb") as f:
            return f.read()

    def delete(self, filepath: str) -> bool:
        path = os.path.realpath(os.path.join(self.base, filepath))
        if not path.startswith(os.path.realpath(self.base)):
            return False
        if os.path.exists(path):
            os.remove(path)
            return True
        return False

    def get_url(self, filepath: str) -> str:
        return f"/api/files/{filepath}"


def get_storage() -> StorageBackend:
    """返回本地存储后端"""
    return LocalStorage()
