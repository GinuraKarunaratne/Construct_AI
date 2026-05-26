from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.deps import DbSession, CurrentUserId
from app.core.rbac import require_role, get_accessible_project_ids
from app.models.project import Project, ProjectMember
from app.models.task import Task
from app.models.labour import Worker, Attendance
from app.models.material import MaterialItem
from app.models.alert import Alert
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut, ProjectDashboard
from app.services.cost_service import get_cost_summary
from app.services.material_service import get_stock

router = APIRouter(prefix="/projects", tags=["projects"])


def _accessible_filter(db: Session, user: User):
    """Return SQLAlchemy WHERE clause for projects this user may access."""
    ids = get_accessible_project_ids(db, user)
    if ids is None:
        return None   # admin — no filter
    return Project.id.in_(ids) if ids else Project.id.in_([-1])   # empty set


# ── List & Create ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProjectOut])
def list_projects(
    db: DbSession,
    user: Annotated[User, Depends(require_role("viewer"))],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    q = select(Project)
    f = _accessible_filter(db, user)
    if f is not None:
        q = q.where(f)
    projects = db.execute(q.offset(skip).limit(limit)).scalars().all()
    return [ProjectOut.model_validate(p) for p in projects]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    req: ProjectCreate,
    db: DbSession,
    user: Annotated[User, Depends(require_role("project_manager"))],
):
    project = Project(**req.model_dump(), created_by=user.id, company_id=user.company_id)
    db.add(project)
    db.flush()
    # Auto-add creator as project_manager member
    db.add(ProjectMember(project_id=project.id, user_id=user.id, project_role="project_manager"))
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


# ── Single project ─────────────────────────────────────────────────────────────

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: DbSession,
    user: Annotated[User, Depends(require_role("viewer"))],
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    ids = get_accessible_project_ids(db, user)
    if ids is not None and project_id not in ids:
        raise HTTPException(403, "Access denied")
    return ProjectOut.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    req: ProjectUpdate,
    db: DbSession,
    user: Annotated[User, Depends(require_role("project_manager"))],
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    ids = get_accessible_project_ids(db, user)
    if ids is not None and project_id not in ids:
        raise HTTPException(403, "Access denied")
    for field, val in req.model_dump(exclude_none=True).items():
        setattr(project, field, val)
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: DbSession,
    user: Annotated[User, Depends(require_role("project_manager"))],
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    ids = get_accessible_project_ids(db, user)
    if ids is not None and project_id not in ids:
        raise HTTPException(403, "Access denied")
    db.delete(project)
    db.commit()


# ── Dashboard ──────────────────────────────────────────────────────────────────

@router.get("/{project_id}/dashboard", response_model=ProjectDashboard)
def project_dashboard(
    project_id: int,
    db: DbSession,
    user: Annotated[User, Depends(require_role("viewer"))],
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    ids = get_accessible_project_ids(db, user)
    if ids is not None and project_id not in ids:
        raise HTTPException(403, "Access denied")

    tasks = db.execute(select(Task).where(Task.project_id == project_id)).scalars().all()
    total_tasks = len(tasks)
    completed = sum(1 for t in tasks if t.status == "completed")
    delayed = sum(1 for t in tasks if t.status == "delayed")
    progress = (sum(t.progress_percentage for t in tasks) / total_tasks) if total_tasks else 0

    workers = db.execute(
        select(Worker).where(Worker.project_id == project_id, Worker.is_active == True)  # noqa: E712
    ).scalars().all()
    today = date.today()
    today_att = db.execute(
        select(func.count()).where(
            Attendance.project_id == project_id,
            Attendance.attendance_date == today,
            Attendance.status == "present",
        )
    ).scalar()

    items = db.execute(select(MaterialItem).where(MaterialItem.project_id == project_id)).scalars().all()
    low_stock = sum(1 for item in items if get_stock(db, item.id) <= float(item.reorder_level))

    open_alerts = db.execute(
        select(func.count()).where(Alert.project_id == project_id, Alert.is_read == False)  # noqa: E712
    ).scalar()

    cost = get_cost_summary(db, project_id)

    return ProjectDashboard(
        project=ProjectOut.model_validate(project),
        total_budget=cost["total_budget"],
        actual_cost_to_date=cost["actual_cost_to_date"],
        budget_used_pct=cost["budget_used_pct"],
        task_count=total_tasks,
        completed_tasks=completed,
        delayed_tasks=delayed,
        progress_pct=round(progress, 1),
        workers_count=len(workers),
        today_attendance=today_att or 0,
        low_stock_count=low_stock,
        open_alerts=open_alerts or 0,
        material_cost=cost["material_cost"],
        labour_cost=cost["labour_cost"],
        other_cost=cost["other_cost"],
    )
