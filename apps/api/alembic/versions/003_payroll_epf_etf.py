"""Add EPF/ETF columns to payroll_lines (Sri Lanka statutory)

Revision ID: 003
Revises: 002
Create Date: 2026-05-26

Sri Lanka statutory contributions:
  EPF employee  8%  — deducted from worker's net pay
  EPF employer  12% — employer cost, shown for P&L planning
  ETF employer  3%  — employer cost, shown for P&L planning

References:
  Employees' Provident Fund Act No. 15 of 1958
  Employees' Trust Fund Act No. 46 of 1980
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payroll_lines",
        sa.Column("epf_employee", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "payroll_lines",
        sa.Column("epf_employer", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "payroll_lines",
        sa.Column("etf_employer", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("payroll_lines", "etf_employer")
    op.drop_column("payroll_lines", "epf_employer")
    op.drop_column("payroll_lines", "epf_employee")
