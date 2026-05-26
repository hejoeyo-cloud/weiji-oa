from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class KnowledgeCategoryCreate(BaseModel):
    name: str
    icon: str = ""
    sort_order: int = 0

class KnowledgeCategoryOut(BaseModel):
    id: int
    name: str
    icon: str
    sort_order: int
    article_count: int = 0

    class Config:
        from_attributes = True

class KnowledgeArticleCreate(BaseModel):
    category_id: int
    title: str
    problem_desc: str = ""
    solution_steps: List[str] = []
    keywords: str = ""
    images: List[str] = []

class KnowledgeArticleUpdate(BaseModel):
    category_id: Optional[int] = None
    title: Optional[str] = None
    problem_desc: Optional[str] = None
    solution_steps: Optional[List[str]] = None
    keywords: Optional[str] = None
    images: Optional[List[str]] = None

class KnowledgeArticleOut(BaseModel):
    id: int
    category_id: int
    category_name: str = ""
    title: str
    problem_desc: str
    solution_steps: List[str]
    keywords: str
    images: List[str] = []
    created_by: Optional[int]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── 故障排查步骤 ────────────────────────────────────────────────────

class TroubleshootCategoryOut(BaseModel):
    id: int
    name: str
    icon: str
    sort_order: int
    step_count: int = 0

    class Config:
        from_attributes = True

class TroubleshootStepOut(BaseModel):
    id: int
    parent_id: Optional[int]
    category_id: Optional[int]
    title: str
    instruction: str
    is_hardware: bool
    solution: str
    sort_order: int
    children: List["TroubleshootStepOut"] = []

    class Config:
        from_attributes = True
