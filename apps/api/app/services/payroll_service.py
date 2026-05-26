"""
Payroll service — generates payroll lines from attendance records.

Formula (Sri Lanka statutory deductions applied automatically):
  regular_pay   = days_worked × daily_rate
  overtime_pay  = overtime_hours × overtime_rate
  gross_pay     = regular_pay + overtime_pay

  EPF employee  = gross_pay × 8%   (deducted from worker's pay)
  EPF employer  = gross_pay × 12%  (employer's additional cost, shown for P&L)
  ETF employer  = gross_pay × 3%   (employer's additional cost, shown for P&L)

  net_pay       = gross_pay - epf_employee - advances - deductions

References:
  Employees' Provident Fund Act No. 15 of 1958 (Sri Lanka)
  Employees' Trust Fund Act No. 46 of 1980 (Sri Lanka)

Advances and deductions can be adjusted per-line via PATCH /payroll-lines/{id}
before the run is approved.
"""
from datetime import date

from fastapi import HTTPException
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.models.labour import Worker, Attendance, PayrollRun, PayrollLine


def generate_payroll(
    db: Session,
    project_id: int,
    period_start: date,
    period_end: date,
    generated_by: int,
) -> PayrollRun:
    if period_end < period_start:
        raise HTTPException(status_code=400, detail="period_end must be >= period_start")

    workers = db.execute(
        select(Worker).where(Worker.project_id == project_id, Worker.is_active == True)  # noqa: E712
    ).scalars().all()

    if not workers:
        raise HTTPException(status_code=400, detail="No active workers found for this project")

    payroll_run = PayrollRun(
        project_id=project_id,
        period_start=period_start,
        period_end=period_end,
        generated_by=generated_by,
        status="draft",
    )
    db.add(payroll_run)
    db.flush()

    for worker in workers:
        attendance_rows = db.execute(
            select(Attendance).where(
                and_(
                    Attendance.worker_id == worker.id,
                    Attendance.attendance_date >= period_start,
                    Attendance.attendance_date <= period_end,
                    Attendance.status.in_(["present", "half_day"]),
                )
            )
        ).scalars().all()

        days_worked = sum(1.0 if a.status == "present" else 0.5 for a in attendance_rows)
        overtime_hours = sum(float(a.overtime_hours) for a in attendance_rows)

        regular_pay  = days_worked * float(worker.daily_rate)
        overtime_pay = overtime_hours * float(worker.overtime_rate)
        gross_pay    = regular_pay + overtime_pay

        # ── Sri Lanka statutory deductions ──────────────────────────────────
        # EPF Act No. 15/1958  |  ETF Act No. 46/1980
        epf_employee = gross_pay * 0.08   # 8%  — deducted from worker
        epf_employer = gross_pay * 0.12   # 12% — employer cost (P&L only)
        etf_employer = gross_pay * 0.03   # 3%  — employer cost (P&L only)

        # net_pay = gross - EPF employee deduction; manager adjusts advances/deductions before approval
        net_pay = gross_pay - epf_employee

        line = PayrollLine(
            payroll_run_id=payroll_run.id,
            worker_id=worker.id,
            days_worked=days_worked,
            overtime_hours=overtime_hours,
            gross_pay=round(gross_pay, 2),
            epf_employee=round(epf_employee, 2),
            epf_employer=round(epf_employer, 2),
            etf_employer=round(etf_employer, 2),
            advances=0,
            deductions=0,
            net_pay=round(net_pay, 2),
        )
        db.add(line)

    db.commit()
    db.refresh(payroll_run)
    return payroll_run


def apply_deductions(
    db: Session,
    line_id: int,
    advances: float,
    deductions: float,
) -> PayrollLine:
    """Update a payroll line's advances/deductions and recalculate net_pay."""
    line = db.get(PayrollLine, line_id)
    if not line:
        raise HTTPException(status_code=404, detail="Payroll line not found")

    run = db.get(PayrollRun, line.payroll_run_id)
    if run and run.status != "draft":
        raise HTTPException(status_code=400, detail="Cannot modify a non-draft payroll run")

    if advances < 0 or deductions < 0:
        raise HTTPException(status_code=400, detail="Advances and deductions must be non-negative")

    line.advances   = round(advances, 2)
    line.deductions = round(deductions, 2)
    # net_pay = gross - EPF_employee - advances - additional_deductions
    line.net_pay    = round(
        float(line.gross_pay) - float(line.epf_employee) - advances - deductions,
        2
    )

    if line.net_pay < 0:
        raise HTTPException(
            status_code=400,
            detail=f"net_pay ({line.net_pay}) cannot be negative — EPF + advances + deductions exceed gross_pay"
        )

    db.commit()
    db.refresh(line)
    return line
