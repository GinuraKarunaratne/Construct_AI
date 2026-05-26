from datetime import date
from sqlalchemy import String, Date, Numeric, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    latitude: Mapped[float | None] = mapped_column(nullable=True)
    longitude: Mapped[float | None] = mapped_column(nullable=True)
    planned_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_budget: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    status: Mapped[str] = mapped_column(String(50), default="active")
    project_type: Mapped[str] = mapped_column(String(50), default="residential")   # residential|commercial|infrastructure
    location_type: Mapped[str] = mapped_column(String(50), default="urban")        # urban|suburban|rural
    has_subcontractors: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    company: Mapped["Company | None"] = relationship(back_populates="projects")  # type: ignore[name-defined]
    members: Mapped[list["ProjectMember"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # type: ignore[name-defined]
    material_items: Mapped[list["MaterialItem"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # type: ignore[name-defined]
    workers: Mapped[list["Worker"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # type: ignore[name-defined]
    budget_items: Mapped[list["BudgetItem"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # type: ignore[name-defined]
    expenses: Mapped[list["Expense"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # type: ignore[name-defined]
    alerts: Mapped[list["Alert"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # type: ignore[name-defined]


class ProjectMember(Base, TimestampMixin):
    __tablename__ = "project_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    project_role: Mapped[str] = mapped_column(String(50), default="viewer")

    project: Mapped["Project"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="project_memberships")  # type: ignore[name-defined]
