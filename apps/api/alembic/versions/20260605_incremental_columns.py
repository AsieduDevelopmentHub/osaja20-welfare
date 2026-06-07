"""Incremental columns aligned with init_db runtime migrations.

Revision ID: 20260605_incremental
Revises:
Create Date: 2026-06-05

Fresh databases created via SQLAlchemy models already include these columns.
Run this revision when upgrading older databases that predate the columns.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260605_incremental"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(insp, table: str, column: str) -> bool:
    if table not in insp.get_table_names():
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "members" in insp.get_table_names():
        if not _has_column(insp, "members", "username"):
            op.add_column("members", sa.Column("username", sa.String(50), nullable=True))
        if not _has_column(insp, "members", "avatar_url"):
            op.add_column("members", sa.Column("avatar_url", sa.String(500), nullable=True))
        if not _has_column(insp, "members", "preferences"):
            op.add_column("members", sa.Column("preferences", sa.JSON(), nullable=True))

    if "contributions" in insp.get_table_names():
        if not _has_column(insp, "contributions", "period_year"):
            op.add_column("contributions", sa.Column("period_year", sa.Integer(), nullable=True))
        if not _has_column(insp, "contributions", "period_month"):
            op.add_column("contributions", sa.Column("period_month", sa.Integer(), nullable=True))

    if "votes" in insp.get_table_names():
        if not _has_column(insp, "votes", "results_published"):
            op.add_column(
                "votes",
                sa.Column("results_published", sa.Boolean(), server_default=sa.false(), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if _has_column(insp, "votes", "results_published"):
        op.drop_column("votes", "results_published")
    if _has_column(insp, "contributions", "period_month"):
        op.drop_column("contributions", "period_month")
    if _has_column(insp, "contributions", "period_year"):
        op.drop_column("contributions", "period_year")
    if _has_column(insp, "members", "preferences"):
        op.drop_column("members", "preferences")
    if _has_column(insp, "members", "avatar_url"):
        op.drop_column("members", "avatar_url")
    if _has_column(insp, "members", "username"):
        op.drop_column("members", "username")
