"""
Costs routes — budget items, expenses, ML cost predictions, reports.
"""
import csv
import io
from datetime import date

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.core.deps import DbSession, CurrentUserId
from app.core.rbac import assert_project_access
from app.models.cost import BudgetItem, Expense, CostPrediction
from app.schemas.cost import (
    BudgetItemCreate, BudgetItemOut,
    ExpenseCreate, ExpenseOut,
    CostSummary, PredictionOut,
)
from app.services.cost_service import get_cost_summary
from app.services.prediction_service import run_prediction

router = APIRouter(tags=["costs"])


# ── Cost summary (with budget vs actuals breakdown) ────────────────────────────

@router.get("/projects/{project_id}/cost-summary", response_model=CostSummary)
def cost_summary(project_id: int, db: DbSession, user_id: CurrentUserId):
    assert_project_access(db, user_id, project_id)
    summary = get_cost_summary(db, project_id)

    # Enrich with budget-to-actual category comparison
    budget_items = db.execute(
        select(BudgetItem).where(BudgetItem.project_id == project_id)
    ).scalars().all()

    summary["budget_items_vs_actual"] = [
        {
            "category": item.category,
            "budgeted": float(item.estimated_amount),
            "actual": _actual_for_category(summary, item.category),
            "variance": _actual_for_category(summary, item.category) - float(item.estimated_amount),
        }
        for item in budget_items
    ]
    return summary


def _actual_for_category(summary: dict, category: str) -> float:
    """Map budget item category to actual spend bucket."""
    cat = category.lower()
    if cat in ("labour", "labor", "wages"):
        return summary.get("labour_cost", 0)
    if cat in ("material", "materials", "supplies"):
        return summary.get("material_cost", 0)
    return summary.get("other_cost", 0)


# ── Budget items ────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/budget-items", response_model=list[BudgetItemOut])
def list_budget_items(project_id: int, db: DbSession, user_id: CurrentUserId):
    assert_project_access(db, user_id, project_id)
    items = db.execute(select(BudgetItem).where(BudgetItem.project_id == project_id)).scalars().all()
    return [BudgetItemOut.model_validate(i) for i in items]


