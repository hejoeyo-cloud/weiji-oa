from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CompanyOut(BaseModel):
    id: int
    name: str
    status: str
    user_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
