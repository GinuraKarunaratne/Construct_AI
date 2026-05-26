"""add project fields, worker qr, refresh tokens

Revision ID: 002
Revises: 001
Create Date: 2026-05-25
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Project: add project_type, location_type, has_subcontractors ───────────
    op.add_column("projects", sa.Column(
        "project_type", sa.String(50), nullable=False, server_default="residential"
    ))
    op.add_column("projects", sa.Column(
        "location_type", sa.String(50), nullable=False, server_default="urban"
    ))
    op.add_column("projects", sa.Column(
        "has_subcontractors", sa.Boolean(), nullable=False, server_default="false"
    ))

    # ── Workers: add qr_data field ────────────────────────────────────────────
    op.add_column("workers", sa.Column(
        "qr_data", sa.String(200), nullable=True
    ))

    # ── Refresh tokens table ───────────────────────────────────────────────────
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(200), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.drop_column("workers", "qr_data")
    op.drop_column("projects", "has_subcontractors")
    op.drop_column("projects", "location_type")
    op.drop_column("projects", "project_type")
