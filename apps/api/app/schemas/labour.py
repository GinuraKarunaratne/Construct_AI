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
    qr_data: str | None = None


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
    """
    Single worker payroll breakdown.

    Sri Lanka statutory contributions (EPF/ETF):
      epf_employee  — 8% of gross deducted from the worker's pay
      epf_employer  — 12% of gross, additional employer cost (not subtracted from net_pay)
      etf_employer  — 3% of gross, additional employer cost (not subtracted from net_pay)

    net_pay = gross_pay - epf_employee - deductions - advances
    """
    model_config = {"from_attributes": True}
    id: int
    worker_id: int
    days_worked: float
    overtime_hours: float
    gross_pay: float
    epf_employee: float = 0.0    # employee EPF contribution (8%)
    epf_employer: float = 0.0    # employer EPF contribution (12%)
    etf_employer: float = 0.0    # employer ETF contribution (3%)
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
