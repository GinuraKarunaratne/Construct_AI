from datetime import date, time
from sqlalchemy import String, Date, Time, Numeric, ForeignKey, Text, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Worker(Base, TimestampMixin):
    __tablename__ = "workers"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    worker_code: Mapped[str] = mapped_column(String(50), index=True)
    skill_type: Mapped[str] = mapped_column(String(100), default="general")
    daily_rate: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    overtime_rate: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    qr_data: Mapped[str | None] = mapped_column(String(200), nullable=True)  # QR payload (worker_code)

    project: Mapped["Project"] = relationship(back_populates="workers")  # type: ignore[name-defined]
    attendance_records: Mapped[list["Attendance"]] = relationship(back_populates="worker", cascade="all, delete-orphan")
    payroll_lines: Mapped[list["PayrollLine"]] = relationship(back_populates="worker")


class Attendance(Base, TimestampMixin):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    worker_id: Mapped[int] = mapped_column(ForeignKey("workers.id"), index=True)
    attendance_date: Mapped[date] = mapped_column(Date, index=True)
    check_in_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    check_out_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="present")  # present|absent|half_day|leave
    overtime_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    marked_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    method: Mapped[str] = mapped_column(String(20), default="manual")  # qr|manual|face
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    worker: Mapped["Worker"] = relationship(back_populates="attendance_records")


class PayrollRun(Base, TimestampMixin):
    __tablename__ = "payroll_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft|approved|paid
    generated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    lines: Mapped[list["PayrollLine"]] = relationship(back_populates="payroll_run", cascade="all, delete-orphan")


class PayrollLine(Base):
    __tablename__ = "payroll_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    payroll_run_id: Mapped[int] = mapped_column(ForeignKey("payroll_runs.id"))
    worker_id: Mapped[int] = mapped_column(ForeignKey("workers.id"))
    days_worked: Mapped[float] = mapped_column(Numeric(5, 1), default=0)
    overtime_hours: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    gross_pay: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    advances: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    net_pay: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    # Sri Lanka statutory contributions (EPF / ETF)
    # Reference: Employees' Provident Fund Act No. 15 of 1958
    #            Employees' Trust Fund Act No. 46 of 1980
    epf_employee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)   # 8% of gross — deducted from worker
    epf_employer: Mapped[float] = mapped_column(Numeric(12, 2), default=0)   # 12% of gross — employer cost
    etf_employer: Mapped[float] = mapped_column(Numeric(12, 2), default=0)   # 3% of gross — employer cost
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    payroll_run: Mapped["PayrollRun"] = relationship(back_populates="lines")
    worker: Mapped["Worker"] = relationship(back_populates="payroll_lines")
