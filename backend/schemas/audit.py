from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    username: str
    user_name: str = ""
    action: str
    resource_type: str
    resource_id: Optional[int]
    detail: str
    ip_address: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True