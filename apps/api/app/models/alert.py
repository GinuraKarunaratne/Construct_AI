from sqlalchemy import String, ForeignKey, Text, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Alert(Base, TimestampMixin):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    alert_type: Mapped[str] = mapped_column(String(50))  # task_delayed|low_stock|budget_overrun|weather_risk|payroll_anomaly
    severity: Mapped[str] = mapped_column(String(20), default="info")  # info|warning|critical
    title: Mapped[str] = mapped_column(String(300))
    message: Mapped[str] = mapped_column(Text)
    related_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_for_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    project: Mapped["Project"] = relationship(back_populates="alerts")  # type: ignore[name-defined]


class WeatherSnapshot(Base, TimestampMixin):
    __tablename__ = "weather_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    forecast_date: Mapped[str] = mapped_column(String(20))
    condition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rain_probability: Mapped[float | None] = mapped_column(nullable=True)
    temperature: Mapped[float | None] = mapped_column(nullable=True)
    wind_speed: Mapped[float | None] = mapped_column(nullable=True)
    raw_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
