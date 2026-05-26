"""通用 Schema — 跨模块使用的简约 Schema
大部分 Schema 已按模块拆分。这里只保留真正通用的定义。"""

from pydantic import BaseModel

class FeedbackCreate(BaseModel):
    """工单 / 退换 / 维修 通用操作反馈"""
    content: str = ""
    feedback_type: str = "progress"