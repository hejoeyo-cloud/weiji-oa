from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ProductCreate(BaseModel):
    name: str
    model_number: str = ""
    images: List[str] = []
    cpu: str = ""
    ram: str = ""
    ram_freq: str = ""
    storage: str = ""
    display: str = ""
    gpu: str = ""
    ports: List[str] = []
    battery: str = ""
    charger: str = ""
    weight: str = ""
    description: str = ""
    status: str = "在售"


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    model_number: Optional[str] = None
    images: Optional[List[str]] = None
    cpu: Optional[str] = None
    ram: Optional[str] = None
    ram_freq: Optional[str] = None
    storage: Optional[str] = None
    display: Optional[str] = None
    gpu: Optional[str] = None
    ports: Optional[List[str]] = None
    battery: Optional[str] = None
    charger: Optional[str] = None
    weight: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class ProductOut(BaseModel):
    id: int
    company_id: Optional[int] = None
    name: str
    model_number: str = ""
    images: List[str] = []
    cpu: str = ""
    ram: str = ""
    ram_freq: str = ""
    storage: str = ""
    display: str = ""
    gpu: str = ""
    ports: List[str] = []
    battery: str = ""
    charger: str = ""
    weight: str = ""
    description: str = ""
    status: str = "在售"
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductAftersalesSummary(BaseModel):
    repair_count: int = 0
    return_count: int = 0
    exchange_count: int = 0
    recent_records: List[Any] = []
