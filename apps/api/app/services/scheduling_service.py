"""
Scheduling service — handles delay propagation across task dependencies.

Algorithm:
  1. When a task's planned_end_date changes, compare with old value.
  2. Calculate delay_days = new_end - old_end.
  3. Recursively push all successor tasks by delay_days.
  4. Create an alert for each rescheduled task.
  5. Save a schedule revision note.
"""
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.task import Task, TaskDependency
from app.models.alert import Alert
from app.schemas.task import TaskUpdate


def propagate_delay(db: Session, task: Task, old_end_date: date | None, project_id: int) -> list[int]:
    """Push dependent tasks forward and return list of affected task IDs."""
    if old_end_date is None or task.planned_end_date is None:
        return []
    if task.planned_end_date <= old_end_date:
        return []  # no delay or recovered early

    delay_days = (task.planned_end_date - old_end_date).days
    affected: list[int] = []
    _push_successors(db, task.id, delay_days, project_id, affected, visited=set())
    return affected


def _push_successors(
    db: Session,
    task_id: int,
    delay_days: int,
    project_id: int,
    affected: list[int],
    visited: set[int],
) -> None:
    if task_id in visited:
        return
    visited.add(task_id)

    deps = db.execute(
        select(TaskDependency).where(TaskDependency.predecessor_task_id == task_id)
    ).scalars().all()

    for dep in deps:
        successor = db.get(Task, dep.successor_task_id)
        if successor is None or successor.project_id != project_id:
            continue

        old_start = successor.planned_start_date
        old_end = successor.planned_end_date

        if old_start is not None:
            successor.planned_start_date = old_start + timedelta(days=delay_days + dep.lag_days)
        if old_end is not None:
            successor.planned_end_date = old_end + timedelta(days=delay_days + dep.lag_days)

        if successor.status not in ("completed",):
            successor.status = "delayed"

        affected.append(successor.id)

        # Create reschedule alert
        alert = Alert(
            project_id=project_id,
            alert_type="task_delayed",
            severity="warning",
            title=f"Task rescheduled: {successor.name}",
            message=(
                f"'{successor.name}' was pushed by {delay_days} day(s) due to a predecessor delay. "
                f"New dates: {successor.planned_start_date} → {successor.planned_end_date}."
            ),
            related_entity_type="task",
            related_entity_id=successor.id,
        )
        db.add(alert)

        _push_successors(db, successor.id, delay_days, project_id, affected, visited)


def build_gantt(db: Session, project_id: int) -> list[dict]:
    tasks = db.execute(select(Task).where(Task.project_id == project_id)).scalars().all()
    deps = db.execute(select(TaskDependency).where(TaskDependency.project_id == project_id)).scalars().all()

    dep_map: dict[int, list[int]] = {}
    for d in deps:
        dep_map.setdefault(d.successor_task_id, []).append(d.predecessor_task_id)

    return [
        {
            "id": t.id,
            "name": t.name,
            "planned_start_date": t.planned_start_date.isoformat() if t.planned_start_date else None,
            "planned_end_date": t.planned_end_date.isoformat() if t.planned_end_date else None,
            "actual_start_date": t.actual_start_date.isoformat() if t.actual_start_date else None,
            "actual_end_date": t.actual_end_date.isoformat() if t.actual_end_date else None,
            "progress_percentage": t.progress_percentage,
            "status": t.status,
            "priority": t.priority,
            "is_weather_sensitive": t.is_weather_sensitive,
            "parent_task_id": t.parent_task_id,
            "dependencies": dep_map.get(t.id, []),
        }
        for t in tasks
    ]
