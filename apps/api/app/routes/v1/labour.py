"""
Labour routes — workers, attendance, QR code generation.
"""
import io
from datetime import date

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, and_

from app.core.deps import DbSession, CurrentUserId
from app.core.rbac import assert_project_access
from app.models.labour import Worker, Attendance
from app.schemas.labour import (
    WorkerCreate, WorkerUpdate, WorkerOut,
    AttendanceScan, AttendanceManual, AttendanceOut,
)

router = APIRouter(tags=["labour"])


# ── Workers ───────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/workers", response_model=list[WorkerOut])
def list_workers(
    project_id: int,
    db: DbSession,
    user_id: CurrentUserId,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    assert_project_access(db, user_id, project_id)
    workers = db.execute(
        select(Worker)
        .where(Worker.project_id == project_id)
        .offset(skip).limit(limit)
    ).scalars().all()
    return [WorkerOut.model_validate(w) for w in workers]


@router.post("/projects/{project_id}/workers", response_model=WorkerOut, status_code=201)
def create_worker(project_id: int, req: WorkerCreate, db: DbSession, user_id: CurrentUserId):
    assert_project_access(db, user_id, project_id, minimum_role="site_supervisor")
    # Ensure worker_code is unique within project
    existing = db.execute(
        select(Worker).where(Worker.project_id == project_id, Worker.worker_code == req.worker_code)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, f"Worker code '{req.worker_code}' already exists in this project")

    worker = Worker(project_id=project_id, qr_data=req.worker_code, **req.model_dump())
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return WorkerOut.model_validate(worker)


@router.patch("/workers/{worker_id}", response_model=WorkerOut)
def update_worker(worker_id: int, req: WorkerUpdate, db: DbSession, user_id: CurrentUserId):
    worker = db.get(Worker, worker_id)
    if not worker:
        raise HTTPException(404, "Worker not found")
    assert_project_access(db, user_id, worker.project_id, minimum_role="site_supervisor")
    for f, v in req.model_dump(exclude_none=True).items():
        setattr(worker, f, v)
    db.commit()
    db.refresh(worker)
    return WorkerOut.model_validate(worker)


# ── QR Code generation ─────────────────────────────────────────────────────────

@router.get("/workers/{worker_id}/qr-code")
def worker_qr_code(worker_id: int, db: DbSession, user_id: CurrentUserId):
    """
    Generate a QR code PNG for the worker's badge.
    The QR encodes the worker_code string — the same value the scan endpoint expects.
    Returns a PNG image stream.
    """
    worker = db.get(Worker, worker_id)
    if not worker:
        raise HTTPException(404, "Worker not found")

    try:
        import qrcode
        from qrcode.image.pure import PyPNGImage
    except ImportError:
        raise HTTPException(503, "QR code library not installed. Run: pip install 'qrcode[pil]'")

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(worker.worker_code)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    filename = f"worker_qr_{worker.worker_code}.png"
    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/projects/{project_id}/workers/qr-sheet")
def project_qr_sheet(project_id: int, db: DbSession, user_id: CurrentUserId):
    """
    Generate a printable HTML page with QR badges for all active workers.
    Print this page to get physical badges.
    """
    workers = db.execute(
        select(Worker).where(Worker.project_id == project_id, Worker.is_active == True)  # noqa: E712
    ).scalars().all()

    if not workers:
        raise HTTPException(404, "No active workers found")

    try:
        import qrcode
        import base64
    except ImportError:
        raise HTTPException(503, "qrcode library not installed")

    def qr_b64(code: str) -> str:
        qr = qrcode.QRCode(box_size=8, border=3,
                           error_correction=qrcode.constants.ERROR_CORRECT_H)
        qr.add_data(code)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()

    cards = []
    for w in workers:
        img_b64 = qr_b64(w.worker_code)
        cards.append(f"""
        <div class="card">
          <img src="data:image/png;base64,{img_b64}" />
          <p class="name">{w.full_name}</p>
          <p class="code">{w.worker_code}</p>
          <p class="skill">{w.skill_type}</p>
        </div>""")

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Worker QR Badges</title>
    <style>
      body {{ font-family: Arial, sans-serif; margin: 20px; }}
      .grid {{ display: flex; flex-wrap: wrap; gap: 16px; }}
      .card {{ border: 1px solid #ccc; border-radius: 8px; padding: 12px;
               width: 160px; text-align: center; page-break-inside: avoid; }}
      .card img {{ width: 140px; height: 140px; }}
      .name {{ font-weight: bold; font-size: 13px; margin: 6px 0 2px; }}
      .code {{ font-family: monospace; font-size: 12px; color: #555; }}
      .skill {{ font-size: 11px; color: #888; margin: 2px 0; }}
      @media print {{ body {{ margin: 0; }} }}
    </style></head><body>
    <h2>Worker QR Badges — Project {project_id}</h2>
    <p>Print this page and cut out each badge.</p>
    <div class="grid">{"".join(cards)}</div>
    </body></html>"""

    return StreamingResponse(
        io.BytesIO(html.encode()),
        media_type="text/html",
        headers={"Content-Disposition": "inline"},
    )


# ── Attendance ────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/attendance/scan", response_model=AttendanceOut, status_code=201)
def scan_attendance(project_id: int, req: AttendanceScan, db: DbSession, user_id: CurrentUserId):
    assert_project_access(db, user_id, project_id, minimum_role="site_supervisor")
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
    assert_project_access(db, user_id, project_id, minimum_role="site_supervisor")
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
def list_attendance(
    project_id: int,
    db: DbSession,
    user_id: CurrentUserId,
    attendance_date: date | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    assert_project_access(db, user_id, project_id)
    q = select(Attendance).where(Attendance.project_id == project_id)
    if attendance_date:
        q = q.where(Attendance.attendance_date == attendance_date)
    records = db.execute(
        q.order_by(Attendance.attendance_date.desc()).offset(skip).limit(limit)
    ).scalars().all()
    return [AttendanceOut.model_validate(r) for r in records]
