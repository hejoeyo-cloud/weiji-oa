from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FieldOptionCreate(BaseModel):
    field_name: str
    value: str
    price: float = 0
    color_code: Optional[str] = None


class FieldOptionOut(BaseModel):
    id: int
    field_name: str
    value: str
    price: float = 0
    color_code: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
