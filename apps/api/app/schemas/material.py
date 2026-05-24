from datetime import date
from pydantic import BaseModel


class MaterialCreate(BaseModel):
    name: str
    category: str | None = None
    unit: str = "unit"
    estimated_quantity: float = 0
    reorder_level: float = 0
    unit_cost_estimate: float = 0


class MaterialUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    unit: str | None = None
    estimated_quantity: float | None = None
    reorder_level: float | None = None
    unit_cost_estimate: float | None = None


class MaterialOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    project_id: int
    name: str
    category: str | None = None
    unit: str
    estimated_quantity: float
    reorder_level: float
    unit_cost_estimate: float


class MaterialStockOut(MaterialOut):
    current_stock: float
    is_low_stock: bool


class TransactionCreate(BaseModel):
    transaction_type: str  # delivery|issue|return|wastage|adjustment
    quantity: float
    unit_cost: float | None = None
    supplier_name: str | None = None
    reference_no: str | None = None
    qr_code: str | None = None
    notes: str | None = None
    transaction_date: date
    task_id: int | None = None


class TransactionOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    project_id: int
    material_item_id: int
    task_id: int | None = None
    transaction_type: str
    quantity: float
    unit_cost: float | None = None
    supplier_name: str | None = None
    reference_no: str | None = None
    qr_code: str | None = None
    notes: str | None = None
    transaction_date: date
    created_by: int | None = None
