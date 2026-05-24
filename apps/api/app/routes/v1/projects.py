from datetime import date

from fastapi import APIRouter, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.deps import DbSession, CurrentUserId
from app.models.project import Project
from app.models.task import Task
from app.models.labour import Worker, Attendance
from app.models.material import MaterialItem
from app.models.alert import Alert
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut, ProjectDashboard
from app.services.cost_service import get_cost_summary
from app.services.material_service import get_stock

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(db: DbSession, user_id: CurrentUserId):
    projects = db.execute(select(Project)).scalars().all()
    return [ProjectOut.model_validate(p) for p in projects]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(req: ProjectCreate, db: DbSession, user_id: CurrentUserId):
    project = Project(**req.model_dump(), created_by=user_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: DbSession, user_id: CurrentUserId):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return ProjectOut.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, req: ProjectUpdate, db: DbSession, user_id: CurrentUserId):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    for field, val in req.model_dump(exclude_none=True).items():
        setattr(project, field, val)
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: DbSession, user_id: CurrentUserId):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    db.delete(project)
    db.commit()


@router.get("/{project_id}/dashboard", response_model=ProjectDashboard)
def project_dashboard(project_id: int, db: DbSession, user_id: CurrentUserId):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    tasks = db.execute(select(Task).where(Task.project_id == project_id)).scalars().all()
    total_tasks = len(tasks)
    completed = sum(1 for t in tasks if t.status == "completed")
    delayed = sum(1 for t in tasks if t.status == "delayed")
    progress = (sum(t.progress_percentage for t in tasks) / total_tasks) if total_tasks else 0

    workers = db.execute(select(Worker).where(Worker.project_id == project_id, Worker.is_active == True)).scalars().all()  # noqa: E712
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
