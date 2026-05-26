from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.core.deps import DbSession, CurrentUserId
from app.models.alert import Alert
from app.schemas.cost import AlertOut

router = APIRouter(tags=["alerts"])


@router.get("/projects/{project_id}/alerts", response_model=list[AlertOut])
def list_alerts(
    project_id: int,
    db: DbSession,
    user_id: CurrentUserId,
    unread_only: bool = False,
    severity: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    q = select(Alert).where(Alert.project_id == project_id)
    if unread_only:
        q = q.where(Alert.is_read == False)  # noqa: E712
    if severity:
        q = q.where(Alert.severity == severity)
    alerts = db.execute(
        q.order_by(Alert.created_at.desc()).offset(skip).limit(limit)
    ).scalars().all()
    return [AlertOut.model_validate(a) for a in alerts]


@router.patch("/alerts/{alert_id}/read", response_model=AlertOut)
def mark_read(alert_id: int, db: DbSession, user_id: CurrentUserId):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return AlertOut.model_validate(alert)


@router.post("/projects/{project_id}/alerts/mark-all-read")
def mark_all_read(project_id: int, db: DbSession, user_id: CurrentUserId):
    alerts = db.execute(
        select(Alert).where(Alert.project_id == project_id, Alert.is_read == False)  # noqa: E712
    ).scalars().all()
    for a in alerts:
        a.is_read = True
    db.commit()
    return {"marked": len(alerts)}
