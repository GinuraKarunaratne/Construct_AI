from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import DbSession, CurrentUserId
from app.core.rbac import assert_project_access
from app.models.task import Task, TaskDependency
from app.models.project import Project
from app.schemas.task import TaskCreate, TaskUpdate, TaskProgressUpdate, TaskOut, DependencyCreate
from app.services.scheduling_service import propagate_delay, build_gantt

router = APIRouter(tags=["tasks"])


def _get_task(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return task


# ── Project-scoped task list & create ──────────────────────────────────────

@router.get("/projects/{project_id}/tasks", response_model=list[TaskOut])
def list_tasks(
    project_id: int,
    db: DbSession,
    user_id: CurrentUserId,
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
):
    assert_project_access(db, user_id, project_id)
    q = select(Task).where(Task.project_id == project_id)
    if status:
        q = q.where(Task.status == status)
    tasks = db.execute(q.offset(skip).limit(limit)).scalars().all()
    return [TaskOut.model_validate(t) for t in tasks]


@router.post("/projects/{project_id}/tasks", response_model=TaskOut, status_code=201)
def create_task(project_id: int, req: TaskCreate, db: DbSession, user_id: CurrentUserId):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    assert_project_access(db, user_id, project_id, minimum_role="site_supervisor")
    task = Task(project_id=project_id, **req.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


# ── Individual task ─────────────────────────────────────────────────────────

@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: DbSession, user_id: CurrentUserId):
    task = _get_task(db, task_id)
    assert_project_access(db, user_id, task.project_id)
    return TaskOut.model_validate(task)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, req: TaskUpdate, db: DbSession, user_id: CurrentUserId):
    task = _get_task(db, task_id)
    assert_project_access(db, user_id, task.project_id, minimum_role="site_supervisor")
    old_end = task.planned_end_date

    for field, val in req.model_dump(exclude_none=True).items():
        setattr(task, field, val)

    # Propagate delay if end date changed
    affected = propagate_delay(db, task, old_end, task.project_id)

    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.post("/tasks/{task_id}/progress", response_model=TaskOut)
def update_progress(task_id: int, req: TaskProgressUpdate, db: DbSession, user_id: CurrentUserId):
    task = _get_task(db, task_id)
    assert_project_access(db, user_id, task.project_id, minimum_role="site_supervisor")
    task.progress_percentage = req.progress_percentage
    if req.status:
        task.status = req.status
    elif req.progress_percentage == 100:
        task.status = "completed"
    elif req.progress_percentage > 0:
        task.status = "in_progress"
    if req.actual_start_date:
        task.actual_start_date = req.actual_start_date
    if req.actual_end_date:
        task.actual_end_date = req.actual_end_date
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


# ── Dependencies ─────────────────────────────────────────────────────────────

@router.post("/tasks/{task_id}/dependencies", status_code=201)
def add_dependency(task_id: int, req: DependencyCreate, db: DbSession, user_id: CurrentUserId):
    task = _get_task(db, task_id)
    assert_project_access(db, user_id, task.project_id, minimum_role="site_supervisor")
    if task_id == req.predecessor_task_id:
        raise HTTPException(400, "A task cannot depend on itself")
    dep = TaskDependency(
        project_id=task.project_id,
        predecessor_task_id=req.predecessor_task_id,
        successor_task_id=task_id,
        dependency_type=req.dependency_type,
        lag_days=req.lag_days,
    )
    db.add(dep)
    db.commit()
    return {"message": "Dependency added"}


# ── Gantt ─────────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/schedule/gantt")
def gantt_data(project_id: int, db: DbSession, user_id: CurrentUserId):
    assert_project_access(db, user_id, project_id)
    return {"tasks": build_gantt(db, project_id)}
