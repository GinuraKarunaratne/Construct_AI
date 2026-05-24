from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.deps import DbSession, CurrentUserId
from app.models.labour import PayrollRun
from app.schemas.labour import PayrollGenerateRequest, PayrollRunOut
from app.services.payroll_service import generate_payroll

router = APIRouter(tags=["payroll"])


@router.post("/projects/{project_id}/payroll/generate", response_model=PayrollRunOut, status_code=201)
def gen_payroll(project_id: int, req: PayrollGenerateRequest, db: DbSession, user_id: CurrentUserId):
    run = generate_payroll(db, project_id, req.period_start, req.period_end, user_id)
    return PayrollRunOut.model_validate(run)


@router.get("/projects/{project_id}/payroll-runs", response_model=list[PayrollRunOut])
def list_runs(project_id: int, db: DbSession, user_id: CurrentUserId):
    runs = db.execute(
        select(PayrollRun).where(PayrollRun.project_id == project_id)
        .order_by(PayrollRun.period_start.desc())
    ).scalars().all()
    return [PayrollRunOut.model_validate(r) for r in runs]


@router.get("/payroll-runs/{run_id}", response_model=PayrollRunOut)
def get_run(run_id: int, db: DbSession, user_id: CurrentUserId):
    run = db.get(PayrollRun, run_id)
    if not run:
        raise HTTPException(404, "Payroll run not found")
    return PayrollRunOut.model_validate(run)


@router.post("/payroll-runs/{run_id}/approve", response_model=PayrollRunOut)
def approve_run(run_id: int, db: DbSession, user_id: CurrentUserId):
    run = db.get(PayrollRun, run_id)
    if not run:
        raise HTTPException(404, "Payroll run not found")
    if run.status != "draft":
        raise HTTPException(400, f"Cannot approve a payroll run with status '{run.status}'")
    run.status = "approved"
    run.approved_by = user_id
    db.commit()
    db.refresh(run)
    return PayrollRunOut.model_validate(run)
