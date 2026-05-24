"""
Payroll service.

Formula:
  regular_pay      = days_worked * daily_rate
  overtime_pay     = overtime_hours * overtime_rate
  gross_pay        = regular_pay + overtime_pay
  net_pay          = gross_pay - advances - deductions
"""
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select, and_, func
from sqlalchemy.orm import Session

from app.models.labour import Worker, Attendance, PayrollRun, PayrollLine


def generate_payroll(
    db: Session,
    project_id: int,
    period_start: date,
    period_end: date,
    generated_by: int,
) -> PayrollRun:
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
    db.flush()  # get payroll_run.id

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

        days_worked = sum(
            1.0 if a.status == "present" else 0.5 for a in attendance_rows
        )
        overtime_hours = sum(float(a.overtime_hours) for a in attendance_rows)
        gross_pay = (
            days_worked * float(worker.daily_rate)
            + overtime_hours * float(worker.overtime_rate)
        )
        net_pay = gross_pay  # advances/deductions added in approval step

        line = PayrollLine(
            payroll_run_id=payroll_run.id,
            worker_id=worker.id,
            days_worked=days_worked,
            overtime_hours=overtime_hours,
            gross_pay=gross_pay,
            advances=0,
            deductions=0,
            net_pay=net_pay,
        )
        db.add(line)

    db.commit()
    db.refresh(payroll_run)
    return payroll_run
