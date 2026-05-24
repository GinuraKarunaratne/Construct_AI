from datetime import date, datetime
from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    total_budget: float = 0


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    location_name: str | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    total_budget: float | None = None
    status: str | None = None


class ProjectOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    name: str
    description: str | None = None
    location_name: str | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    total_budget: float
    status: str
    created_at: datetime | None = None


class ProjectDashboard(BaseModel):
    project: ProjectOut
    total_budget: float
    actual_cost_to_date: float
    budget_used_pct: float
    task_count: int
    completed_tasks: int
    delayed_tasks: int
    progress_pct: float
    workers_count: int
    today_attendance: int
    low_stock_count: int
    open_alerts: int
    material_cost: float
    labour_cost: float
    other_cost: float
