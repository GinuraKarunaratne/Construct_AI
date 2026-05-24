from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.deps import DbSession, CurrentUserId
from app.models.cost import BudgetItem, Expense, CostPrediction
from app.schemas.cost import BudgetItemCreate, BudgetItemOut, ExpenseCreate, ExpenseOut, CostSummary, PredictionOut
from app.services.cost_service import get_cost_summary
from app.services.prediction_service import run_prediction

router = APIRouter(tags=["costs"])


@router.get("/projects/{project_id}/cost-summary", response_model=CostSummary)
def cost_summary(project_id: int, db: DbSession, user_id: CurrentUserId):
    return get_cost_summary(db, project_id)


@router.get("/projects/{project_id}/budget-items", response_model=list[BudgetItemOut])
def list_budget_items(project_id: int, db: DbSession, user_id: CurrentUserId):
    items = db.execute(select(BudgetItem).where(BudgetItem.project_id == project_id)).scalars().all()
    return [BudgetItemOut.model_validate(i) for i in items]


@router.post("/projects/{project_id}/budget-items", response_model=BudgetItemOut, status_code=201)
def create_budget_item(project_id: int, req: BudgetItemCreate, db: DbSession, user_id: CurrentUserId):
    item = BudgetItem(project_id=project_id, **req.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return BudgetItemOut.model_validate(item)


@router.get("/projects/{project_id}/expenses", response_model=list[ExpenseOut])
def list_expenses(project_id: int, db: DbSession, user_id: CurrentUserId):
    exps = db.execute(
        select(Expense).where(Expense.project_id == project_id).order_by(Expense.expense_date.desc())
    ).scalars().all()
    return [ExpenseOut.model_validate(e) for e in exps]


@router.post("/projects/{project_id}/expenses", response_model=ExpenseOut, status_code=201)
def create_expense(project_id: int, req: ExpenseCreate, db: DbSession, user_id: CurrentUserId):
    exp = Expense(project_id=project_id, created_by=user_id, **req.model_dump())
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return ExpenseOut.model_validate(exp)


@router.post("/projects/{project_id}/cost-predictions/run", response_model=PredictionOut, status_code=201)
def run_cost_prediction(project_id: int, db: DbSession, user_id: CurrentUserId):
    return PredictionOut.model_validate(run_prediction(db, project_id))


@router.get("/projects/{project_id}/cost-predictions/latest", response_model=PredictionOut | None)
def latest_prediction(project_id: int, db: DbSession, user_id: CurrentUserId):
    pred = db.execute(
        select(CostPrediction)
        .where(CostPrediction.project_id == project_id)
        .order_by(CostPrediction.prediction_date.desc(), CostPrediction.id.desc())
    ).scalars().first()
    return PredictionOut.model_validate(pred) if pred else None
