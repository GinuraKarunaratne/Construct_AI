# Import all models here so Alembic autogenerate can detect every table.
# This module is imported ONLY by alembic/env.py — not by application code.
from app.db.base import Base  # noqa: F401
from app.models.user import Company, User  # noqa: F401
from app.models.project import Project, ProjectMember  # noqa: F401
from app.models.task import Task, TaskDependency  # noqa: F401
from app.models.material import MaterialItem, MaterialTransaction  # noqa: F401
from app.models.labour import Worker, Attendance, PayrollRun, PayrollLine  # noqa: F401
from app.models.cost import BudgetItem, Expense, CostPrediction  # noqa: F401
from app.models.alert import Alert, WeatherSnapshot  # noqa: F401
