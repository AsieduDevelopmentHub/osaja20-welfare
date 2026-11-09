"""Nullable ticket email, presence tracking, and admission direction.

Revision ID: 20261109_ticket_presence
Revises: 20261108_ticket_ids
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261109_ticket_presence"
down_revision: Union[str, None] = "20261108_ticket_ids"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    dialect = bind.dialect.name

    if inspector.has_table("ticket_orders"):
        columns = {column["name"]: column for column in inspector.get_columns("ticket_orders")}
        email_col = columns.get("purchaser_email")
        if email_col is not None and email_col.get("nullable") is False:
            # SQLite cannot ALTER COLUMN DROP NOT NULL — use batch recreate.
            with op.batch_alter_table("ticket_orders") as batch_op:
                batch_op.alter_column(
                    "purchaser_email",
                    existing_type=sa.String(length=255),
                    nullable=True,
                )

    if inspector.has_table("admission_tickets"):
        columns = {column["name"] for column in inspector.get_columns("admission_tickets")}
        if "currently_inside" not in columns:
            op.add_column(
                "admission_tickets",
                sa.Column("currently_inside", sa.Integer(), nullable=False, server_default="0"),
            )
            op.execute(
                sa.text(
                    "UPDATE admission_tickets SET currently_inside = admissions_used "
                    "WHERE currently_inside = 0 AND admissions_used > 0"
                )
            )
        if dialect != "sqlite":
            op.execute(sa.text("ALTER TABLE admission_tickets DROP CONSTRAINT IF EXISTS ck_admission_ticket_inside"))
            op.create_check_constraint(
                "ck_admission_ticket_inside",
                "admission_tickets",
                "currently_inside >= 0 AND currently_inside <= admission_entitlement",
            )

    if inspector.has_table("ticket_admissions"):
        columns = {column["name"] for column in inspector.get_columns("ticket_admissions")}
        if "direction" not in columns:
            op.add_column(
                "ticket_admissions",
                sa.Column("direction", sa.String(length=10), nullable=False, server_default="enter"),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    dialect = bind.dialect.name

    if inspector.has_table("ticket_admissions"):
        columns = {column["name"] for column in inspector.get_columns("ticket_admissions")}
        if "direction" in columns:
            op.drop_column("ticket_admissions", "direction")

    if inspector.has_table("admission_tickets"):
        if dialect != "sqlite":
            op.execute(sa.text("ALTER TABLE admission_tickets DROP CONSTRAINT IF EXISTS ck_admission_ticket_inside"))
        columns = {column["name"] for column in inspector.get_columns("admission_tickets")}
        if "currently_inside" in columns:
            op.drop_column("admission_tickets", "currently_inside")

    if inspector.has_table("ticket_orders"):
        with op.batch_alter_table("ticket_orders") as batch_op:
            batch_op.alter_column(
                "purchaser_email",
                existing_type=sa.String(length=255),
                nullable=False,
            )
