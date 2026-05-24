from datetime import date
from sqlalchemy import String, Date, Numeric, ForeignKey, Text, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    parent_task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    planned_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    duration_days: Mapped[int] = mapped_column(Integer, default=0)
    progress_percentage: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(50), default="not_started")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    is_weather_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    estimated_cost: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    actual_cost: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    assigned_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    project: Mapped["Project"] = relationship(back_populates="tasks")  # type: ignore[name-defined]
    subtasks: Mapped[list["Task"]] = relationship(back_populates="parent")
    parent: Mapped["Task | None"] = relationship(back_populates="subtasks", remote_side="Task.id")
    predecessors: Mapped[list["TaskDependency"]] = relationship(
        back_populates="successor",
        foreign_keys="TaskDependency.successor_task_id",
        cascade="all, delete-orphan",
    )
    successors: Mapped[list["TaskDependency"]] = relationship(
        back_populates="predecessor",
        foreign_keys="TaskDependency.predecessor_task_id",
        cascade="all, delete-orphan",
    )


class TaskDependency(Base, TimestampMixin):
    __tablename__ = "task_dependencies"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    predecessor_task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    successor_task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    dependency_type: Mapped[str] = mapped_column(String(10), default="FS")  # FS = Finish-to-Start
    lag_days: Mapped[int] = mapped_column(Integer, default=0)

    predecessor: Mapped["Task"] = relationship(back_populates="successors", foreign_keys=[predecessor_task_id])
    successor: Mapped["Task"] = relationship(back_populates="predecessors", foreign_keys=[successor_task_id])
