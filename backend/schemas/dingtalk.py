from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DingtalkConfigOut(BaseModel):
    id: int
    company_id: int
    app_key: str = ""
    app_secret_masked: str = ""
    enabled: bool = False
    last_sync_at: Optional[datetime] = None

    class Config:
        from_attributes = True
