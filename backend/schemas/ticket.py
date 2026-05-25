from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TicketCreate(BaseModel):
    platform: str = ""
    customer_id: str = ""
    description: str = ""
    images: List[str] = []
    remote_tool: str = "netease"
    remote_code: str = ""
    verify_code: str = ""
    priority: str = "medium"
    diagnosis_result: str = ""
    diagnosis_log: List[dict] = []

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[int] = None
    diagnosis_result: Optional[str] = None

class TicketFeedbackOut(BaseModel):
    id: int
    ticket_id: int
    user_id: int
    content: str
    feedback_type: str
    created_at: Optional[datetime] = None
    user_name: str = ""

    class Config:
        from_attributes = True

class TicketOut(BaseModel):
    id: int
    platform: str
    customer_id: str
    description: str
    images: List[str]
    remote_tool: str
    remote_code: str
    verify_code: str
    priority: str
    status: str
    diagnosis_result: str
    diagnosis_log: List[dict]
    created_by: int
    assigned_to: Optional[int]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    completed_at: Optional[datetime]
    creator_name: str = ""
    assignee_name: Optional[str] = ""
    feedbacks: List[TicketFeedbackOut] = []

    class Config:
        from_attributes = True
