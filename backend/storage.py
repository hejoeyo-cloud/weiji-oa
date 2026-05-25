"""文件存储抽象层 — 本地存储 / S3 存储"""
import os
from abc import ABC, abstractmethod
from typing import Optional

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
        path = os.path.join(self.base, filepath)
        if not os.path.exists(path):
            raise FileNotFoundError(filepath)
        with open(path, "rb") as f:
            return f.read()

    def delete(self, filepath: str) -> bool:
        path = os.path.join(self.base, filepath)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False

    def get_url(self, filepath: str) -> str:
        return f"/api/files/{filepath}"


class S3Storage(StorageBackend):
    """S3 兼容存储（腾讯COS/AWS S3/MinIO）"""
    def __init__(self):
        try:
            import boto3
            self.client = boto3.client(
                "s3",
                aws_access_key_id=os.getenv("S3_ACCESS_KEY", ""),
                aws_secret_access_key=os.getenv("S3_SECRET_KEY", ""),
                endpoint_url=os.getenv("S3_ENDPOINT"),
                region_name=os.getenv("S3_REGION", "ap-guangzhou"),
            )
            self.bucket = os.getenv("S3_BUCKET", "fries-oa")
        except ImportError:
            raise RuntimeError("boto3 is required for S3 storage. Install: pip install boto3")

    def save(self, content: bytes, filename: str) -> str:
        self.client.put_object(Bucket=self.bucket, Key=filename, Body=content)
        return filename

    def read(self, filepath: str) -> bytes:
        resp = self.client.get_object(Bucket=self.bucket, Key=filepath)
        return resp["Body"].read()

    def delete(self, filepath: str) -> bool:
        self.client.delete_object(Bucket=self.bucket, Key=filepath)
        return True

    def get_url(self, filepath: str) -> str:
        expire = int(os.getenv("S3_URL_EXPIRE", "3600"))
        return self.client.generate_presigned_url(
            "get_object", Params={"Bucket": self.bucket, "Key": filepath}, ExpiresIn=expire
        )


def get_storage() -> StorageBackend:
    """根据环境变量选择存储后端"""
    backend = os.getenv("STORAGE_BACKEND", "local")
    if backend == "s3":
        return S3Storage()
    return LocalStorage()
