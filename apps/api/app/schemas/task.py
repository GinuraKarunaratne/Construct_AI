from datetime import date
from pydantic import BaseModel


class TaskCreate(BaseModel):
    name: str
    description: str | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    duration_days: int = 0
    priority: str = "medium"
    is_weather_sensitive: bool = False
    estimated_cost: float | None = None
    assigned_user_id: int | None = None
    parent_task_id: int | None = None


class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    actual_start_date: date | None = None
    actual_end_date: date | None = None
    progress_percentage: int | None = None
    status: str | None = None
    priority: str | None = None
    is_weather_sensitive: bool | None = None
    estimated_cost: float | None = None
    actual_cost: float | None = None
    assigned_user_id: int | None = None


class TaskProgressUpdate(BaseModel):
    progress_percentage: int
    status: str | None = None
    actual_start_date: date | None = None
    actual_end_date: date | None = None
    notes: str | None = None


class TaskOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    project_id: int
    parent_task_id: int | None = None
    name: str
    description: str | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    actual_start_date: date | None = None
    actual_end_date: date | None = None
    duration_days: int
    progress_percentage: int
    status: str
    priority: str
    is_weather_sensitive: bool
    estimated_cost: float | None = None
    actual_cost: float | None = None
    assigned_user_id: int | None = None


class DependencyCreate(BaseModel):
    predecessor_task_id: int
    dependency_type: str = "FS"
    lag_days: int = 0


class GanttTask(BaseModel):
    id: int
    name: str
    planned_start_date: date | None
    planned_end_date: date | None
    actual_start_date: date | None
    actual_end_date: date | None
    progress_percentage: int
    status: str
    priority: str
    dependencies: list[int]  # list of predecessor task IDs
