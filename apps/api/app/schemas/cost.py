from datetime import date, datetime
from pydantic import BaseModel


class BudgetItemCreate(BaseModel):
    category: str
    description: str | None = None
    estimated_amount: float = 0


class BudgetItemOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    project_id: int
    category: str
    description: str | None = None
    estimated_amount: float


class ExpenseCreate(BaseModel):
    category: str
    description: str | None = None
    amount: float
    expense_date: date
    task_id: int | None = None


class ExpenseOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    project_id: int
    task_id: int | None = None
    category: str
    description: str | None = None
    amount: float
    expense_date: date
    created_by: int | None = None


class CostSummary(BaseModel):
    total_budget: float
    actual_cost_to_date: float
    material_cost: float
    labour_cost: float
    other_cost: float
    remaining_budget: float
    budget_used_pct: float
    overrun_risk: bool


class PredictionOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    project_id: int
    prediction_date: date
    actual_cost_to_date: float
    predicted_final_cost: float
    budget: float
    overrun_risk: bool
    confidence_score: float
    model_version: str
    notes: str | None = None


class AlertOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    project_id: int
    alert_type: str
    severity: str
    title: str
    message: str
    related_entity_type: str | None = None
    related_entity_id: int | None = None
    is_read: bool
    created_for_user_id: int | None = None
    created_at: datetime | None = None
