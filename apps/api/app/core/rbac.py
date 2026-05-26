"""
Role-Based Access Control
=========================

Role hierarchy (lowest → highest privilege):
  viewer < finance_officer < site_supervisor < project_manager < admin

Permission matrix:
  viewer          — read-only on all project data
  finance_officer — + create/approve expenses, generate payroll, run predictions
  site_supervisor — + create/update tasks, mark attendance, manage materials, manage workers
  project_manager — + create/delete projects, delete tasks, approve payroll
  admin           — all actions, cross-company

Usage in routes:
    from app.core.rbac import require_role
    user = Depends(require_role("project_manager"))
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.deps import get_db, get_current_user_id
from app.models.user import User
from app.models.project import ProjectMember
from typing import Annotated

ROLE_RANK = {
    "viewer":          0,
    "finance_officer": 1,
    "site_supervisor": 2,
    "project_manager": 3,
    "admin":           4,
}


def _get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_role(minimum_role: str):
    """
    FastAPI dependency factory. Requires the authenticated user to have at
    least the given global role.

    Example:
        @router.delete("/{id}")
        def delete_project(user: Annotated[User, Depends(require_role("project_manager"))]):
            ...
    """
    def _dep(
        db: Session = Depends(get_db),
        user_id: int = Depends(get_current_user_id),
    ) -> User:
        user = _get_user(db, user_id)
        user_rank = ROLE_RANK.get(user.role, 0)
        min_rank  = ROLE_RANK.get(minimum_role, 0)
        if user_rank < min_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{minimum_role}' role or higher. Your role: '{user.role}'",
            )
        return user
    return _dep


def require_project_role(minimum_role: str, project_id_param: str = "project_id"):
    """
    Checks the user's project-level role (from project_members table).
    Admins and project_managers bypass project-level checks.
    Falls back to global role if user has no project_members record.
    """
    def _dep(
        project_id: int,
        db: Session = Depends(get_db),
        user_id: int = Depends(get_current_user_id),
    ) -> User:
        user = _get_user(db, user_id)

        # Admin / global project_manager bypasses project-level checks
        if ROLE_RANK.get(user.role, 0) >= ROLE_RANK["project_manager"]:
            return user

        # Check project membership role
        membership = db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        ).scalar_one_or_none()

        effective_role = membership.project_role if membership else user.role
        user_rank = ROLE_RANK.get(effective_role, 0)
        min_rank  = ROLE_RANK.get(minimum_role, 0)

        if user_rank < min_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{minimum_role}' project role. Your role: '{effective_role}'",
            )
        return user
    return _dep


def get_accessible_project_ids(db: Session, user: User) -> list[int] | None:
    """
    Returns list of project IDs the user can access, or None if unrestricted (admin).
    Used to filter list endpoints.
    """
    if ROLE_RANK.get(user.role, 0) >= ROLE_RANK["admin"]:
        return None  # admin sees all

    # Projects where user is a member
    rows = db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)
    ).scalars().all()
    return list(rows)


def assert_project_access(
    db: Session,
    user_id: int,
    project_id: int,
    minimum_role: str = "viewer",
) -> User:
    """
    Convenience guard for route handlers that use ``CurrentUserId`` directly.

    Raises:
        HTTP 401 — user not found / inactive
        HTTP 403 — user's role is below ``minimum_role``
        HTTP 403 — project not in user's accessible set

    Returns the User object so callers can inspect role if needed.

    Usage inside a route::

        user = assert_project_access(db, user_id, project_id)
    """
    user = _get_user(db, user_id)

    # ── Global-role gate ──────────────────────────────────────────────────────
    user_rank = ROLE_RANK.get(user.role, 0)
    min_rank  = ROLE_RANK.get(minimum_role, 0)
    if user_rank < min_rank:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires '{minimum_role}' role or higher. Your role: '{user.role}'",
        )

    # ── Project-membership gate (admins are unrestricted) ─────────────────────
    accessible = get_accessible_project_ids(db, user)
    if accessible is not None and project_id not in accessible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project.",
        )

    return user
