from datetime import date

from fastapi import APIRouter, HTTPException
from sqlalchemy import select, and_

from app.core.deps import DbSession, CurrentUserId
from app.models.labour import Worker, Attendance
from app.schemas.labour import (
    WorkerCreate, WorkerUpdate, WorkerOut,
    AttendanceScan, AttendanceManual, AttendanceOut,
)

router = APIRouter(tags=["labour"])


# ── Workers ───────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/workers", response_model=list[WorkerOut])
def list_workers(project_id: int, db: DbSession, user_id: CurrentUserId):
    workers = db.execute(select(Worker).where(Worker.project_id == project_id)).scalars().all()
    return [WorkerOut.model_validate(w) for w in workers]


@router.post("/projects/{project_id}/workers", response_model=WorkerOut, status_code=201)
def create_worker(project_id: int, req: WorkerCreate, db: DbSession, user_id: CurrentUserId):
    worker = Worker(project_id=project_id, **req.model_dump())
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return WorkerOut.model_validate(worker)


@router.patch("/workers/{worker_id}", response_model=WorkerOut)
def update_worker(worker_id: int, req: WorkerUpdate, db: DbSession, user_id: CurrentUserId):
    worker = db.get(Worker, worker_id)
    if not worker:
        raise HTTPException(404, "Worker not found")
    for f, v in req.model_dump(exclude_none=True).items():
        setattr(worker, f, v)
    db.commit()
    db.refresh(worker)
    return WorkerOut.model_validate(worker)


# ── Attendance ────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/attendance/scan", response_model=AttendanceOut, status_code=201)
def scan_attendance(project_id: int, req: AttendanceScan, db: DbSession, user_id: CurrentUserId):
    worker = db.execute(
        select(Worker).where(Worker.worker_code == req.worker_code, Worker.project_id == project_id)
    ).scalar_one_or_none()
    if not worker:
        raise HTTPException(404, f"Worker with code '{req.worker_code}' not found in this project")

    today = date.today()
    existing = db.execute(
        select(Attendance).where(
            and_(Attendance.worker_id == worker.id, Attendance.attendance_date == today)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Attendance already marked for today")

    record = Attendance(
        project_id=project_id,
        worker_id=worker.id,
        attendance_date=today,
        check_in_time=req.check_in_time,
        check_out_time=req.check_out_time,
        overtime_hours=req.overtime_hours,
        method=req.method,
        status="present",
        marked_by_user_id=user_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return AttendanceOut.model_validate(record)


@router.post("/projects/{project_id}/attendance/manual", response_model=AttendanceOut, status_code=201)
def manual_attendance(project_id: int, req: AttendanceManual, db: DbSession, user_id: CurrentUserId):
    existing = db.execute(
        select(Attendance).where(
            and_(Attendance.worker_id == req.worker_id, Attendance.attendance_date == req.attendance_date)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Attendance already recorded for this worker on this date")

    record = Attendance(
        project_id=project_id,
        marked_by_user_id=user_id,
        method="manual",
        **req.model_dump(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return AttendanceOut.model_validate(record)


@router.get("/projects/{project_id}/attendance", response_model=list[AttendanceOut])
def list_attendance(project_id: int, db: DbSession, user_id: CurrentUserId, attendance_date: date | None = None):
    q = select(Attendance).where(Attendance.project_id == project_id)
    if attendance_date:
        q = q.where(Attendance.attendance_date == attendance_date)
    records = db.execute(q.order_by(Attendance.attendance_date.desc())).scalars().all()
    return [AttendanceOut.model_validate(r) for r in records]
