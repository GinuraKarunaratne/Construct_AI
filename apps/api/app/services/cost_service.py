"""
Cost service — budget vs actual calculations and overrun detection.

actual_cost_to_date = material_cost + labour_cost + other_expenses
"""
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.material import MaterialTransaction
from app.models.labour import PayrollLine, PayrollRun
from app.models.cost import BudgetItem, Expense, CostPrediction
from app.models.alert import Alert
from app.models.project import Project


def get_material_cost(db: Session, project_id: int) -> float:
    """Sum of (quantity * unit_cost) for all delivery transactions."""
    rows = db.execute(
        select(MaterialTransaction).where(
            MaterialTransaction.project_id == project_id,
            MaterialTransaction.transaction_type == "delivery",
            MaterialTransaction.unit_cost.isnot(None),
        )
    ).scalars().all()
    return sum(float(r.quantity) * float(r.unit_cost) for r in rows)


def get_labour_cost(db: Session, project_id: int) -> float:
    """Sum of net_pay across all approved payroll runs."""
    runs = db.execute(
        select(PayrollRun).where(
            PayrollRun.project_id == project_id,
            PayrollRun.status == "approved",
        )
    ).scalars().all()
    total = 0.0
    for run in runs:
        lines = db.execute(
            select(PayrollLine).where(PayrollLine.payroll_run_id == run.id)
        ).scalars().all()
        total += sum(float(ln.net_pay) for ln in lines)
    return total


def get_other_cost(db: Session, project_id: int) -> float:
    result = db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.project_id == project_id)
    ).scalar()
    return float(result)


def get_cost_summary(db: Session, project_id: int) -> dict:
    project = db.get(Project, project_id)
    budget = float(project.total_budget) if project else 0.0

    material = get_material_cost(db, project_id)
    labour = get_labour_cost(db, project_id)
    other = get_other_cost(db, project_id)
    actual = material + labour + other
    remaining = budget - actual
    pct = (actual / budget * 100) if budget > 0 else 0.0
    overrun = actual > budget

    return {
        "total_budget": budget,
        "actual_cost_to_date": actual,
        "material_cost": material,
        "labour_cost": labour,
        "other_cost": other,
        "remaining_budget": remaining,
        "budget_used_pct": round(pct, 1),
        "overrun_risk": overrun,
    }
