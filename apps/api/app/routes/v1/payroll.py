from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import select

from app.core.deps import DbSession, CurrentUserId
from app.models.labour import PayrollRun, PayrollLine
from app.schemas.labour import PayrollGenerateRequest, PayrollRunOut, PayrollLineOut
from app.services.payroll_service import generate_payroll, apply_deductions


class PayrollLineUpdate(BaseModel):
    advances: float = 0
    deductions: float = 0

    @field_validator("advances", "deductions")
    @classmethod
    def non_negative(cls, v: float, info) -> float:
        if v < 0:
            raise ValueError(f"{info.field_name} must be non-negative")
        return v

router = APIRouter(tags=["payroll"])


@router.post("/projects/{project_id}/payroll/generate", response_model=PayrollRunOut, status_code=201)
def gen_payroll(project_id: int, req: PayrollGenerateRequest, db: DbSession, user_id: CurrentUserId):
    run = generate_payroll(db, project_id, req.period_start, req.period_end, user_id)
    return PayrollRunOut.model_validate(run)


@router.get("/projects/{project_id}/payroll-runs", response_model=list[PayrollRunOut])
def list_runs(
    project_id: int,
    db: DbSession,
    user_id: CurrentUserId,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    runs = db.execute(
        select(PayrollRun)
        .where(PayrollRun.project_id == project_id)
        .order_by(PayrollRun.period_start.desc())
        .offset(skip).limit(limit)
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
    # Final net_pay validation before approval
    lines = db.execute(select(PayrollLine).where(PayrollLine.payroll_run_id == run_id)).scalars().all()
    if any(float(ln.net_pay) < 0 for ln in lines):
        raise HTTPException(400, "Cannot approve: some workers have negative net pay. Fix advances/deductions first.")
    run.status = "approved"
    run.approved_by = user_id
    db.commit()
    db.refresh(run)
    return PayrollRunOut.model_validate(run)


@router.patch("/payroll-lines/{line_id}", response_model=PayrollLineOut)
def update_payroll_line(
    line_id: int,
    req: PayrollLineUpdate,
    db: DbSession,
    user_id: CurrentUserId,
):
    """Adjust advances/deductions for a payroll line before approval (body JSON)."""
    line = apply_deductions(db, line_id, req.advances, req.deductions)
    return PayrollLineOut.model_validate(line)
