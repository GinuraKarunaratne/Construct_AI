"""
ML / Model Info Routes
======================

GET  /ml/model-info
     Returns the full trained model metadata: R², MAE, RMSE, MAPE,
     cross-validation scores, feature importances, model comparison table,
     training dataset statistics, and cited peer-reviewed sources.

GET  /projects/{project_id}/weather-impact
     Returns real-time weather forecast impact assessment for a project
     (requires WEATHER_API_KEY in settings and lat/lon on the Project record).
"""

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.deps import DbSession, CurrentUserId
from app.models.project import Project
from app.models.task import Task
from app.services import ml_service, weather_service
from app.core.config import settings

router = APIRouter(tags=["ml"])


@router.get("/ml/model-info")
def model_info():
    """
    Return full ML model metadata including:
    - Model name and version
    - Test R², MAE, RMSE, MAPE
    - 5-fold CV R² (mean ± std)
    - Feature importances (all 18 features ranked)
    - All candidate model comparison results
    - Training dataset statistics
    - Cited peer-reviewed sources (with DOIs)
    - Confidence score methodology
    """
    info = ml_service.get_model_info()
    if info.get("status") == "model_not_trained":
        raise HTTPException(
            status_code=503,
            detail=(
                "ML model has not been trained yet. "
                "Run: python scripts/generate_training_data.py && "
                "python scripts/train_model.py"
            ),
        )
    return info


@router.get("/projects/{project_id}/weather-impact")
def project_weather_impact(project_id: int, db: DbSession, user_id: CurrentUserId):
    """
    Fetch 5-day weather forecast from OpenWeatherMap and assess impact on
    weather-sensitive tasks for this project.

    Requires:
    - Project must have latitude and longitude set
    - WEATHER_API_KEY must be configured in the environment

    Returns:
    - forecast_days: daily rain probability, wind, and conditions
    - flagged_tasks: weather-sensitive tasks with risk dates
    - overall_weather_risk: none | low | moderate | high
    """
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = db.execute(
        select(Task).where(Task.project_id == project_id)
    ).scalars().all()

    ws_tasks = [
        {
            "id": t.id,
            "name": t.name,
            "planned_start_date": t.planned_start_date,
            "planned_end_date": t.planned_end_date,
        }
        for t in tasks
        if t.is_weather_sensitive
    ]

    impact = weather_service.assess_weather_impact(
        lat=project.latitude,
        lon=project.longitude,
        api_key=settings.WEATHER_API_KEY,
        weather_sensitive_tasks=ws_tasks,
    )
    return impact


@router.post("/projects/{project_id}/cost-predictions/run-ml")
def run_ml_prediction(project_id: int, db: DbSession, user_id: CurrentUserId):
    """
    Alias for /cost-predictions/run that makes it explicit this uses the ML model.
    Identical response to the costs router endpoint.
    """
    from app.services.prediction_service import run_prediction
    from app.schemas.cost import PredictionOut

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pred = run_prediction(db, project_id)
    return PredictionOut.model_validate(pred)
