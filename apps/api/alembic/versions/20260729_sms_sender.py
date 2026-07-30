"""Widen SMS sender_id and support cancelled campaigns.

Revision ID: 20260729_sms_sender
Revises: 20260729_sms_portal
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260729_sms_sender"
down_revision: Union[str, None] = "20260729_sms_portal"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "sms_campaigns" not in set(insp.get_table_names()):
        return
    cols = {c["name"]: c for c in insp.get_columns("sms_campaigns")}
    if "sender_id" in cols:
        op.alter_column(
            "sms_campaigns",
            "sender_id",
            existing_type=sa.String(length=11),
            type_=sa.String(length=64),
            existing_nullable=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "sms_campaigns" not in set(insp.get_table_names()):
        return
    op.alter_column(
        "sms_campaigns",
        "sender_id",
        existing_type=sa.String(length=64),
        type_=sa.String(length=11),
        existing_nullable=False,
    )
