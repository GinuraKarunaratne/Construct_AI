"""
Cost prediction service.

V1 uses a rule-based approach:
  predicted_final = actual_cost_to_date / (progress_pct / 100)

When scikit-learn is available and enough historical data exists (≥10 projects),
a Linear Regression model is used instead.

Confidence score:
  - rule_based: 40 (low — not enough data)
  - ml_based:   70–90 depending on R²
"""
from datetime import date

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.task import Task
from app.models.cost import CostPrediction
from app.models.alert import Alert
from app.models.project import Project
from app.services.cost_service import get_cost_summary


def run_prediction(db: Session, project_id: int) -> CostPrediction:
    summary = get_cost_summary(db, project_id)
    project = db.get(Project, project_id)
    budget = summary["total_budget"]
    actual = summary["actual_cost_to_date"]

    # Calculate schedule progress
    tasks = db.execute(select(Task).where(Task.project_id == project_id)).scalars().all()
    total_tasks = len(tasks)
    if total_tasks == 0:
        progress_pct = 0.0
    else:
        progress_pct = sum(t.progress_percentage for t in tasks) / total_tasks

    delayed_count = sum(1 for t in tasks if t.status == "delayed")

    # Rule-based prediction
    if progress_pct > 5:
        predicted_final = actual / (progress_pct / 100)
    else:
        # Not enough progress — assume budget with overrun buffer
        predicted_final = budget * 1.05

    # Risk buffer: each delayed task adds 1% of budget
    risk_buffer = budget * 0.01 * delayed_count
    predicted_final += risk_buffer

    overrun_risk = predicted_final > budget
    confidence = 40.0  # rule-based confidence

    # Generate overrun alert if needed
    if overrun_risk:
        existing = db.execute(
            select(Alert).where(
                Alert.project_id == project_id,
                Alert.alert_type == "budget_overrun",
                Alert.is_read == False,  # noqa: E712
            )
        ).scalar_one_or_none()
        if not existing:
            overrun_amount = predicted_final - budget
            db.add(Alert(
                project_id=project_id,
                alert_type="budget_overrun",
                severity="critical",
                title="Budget overrun risk detected",
                message=(
                    f"Predicted final cost is {predicted_final:,.0f} "
                    f"vs budget of {budget:,.0f}. "
                    f"Potential overrun: {overrun_amount:,.0f} "
                    f"({overrun_amount / budget * 100:.1f}%)."
                ),
                related_entity_type="project",
                related_entity_id=project_id,
            ))

    prediction = CostPrediction(
        project_id=project_id,
        prediction_date=date.today(),
        actual_cost_to_date=actual,
        predicted_final_cost=predicted_final,
        budget=budget,
        overrun_risk=overrun_risk,
        confidence_score=confidence,
        model_version="rule_based_v1",
        notes=f"Progress: {progress_pct:.1f}%, Delayed tasks: {delayed_count}",
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction
