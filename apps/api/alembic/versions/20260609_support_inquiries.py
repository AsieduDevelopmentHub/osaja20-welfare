"""Create support_inquiries table for member contact messages.

Revision ID: 20260609_support_inquiries
Revises: 20260605_incremental
Create Date: 2026-06-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260609_support_inquiries"
down_revision: Union[str, None] = "20260605_incremental"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "support_inquiries" in insp.get_table_names():
        return

    op.create_table(
        "support_inquiries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("member_id", sa.Uuid(), nullable=False),
        sa.Column("subject", sa.String(length=120), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("admin_reply", sa.Text(), nullable=True),
        sa.Column("replied_by", sa.Uuid(), nullable=True),
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
        sa.ForeignKeyConstraint(["replied_by"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_support_inquiries_member_id", "support_inquiries", ["member_id"])
    op.create_index("ix_support_inquiries_status", "support_inquiries", ["status"])
    op.create_index("ix_support_inquiries_created_at", "support_inquiries", ["created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "support_inquiries" not in insp.get_table_names():
        return
    op.drop_table("support_inquiries")
