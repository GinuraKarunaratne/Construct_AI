from datetime import date
from sqlalchemy import String, Date, Numeric, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class MaterialItem(Base, TimestampMixin):
    __tablename__ = "material_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(300))
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str] = mapped_column(String(50), default="unit")
    estimated_quantity: Mapped[float] = mapped_column(Numeric(15, 3), default=0)
    reorder_level: Mapped[float] = mapped_column(Numeric(15, 3), default=0)
    unit_cost_estimate: Mapped[float] = mapped_column(Numeric(15, 2), default=0)

    project: Mapped["Project"] = relationship(back_populates="material_items")  # type: ignore[name-defined]
    transactions: Mapped[list["MaterialTransaction"]] = relationship(
        back_populates="material_item", cascade="all, delete-orphan"
    )

    @property
    def current_stock(self) -> float:
        """Calculated from transactions — use material_service.get_stock() for DB queries."""
        delivered = sum(t.quantity for t in self.transactions if t.transaction_type == "delivery")
        returned = sum(t.quantity for t in self.transactions if t.transaction_type == "return")
        issued = sum(t.quantity for t in self.transactions if t.transaction_type == "issue")
        wasted = sum(t.quantity for t in self.transactions if t.transaction_type == "wastage")
        adjusted = sum(t.quantity for t in self.transactions if t.transaction_type == "adjustment")
        return delivered + returned - issued - wasted + adjusted


class MaterialTransaction(Base, TimestampMixin):
    __tablename__ = "material_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    material_item_id: Mapped[int] = mapped_column(ForeignKey("material_items.id"), index=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    transaction_type: Mapped[str] = mapped_column(String(20))  # delivery|issue|return|wastage|adjustment
    quantity: Mapped[float] = mapped_column(Numeric(15, 3))
    unit_cost: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    supplier_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    qr_code: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    material_item: Mapped["MaterialItem"] = relationship(back_populates="transactions")
