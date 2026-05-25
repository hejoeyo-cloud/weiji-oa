from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class NotificationOut(BaseModel):
    id: int
    user_id: int
    ticket_id: Optional[int]
    resource_type: str = ""
    resource_id: Optional[int] = None
    title: str
    content: str
    is_read: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True
