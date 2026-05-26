from datetime import date, datetime
from pydantic import BaseModel, field_validator, model_validator


PROJECT_TYPES    = {"residential", "commercial", "infrastructure"}
LOCATION_TYPES   = {"urban", "suburban", "rural"}
PROJECT_STATUSES = {"active", "completed", "on_hold", "cancelled"}


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    total_budget: float = 0
    project_type: str = "residential"
    location_type: str = "urban"
    has_subcontractors: bool = False

    @field_validator("total_budget")
    @classmethod
    def budget_positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Budget cannot be negative")
        return v

    @field_validator("project_type")
    @classmethod
    def valid_project_type(cls, v: str) -> str:
        if v not in PROJECT_TYPES:
            raise ValueError(f"project_type must be one of: {', '.join(PROJECT_TYPES)}")
        return v

    @field_validator("location_type")
    @classmethod
    def valid_location_type(cls, v: str) -> str:
        if v not in LOCATION_TYPES:
            raise ValueError(f"location_type must be one of: {', '.join(LOCATION_TYPES)}")
        return v

    @model_validator(mode="after")
    def end_after_start(self) -> "ProjectCreate":
        if self.planned_start_date and self.planned_end_date:
            if self.planned_end_date <= self.planned_start_date:
                raise ValueError("planned_end_date must be after planned_start_date")
        return self


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    total_budget: float | None = None
    status: str | None = None
    project_type: str | None = None
    location_type: str | None = None
    has_subcontractors: bool | None = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str | None) -> str | None:
        if v is not None and v not in PROJECT_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(PROJECT_STATUSES)}")
        return v


class ProjectOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    name: str
    description: str | None = None
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    actual_start_date: date | None = None
    actual_end_date: date | None = None
    total_budget: float
    status: str
    project_type: str = "residential"
    location_type: str = "urban"
    has_subcontractors: bool = False
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
