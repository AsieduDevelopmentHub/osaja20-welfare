"""Threaded support inquiry messages.

Revision ID: 20260609_inquiry_messages
Revises: 20260609_support_inquiries
Create Date: 2026-06-09
"""

from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

revision: str = "20260609_inquiry_messages"
down_revision: Union[str, None] = "20260609_support_inquiries"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "support_inquiries" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("support_inquiries")}
        if "updated_at" not in cols:
            op.add_column(
                "support_inquiries",
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            )

    if "support_inquiry_messages" not in insp.get_table_names():
        op.create_table(
            "support_inquiry_messages",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("inquiry_id", sa.Uuid(), nullable=False),
            sa.Column("sender_id", sa.Uuid(), nullable=False),
            sa.Column("sender_role", sa.String(length=20), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["inquiry_id"], ["support_inquiries.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["sender_id"], ["members.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_support_inquiry_messages_inquiry_id", "support_inquiry_messages", ["inquiry_id"])
        op.create_index("ix_support_inquiry_messages_sender_id", "support_inquiry_messages", ["sender_id"])
        op.create_index("ix_support_inquiry_messages_created_at", "support_inquiry_messages", ["created_at"])

        if "support_inquiries" in insp.get_table_names():
            rows = bind.execute(
                sa.text(
                    "SELECT id, member_id, message, admin_reply, replied_by, replied_at, created_at "
                    "FROM support_inquiries"
                )
            ).fetchall()
            for row in rows:
                bind.execute(
                    sa.text(
                        "INSERT INTO support_inquiry_messages "
                        "(id, inquiry_id, sender_id, sender_role, body, created_at) "
                        "VALUES (:id, :inquiry_id, :sender_id, 'member', :body, :created_at)"
                    ),
                    {
                        "id": uuid4(),
                        "inquiry_id": row.id,
                        "sender_id": row.member_id,
                        "body": row.message,
                        "created_at": row.created_at,
                    },
                )
                if row.admin_reply and row.replied_by:
                    bind.execute(
                        sa.text(
                            "INSERT INTO support_inquiry_messages "
                            "(id, inquiry_id, sender_id, sender_role, body, created_at) "
                            "VALUES (:id, :inquiry_id, :sender_id, 'executive', :body, :created_at)"
                        ),
                        {
                            "id": uuid4(),
                            "inquiry_id": row.id,
                            "sender_id": row.replied_by,
                            "body": row.admin_reply,
                            "created_at": row.replied_at or row.created_at,
                        },
                    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "support_inquiry_messages" in insp.get_table_names():
        op.drop_table("support_inquiry_messages")
    if "support_inquiries" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("support_inquiries")}
        if "updated_at" in cols:
            op.drop_column("support_inquiries", "updated_at")
