"""SMS portal tables for campaigns, messages, and templates.

Revision ID: 20260729_sms_portal
Revises: 20260610_payment_charge
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260729_sms_portal"
down_revision: Union[str, None] = "20260610_payment_charge"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "sms_campaigns" not in tables:
        op.create_table(
            "sms_campaigns",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("recipient_group", sa.String(length=50), nullable=False),
            sa.Column("recipient_count", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("provider", sa.String(length=30), nullable=False),
            sa.Column("sender_id", sa.String(length=11), nullable=False),
            sa.Column("estimated_units", sa.Integer(), nullable=False),
            sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by", sa.Uuid(), nullable=False),
            sa.Column("provider_response", sa.JSON(), nullable=True),
            sa.Column("sandbox", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["members.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_sms_campaigns_recipient_group", "sms_campaigns", ["recipient_group"])
        op.create_index("ix_sms_campaigns_status", "sms_campaigns", ["status"])
        op.create_index("ix_sms_campaigns_scheduled_at", "sms_campaigns", ["scheduled_at"])
        op.create_index("ix_sms_campaigns_created_by", "sms_campaigns", ["created_by"])
        op.create_index("ix_sms_campaigns_created_at", "sms_campaigns", ["created_at"])

    if "sms_messages" not in tables:
        op.create_table(
            "sms_messages",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("campaign_id", sa.Uuid(), nullable=False),
            sa.Column("member_id", sa.Uuid(), nullable=True),
            sa.Column("recipient_phone", sa.String(length=20), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("provider_message_id", sa.String(length=100), nullable=True),
            sa.Column("provider_response", sa.JSON(), nullable=True),
            sa.Column("cost_units", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["campaign_id"], ["sms_campaigns.id"]),
            sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_sms_messages_campaign_id", "sms_messages", ["campaign_id"])
        op.create_index("ix_sms_messages_member_id", "sms_messages", ["member_id"])
        op.create_index("ix_sms_messages_recipient_phone", "sms_messages", ["recipient_phone"])
        op.create_index("ix_sms_messages_status", "sms_messages", ["status"])
        op.create_index("ix_sms_messages_provider_message_id", "sms_messages", ["provider_message_id"])
        op.create_index("ix_sms_messages_created_at", "sms_messages", ["created_at"])
        op.create_index(
            "idx_sms_message_campaign_status",
            "sms_messages",
            ["campaign_id", "status"],
        )

    if "sms_templates" not in tables:
        op.create_table(
            "sms_templates",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("category", sa.String(length=50), nullable=False),
            sa.Column("created_by", sa.Uuid(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["members.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("name"),
        )
        op.create_index("ix_sms_templates_category", "sms_templates", ["category"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())
    if "sms_messages" in tables:
        op.drop_table("sms_messages")
    if "sms_campaigns" in tables:
        op.drop_table("sms_campaigns")
    if "sms_templates" in tables:
        op.drop_table("sms_templates")