@router.post("/projects/{project_id}/budget-items", response_model=BudgetItemOut, status_code=201)
def create_budget_item(project_id: int, req: BudgetItemCreate, db: DbSession, user_id: CurrentUserId):
    assert_project_access(db, user_id, project_id, minimum_role="finance_officer")
    if req.estimated_amount < 0:
        raise HTTPException(400, "estimated_amount cannot be negative")
    item = BudgetItem(project_id=project_id, **req.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return BudgetItemOut.model_validate(item)


@router.delete("/budget-items/{item_id}", status_code=204)
def delete_budget_item(item_id: int, db: DbSession, user_id: CurrentUserId):
    item = db.get(BudgetItem, item_id)
    if not item:
        raise HTTPException(404, "Budget item not found")
    db.delete(item)
    db.commit()


# ── Expenses ────────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/expenses", response_model=list[ExpenseOut])
def list_expenses(
    project_id: int,
    db: DbSession,
    user_id: CurrentUserId,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    category: str | None = None,
):
    assert_project_access(db, user_id, project_id)
    q = select(Expense).where(Expense.project_id == project_id)
    if category:
        q = q.where(Expense.category == category)
    exps = db.execute(
        q.order_by(Expense.expense_date.desc()).offset(skip).limit(limit)
    ).scalars().all()
    return [ExpenseOut.model_validate(e) for e in exps]


@router.post("/projects/{project_id}/expenses", response_model=ExpenseOut, status_code=201)
def create_expense(project_id: int, req: ExpenseCreate, db: DbSession, user_id: CurrentUserId):
    assert_project_access(db, user_id, project_id, minimum_role="finance_officer")
    if req.amount <= 0:
        raise HTTPException(400, "Expense amount must be positive")
    if req.expense_date > date.today():
        raise HTTPException(400, "Expense date cannot be in the future")
    exp = Expense(project_id=project_id, created_by=user_id, **req.model_dump())
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return ExpenseOut.model_validate(exp)


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(expense_id: int, db: DbSession, user_id: CurrentUserId):
    exp = db.get(Expense, expense_id)
    if not exp:
        raise HTTPException(404, "Expense not found")
    db.delete(exp)
    db.commit()


# ── Predictions ─────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/cost-predictions/run", response_model=PredictionOut, status_code=201)
def run_cost_prediction(project_id: int, db: DbSession, user_id: CurrentUserId):
    assert_project_access(db, user_id, project_id, minimum_role="finance_officer")
    return PredictionOut.model_validate(run_prediction(db, project_id))


@router.get("/projects/{project_id}/cost-predictions/latest", response_model=PredictionOut | None)
def latest_prediction(project_id: int, db: DbSession, user_id: CurrentUserId):
    assert_project_access(db, user_id, project_id)
    pred = db.execute(
        select(CostPrediction)
        .where(CostPrediction.project_id == project_id)
        .order_by(CostPrediction.prediction_date.desc(), CostPrediction.id.desc())
    ).scalars().first()
    return PredictionOut.model_validate(pred) if pred else None


@router.get("/projects/{project_id}/cost-predictions/history", response_model=list[PredictionOut])
def prediction_history(
    project_id: int,
    db: DbSession,
    user_id: CurrentUserId,
    limit: int = Query(30, ge=1, le=100),
):
    """Return the last N predictions ordered oldest-first (for charting trend)."""
    assert_project_access(db, user_id, project_id)
    preds = db.execute(
        select(CostPrediction)
        .where(CostPrediction.project_id == project_id)
        .order_by(CostPrediction.prediction_date.asc(), CostPrediction.id.asc())
        .limit(limit)
    ).scalars().all()
    return [PredictionOut.model_validate(p) for p in preds]


# ── CSV Reports ─────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/reports/expenses.csv")
def export_expenses_csv(project_id: int, db: DbSession, user_id: CurrentUserId):
    """Download all expenses for this project as a CSV file."""
    assert_project_access(db, user_id, project_id, minimum_role="finance_officer")
    exps = db.execute(
        select(Expense)
        .where(Expense.project_id == project_id)
        .order_by(Expense.expense_date.desc())
    ).scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["ID", "Date", "Category", "Description", "Amount (LKR)", "Created By"])
    for e in exps:
        writer.writerow([
            e.id,
            e.expense_date,
            e.category,
            e.description or "",
            f"{float(e.amount):.2f}",
            e.created_by or "",
        ])
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=expenses_project_{project_id}.csv"},
    )


@router.get("/projects/{project_id}/reports/cost-summary.csv")
def export_cost_summary_csv(project_id: int, db: DbSession, user_id: CurrentUserId):
    """Download cost summary + prediction history as CSV."""
    assert_project_access(db, user_id, project_id, minimum_role="finance_officer")
    summary = get_cost_summary(db, project_id)
    preds = db.execute(
        select(CostPrediction)
        .where(CostPrediction.project_id == project_id)
        .order_by(CostPrediction.prediction_date.asc())
    ).scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)

    # Summary section
    writer.writerow(["== COST SUMMARY =="])
    writer.writerow(["Metric", "Value (LKR)"])
    writer.writerow(["Total Budget",         f"{summary['total_budget']:.2f}"])
    writer.writerow(["Actual Cost to Date",  f"{summary['actual_cost_to_date']:.2f}"])
    writer.writerow(["Material Cost",        f"{summary['material_cost']:.2f}"])
    writer.writerow(["Labour Cost",          f"{summary['labour_cost']:.2f}"])
    writer.writerow(["Other Cost",           f"{summary['other_cost']:.2f}"])
    writer.writerow(["Remaining Budget",     f"{summary['remaining_budget']:.2f}"])
    writer.writerow(["Budget Used %",        f"{summary['budget_used_pct']:.1f}%"])
    writer.writerow([])

    # Prediction history
    writer.writerow(["== PREDICTION HISTORY =="])
    writer.writerow(["Date", "Actual Cost to Date", "Predicted Final", "Budget", "Overrun Risk", "Confidence %", "Model", "Notes"])
    for p in preds:
        writer.writerow([
            p.prediction_date,
            f"{float(p.actual_cost_to_date):.2f}",
            f"{float(p.predicted_final_cost):.2f}",
            f"{float(p.budget):.2f}",
            "Yes" if p.overrun_risk else "No",
            f"{float(p.confidence_score):.1f}",
            p.model_version,
            (p.notes or "").replace("\n", " "),
        ])

    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=cost_summary_project_{project_id}.csv"},
    )
