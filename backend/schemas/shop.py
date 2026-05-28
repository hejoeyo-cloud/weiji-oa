from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ShopCreate(BaseModel):
    name: str = ""


class ShopUpdate(BaseModel):
    name: Optional[str] = None


class ShopOut(BaseModel):
    id: int
    name: str = ""
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
