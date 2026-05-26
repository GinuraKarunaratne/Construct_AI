"""
ConstructAI — Cost Prediction Service (ML-Powered)
===================================================

Uses the trained GradientBoosting model (R² = 0.9129, MAE = 8.59%)
to predict final project cost overrun from a live snapshot.

Pipeline:
  1. Fetch current cost summary from DB (actual spend, labour, materials)
  2. Compute task-level metrics (progress %, SPI, delayed count)
  3. Derive EVM metrics (CPI, SPI, elapsed months)
  4. Call ml_service.predict() → overrun_pct, confidence_score
  5. Optionally call weather_service if project has coordinates & API key set
  6. Persist CostPrediction row + create Alert if overrun detected

Fallback: If the model is not loaded (first-run before training), the EVM
rule-based formula is used automatically (see ml_service._evm_fallback).
"""

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.task import Task
from app.models.cost import CostPrediction
from app.models.alert import Alert
from app.models.project import Project
from app.models.labour import Worker
from app.services.cost_service import get_cost_summary, get_labour_cost, get_material_cost
from app.services import ml_service
from app.services import weather_service
from app.core.config import settings

# ── Currency normalisation ─────────────────────────────────────────────────────
# The GradientBoosting model was trained on USASpending.gov data denominated in
# USD.  All project monetary values in ConstructAI are stored in LKR.
# We convert LKR → USD before the ML call so the model operates within its
# training distribution, then apply the returned overrun *percentage* back to
# the original LKR budget to produce the final-cost estimate in LKR.
LKR_PER_USD: float = 300.0


def _compute_planned_progress(project: Project) -> float:
    """
    SPI denominator: what % of the project *should* be done by today?
    Based on planned_start_date / planned_end_date.
    Returns 0.0 if dates are missing.
    """
    if not project.planned_start_date or not project.planned_end_date:
        return 0.0

    today = date.today()
    total_days = (project.planned_end_date - project.planned_start_date).days
    if total_days <= 0:
        return 100.0

    elapsed = (today - project.planned_start_date).days
    pct = (elapsed / total_days) * 100.0
    return float(max(0.0, min(pct, 100.0)))


def _months_elapsed(project: Project) -> int:
    """Months since actual (or planned) start date."""
    start = project.actual_start_date or project.planned_start_date
    if not start:
        return 0
    today = date.today()
    delta = (today.year - start.year) * 12 + (today.month - start.month)
    return max(0, int(delta))


def _planned_duration_days(project: Project) -> int:
    if project.planned_start_date and project.planned_end_date:
        return max(1, (project.planned_end_date - project.planned_start_date).days)
    return 180   # default assumption if dates missing


