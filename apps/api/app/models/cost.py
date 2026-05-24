from datetime import date
from sqlalchemy import String, Date, Numeric, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class BudgetItem(Base, TimestampMixin):
    __tablename__ = "budget_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    category: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)

    project: Mapped["Project"] = relationship(back_populates="budget_items")  # type: ignore[name-defined]


class Expense(Base, TimestampMixin):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    category: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(15, 2))
    expense_date: Mapped[date] = mapped_column(Date)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    project: Mapped["Project"] = relationship(back_populates="expenses")


class CostPrediction(Base, TimestampMixin):
    __tablename__ = "cost_predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    prediction_date: Mapped[date] = mapped_column(Date)
    actual_cost_to_date: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    predicted_final_cost: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    budget: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    overrun_risk: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0)  # 0-100
    model_version: Mapped[str] = mapped_column(String(20), default="rule_based_v1")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
