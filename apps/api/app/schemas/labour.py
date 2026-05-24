from datetime import date, time
from pydantic import BaseModel


class WorkerCreate(BaseModel):
    full_name: str
    worker_code: str
    skill_type: str = "general"
    daily_rate: float = 0
    overtime_rate: float = 0
    phone: str | None = None


class WorkerUpdate(BaseModel):
    full_name: str | None = None
    skill_type: str | None = None
    daily_rate: float | None = None
    overtime_rate: float | None = None
    phone: str | None = None
    is_active: bool | None = None


class WorkerOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    project_id: int
    full_name: str
    worker_code: str
    skill_type: str
    daily_rate: float
    overtime_rate: float
    phone: str | None = None
    is_active: bool


class AttendanceScan(BaseModel):
    worker_code: str
    check_in_time: time | None = None
    check_out_time: time | None = None
    overtime_hours: float = 0
    method: str = "qr"


class AttendanceManual(BaseModel):
    worker_id: int
    attendance_date: date
    status: str = "present"
    check_in_time: time | None = None
    check_out_time: time | None = None
    overtime_hours: float = 0
    notes: str | None = None


class AttendanceOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    project_id: int
    worker_id: int
    attendance_date: date
    check_in_time: time | None = None
    check_out_time: time | None = None
    status: str
    overtime_hours: float
    method: str
    marked_by_user_id: int | None = None


class PayrollGenerateRequest(BaseModel):
    period_start: date
    period_end: date


class PayrollLineOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    worker_id: int
    days_worked: float
    overtime_hours: float
    gross_pay: float
    advances: float
    deductions: float
    net_pay: float
    notes: str | None = None


class PayrollRunOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    project_id: int
    period_start: date
    period_end: date
    status: str
    lines: list[PayrollLineOut] = []
