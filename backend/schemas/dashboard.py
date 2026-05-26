from pydantic import BaseModel
from typing import List

class TicketTrendItem(BaseModel):
    month: str
    count: int

class ModuleDistributionItem(BaseModel):
    name: str
    count: int

class DashboardStatsOut(BaseModel):
    ticket_trend: list[TicketTrendItem] = []
    module_distribution: list[ModuleDistributionItem] = []
    ticket_status_distribution: list[ModuleDistributionItem] = []
    today_attendance: int = 0
    total_tasks: int = 0
    pending_tasks: int = 0