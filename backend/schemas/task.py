from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "normal"
    assignee_id: Optional[int] = None
    due_date: str = ""

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[str] = None
    sort_order: Optional[int] = None

class TaskOut(BaseModel):
    id: int
    company_id: Optional[int] = None
    title: str
    description: str = ""
    status: str = "todo"
    priority: str = "normal"
    assignee_id: Optional[int] = None
    assignee_name: str = ""
    due_date: str = ""
    sort_order: int = 0
    created_by: Optional[int] = None
    creator_name: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True