def run_prediction(db: Session, project_id: int) -> CostPrediction:
    """
    Full ML prediction pipeline for a single project.
    Persists the result and returns the CostPrediction ORM object.
    """
    # ── 1. Project & cost data ─────────────────────────────────────────────────
    project = db.get(Project, project_id)
    summary = get_cost_summary(db, project_id)

    budget = summary["total_budget"]
    actual_cost = summary["actual_cost_to_date"]
    labour_cost = summary["labour_cost"]
    material_cost = summary["material_cost"]

    # ── 2. Task metrics ────────────────────────────────────────────────────────
    tasks = db.execute(
        select(Task).where(Task.project_id == project_id)
    ).scalars().all()

    task_count = len(tasks)
    if task_count == 0:
        snapshot_progress_pct = 0.0
        delayed_task_count = 0
    else:
        snapshot_progress_pct = sum(t.progress_percentage for t in tasks) / task_count
        delayed_task_count = sum(
            1 for t in tasks
            if t.status == "delayed" or (
                t.planned_end_date and t.planned_end_date < date.today()
                and t.progress_percentage < 100
            )
        )

    # ── 3. Workers ─────────────────────────────────────────────────────────────
    worker_count = db.execute(
        select(Worker).where(Worker.project_id == project_id, Worker.is_active == True)  # noqa
    ).scalars()
    worker_count = len(list(worker_count))

    # ── 4. Schedule metrics ────────────────────────────────────────────────────
    planned_progress_pct = _compute_planned_progress(project)
    months_elapsed = _months_elapsed(project)
    planned_duration = _planned_duration_days(project)

    # ── 5. Real project metadata fields ────────────────────────────────────────
    has_subcontractors = int(getattr(project, "has_subcontractors", False) or False)
    location_type_str  = getattr(project, "location_type", "urban") or "urban"
    location_type      = {"urban": 0, "suburban": 1, "rural": 2}.get(location_type_str, 0)

    # ── 6. ML prediction ───────────────────────────────────────────────────────
    # Convert LKR monetary values to USD so the model (trained on USD amounts)
    # receives inputs within its training distribution.  Non-monetary features
    # (progress %, task counts, months, ratios) are currency-agnostic and
    # passed through unchanged.
    budget_usd        = budget        / LKR_PER_USD
    actual_cost_usd   = actual_cost   / LKR_PER_USD
    labour_cost_usd   = labour_cost   / LKR_PER_USD
    material_cost_usd = material_cost / LKR_PER_USD

    ml_result = ml_service.predict(
        budget=budget_usd,
        planned_duration_days=planned_duration,
        worker_count=max(worker_count, 1),
        task_count=max(task_count, 1),
        snapshot_progress_pct=snapshot_progress_pct,
        actual_cost_at_snapshot=actual_cost_usd,
        delayed_task_count=delayed_task_count,
        labour_cost=labour_cost_usd,
        material_cost=material_cost_usd,
        months_elapsed=months_elapsed,
        has_subcontractors=has_subcontractors,
        location_type=location_type,
        planned_progress_pct=planned_progress_pct,
    )

    overrun_pct = ml_result["overrun_pct"]
    # The model returns predicted_final_cost in USD (budget_usd × (1+overrun/100)).
    # Re-derive in LKR using the original LKR budget so currency stays consistent
    # for every downstream calculation and stored value.
    predicted_final = budget * (1.0 + overrun_pct / 100.0)
    confidence_score   = ml_result["confidence_score"]
    model_version      = ml_result["model_version"]
    cpi                = ml_result.get("cpi", 1.0)
    method             = ml_result.get("method", "unknown")

    # ── 7. Weather impact (non-blocking) ───────────────────────────────────────
    weather_note = ""
    if project.latitude and project.longitude and settings.WEATHER_API_KEY:
        ws_tasks = [
            {
                "id": t.id,
                "name": t.name,
                "planned_start_date": t.planned_start_date,
                "planned_end_date": t.planned_end_date,
            }
            for t in tasks if t.is_weather_sensitive
        ]
        impact = weather_service.assess_weather_impact(
            lat=project.latitude,
            lon=project.longitude,
            api_key=settings.WEATHER_API_KEY,
            weather_sensitive_tasks=ws_tasks,
        )
        if impact["available"] and impact["flagged_tasks"]:
            count = len(impact["flagged_tasks"])
            overall = impact["overall_weather_risk"]
            weather_note = (
                f" | Weather: {overall} risk — {count} weather-sensitive task(s) affected"
            )
            # Weather risk adds a small cost buffer
            if overall == "high":
                overrun_pct = min(overrun_pct + 5.0, 200.0)
                predicted_final = budget * (1.0 + overrun_pct / 100.0)  # LKR

    overrun_risk = predicted_final > budget

    # ── 8. Build notes ─────────────────────────────────────────────────────────
    notes = (
        f"Method: {method} | "
        f"CPI: {cpi:.3f} | "
        f"Progress: {snapshot_progress_pct:.1f}% | "
        f"Delayed: {delayed_task_count}/{task_count} tasks | "
        f"Months elapsed: {months_elapsed}"
        f"{weather_note}"
    )

    # ── 9. Budget overrun alert ────────────────────────────────────────────────
    if overrun_risk:
        existing_alert = db.execute(
            select(Alert).where(
                Alert.project_id == project_id,
                Alert.alert_type == "budget_overrun",
                Alert.is_read == False,  # noqa: E712
            )
        ).scalar_one_or_none()

        if not existing_alert:
            overrun_amount = predicted_final - budget
            db.add(Alert(
                project_id=project_id,
                alert_type="budget_overrun",
                severity="critical",
                title="Budget overrun risk detected (ML prediction)",
                message=(
                    f"ML model predicts final cost of LKR {predicted_final:,.0f} "
                    f"vs. budget of LKR {budget:,.0f}. "
                    f"Estimated overrun: LKR {overrun_amount:,.0f} "
                    f"({overrun_pct:+.1f}%). "
                    f"Confidence: {confidence_score:.0f}/100. "
                    f"CPI = {cpi:.3f} (EVM-based driver). "
                    "Review cost tracking and consider scope adjustment."
                ),
                related_entity_type="project",
                related_entity_id=project_id,
            ))

    # ── 10. CPI warning alert ──────────────────────────────────────────────────
    if cpi < 0.8:
        existing_cpi_alert = db.execute(
            select(Alert).where(
                Alert.project_id == project_id,
                Alert.alert_type == "low_cpi",
                Alert.is_read == False,  # noqa: E712
            )
        ).scalar_one_or_none()

        if not existing_cpi_alert:
            db.add(Alert(
                project_id=project_id,
                alert_type="low_cpi",
                severity="warning",
                title=f"Low Cost Performance Index (CPI = {cpi:.2f})",
                message=(
                    f"CPI of {cpi:.2f} means you are spending "
                    f"{(1/cpi - 1)*100:.0f}% more than earned. "
                    "Per Cantarelli et al. (2010), CPI < 0.8 is the strongest "
                    "predictor of significant final cost overrun."
                ),
                related_entity_type="project",
                related_entity_id=project_id,
            ))

    # ── 11. Persist prediction ─────────────────────────────────────────────────
    prediction = CostPrediction(
        project_id=project_id,
        prediction_date=date.today(),
        actual_cost_to_date=actual_cost,
        predicted_final_cost=round(predicted_final, 2),
        budget=budget,
        overrun_risk=overrun_risk,
        confidence_score=round(confidence_score, 2),
        model_version=model_version,
        notes=notes,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction
