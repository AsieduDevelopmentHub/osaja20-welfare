"""Add missing payment review columns to existing ticket orders.

Revision ID: 20261107_ticket_payment
Revises: 20261106_ticketing
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261107_ticket_payment"
down_revision: Union[str, None] = "20261106_ticketing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("ticket_orders"):
        return

    columns = {column["name"] for column in inspector.get_columns("ticket_orders")}
    additions = [
        sa.Column("payment_method", sa.String(20), server_default="paystack", nullable=False),
        sa.Column("payment_details", sa.JSON(), nullable=True),
        sa.Column("manual_payment_reference", sa.String(100), nullable=True),
        sa.Column("manual_payment_phone", sa.String(30), nullable=True),
        sa.Column("payment_submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
    ]
    for column in additions:
        if column.name not in columns:
            op.add_column("ticket_orders", column)

    if "reviewed_by" not in columns:
        if bind.dialect.name == "sqlite":
            op.execute("ALTER TABLE ticket_orders ADD COLUMN reviewed_by CHAR(32) REFERENCES members (id)")
        else:
            op.add_column(
                "ticket_orders",
                sa.Column("reviewed_by", sa.Uuid(), sa.ForeignKey("members.id"), nullable=True),
            )

    inspector = sa.inspect(bind)
    unique_columns = [constraint.get("column_names") for constraint in inspector.get_unique_constraints("ticket_orders")]
    unique_columns += [index.get("column_names") for index in inspector.get_indexes("ticket_orders") if index.get("unique")]
    if ["manual_payment_reference"] not in unique_columns:
        op.create_index("uq_ticket_manual_payment_reference", "ticket_orders", ["manual_payment_reference"], unique=True)


def downgrade() -> None:
    pass