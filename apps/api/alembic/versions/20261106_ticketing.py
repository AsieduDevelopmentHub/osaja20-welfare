"""Create ticket sales and admission tables.

Revision ID: 20261106_ticketing
Revises: 20260729_sms_sender
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261106_ticketing"
down_revision: Union[str, None] = "20260729_sms_sender"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_index_if_missing(table: str, name: str, columns: list[str], *, unique: bool = False) -> None:
    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table)}
    if name not in indexes:
        op.create_index(name, table, columns, unique=unique)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "ticket_events" not in tables:
        op.create_table(
            "ticket_events",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("slug", sa.String(length=120), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("venue", sa.String(length=300), nullable=False),
            sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("sales_start_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("sales_end_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("slug", name="uq_ticket_events_slug"),
        )
    _create_index_if_missing("ticket_events", "ix_ticket_events_slug", ["slug"])

    if "ticket_categories" not in tables:
        op.create_table(
            "ticket_categories",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("event_id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("description", sa.Text(), server_default="", nullable=False),
            sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("admissions_per_ticket", sa.Integer(), server_default="1", nullable=False),
            sa.Column("inventory_limit", sa.Integer(), nullable=True),
            sa.Column("sold_quantity", sa.Integer(), server_default="0", nullable=False),
            sa.Column("reserved_quantity", sa.Integer(), server_default="0", nullable=False),
            sa.Column("sales_start_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("sales_end_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.CheckConstraint("price > 0", name="ck_ticket_category_price_positive"),
            sa.CheckConstraint(
                "admissions_per_ticket > 0",
                name="ck_ticket_category_admissions_positive",
            ),
            sa.CheckConstraint(
                "inventory_limit IS NULL OR inventory_limit >= sold_quantity + reserved_quantity",
                name="ck_ticket_category_inventory",
            ),
            sa.ForeignKeyConstraint(["event_id"], ["ticket_events.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("event_id", "name", name="uq_ticket_category_event_name"),
        )
    _create_index_if_missing("ticket_categories", "ix_ticket_categories_event_id", ["event_id"])
    _create_index_if_missing(
        "ticket_categories",
        "idx_ticket_category_event_active",
        ["event_id", "is_active"],
    )

    if "ticket_orders" not in tables:
        op.create_table(
            "ticket_orders",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("event_id", sa.Uuid(), nullable=False),
            sa.Column("category_id", sa.Uuid(), nullable=False),
            sa.Column("purchaser_name", sa.String(length=200), nullable=False),
            sa.Column("purchaser_email", sa.String(length=255), nullable=False),
            sa.Column("purchaser_phone", sa.String(length=30), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column("currency", sa.String(length=3), server_default="GHS", nullable=False),
            sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
            sa.Column("reference", sa.String(length=100), nullable=False),
            sa.Column("payment_method", sa.String(length=20), server_default="paystack", nullable=False),
            sa.Column("payment_details", sa.JSON(), nullable=True),
            sa.Column("manual_payment_reference", sa.String(length=100), nullable=True),
            sa.Column("manual_payment_phone", sa.String(length=30), nullable=True),
            sa.Column("payment_submitted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("reviewed_by", sa.Uuid(), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("review_note", sa.Text(), nullable=True),
            sa.Column("authorization_url", sa.String(length=500), nullable=True),
            sa.Column("provider_reference", sa.String(length=100), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.CheckConstraint("quantity > 0", name="ck_ticket_order_quantity_positive"),
            sa.CheckConstraint("amount > 0", name="ck_ticket_order_amount_positive"),
            sa.ForeignKeyConstraint(["category_id"], ["ticket_categories.id"]),
            sa.ForeignKeyConstraint(["event_id"], ["ticket_events.id"]),
            sa.ForeignKeyConstraint(["reviewed_by"], ["members.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("manual_payment_reference", name="uq_ticket_manual_payment_reference"),
            sa.UniqueConstraint("reference", name="uq_ticket_order_reference"),
        )
    _create_index_if_missing("ticket_orders", "ix_ticket_orders_event_id", ["event_id"])
    _create_index_if_missing("ticket_orders", "ix_ticket_orders_purchaser_email", ["purchaser_email"])
    _create_index_if_missing("ticket_orders", "ix_ticket_orders_status", ["status"])

    if "admission_tickets" not in tables:
        op.create_table(
            "admission_tickets",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("order_id", sa.Uuid(), nullable=False),
            sa.Column("category_id", sa.Uuid(), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("token_encrypted", sa.Text(), nullable=False),
            sa.Column("admission_entitlement", sa.Integer(), nullable=False),
            sa.Column("admissions_used", sa.Integer(), server_default="0", nullable=False),
            sa.Column("status", sa.String(length=20), server_default="valid", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.CheckConstraint(
                "admission_entitlement > 0",
                name="ck_admission_ticket_entitlement_positive",
            ),
            sa.CheckConstraint(
                "admissions_used >= 0 AND admissions_used <= admission_entitlement",
                name="ck_admission_ticket_usage",
            ),
            sa.ForeignKeyConstraint(["category_id"], ["ticket_categories.id"]),
            sa.ForeignKeyConstraint(["order_id"], ["ticket_orders.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token_hash"),
        )
    _create_index_if_missing("admission_tickets", "ix_admission_tickets_order_id", ["order_id"])
    _create_index_if_missing("admission_tickets", "ix_admission_tickets_token_hash", ["token_hash"])
    _create_index_if_missing("admission_tickets", "ix_admission_tickets_status", ["status"])

    if "ticket_admissions" not in tables:
        op.create_table(
            "ticket_admissions",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("ticket_id", sa.Uuid(), nullable=False),
            sa.Column("admission_count", sa.Integer(), nullable=False),
            sa.Column("gate", sa.String(length=100), nullable=False),
            sa.Column("device_id", sa.String(length=100), nullable=False),
            sa.Column("staff_id", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.CheckConstraint("admission_count > 0", name="ck_ticket_admission_count_positive"),
            sa.ForeignKeyConstraint(["staff_id"], ["members.id"]),
            sa.ForeignKeyConstraint(["ticket_id"], ["admission_tickets.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ticket_admissions", "ix_ticket_admissions_ticket_id", ["ticket_id"])
    _create_index_if_missing("ticket_admissions", "ix_ticket_admissions_staff_id", ["staff_id"])
    _create_index_if_missing(
        "ticket_admissions",
        "idx_ticket_admission_ticket_time",
        ["ticket_id", "created_at"],
    )


def downgrade() -> None:
    for table in ("ticket_admissions", "admission_tickets", "ticket_orders", "ticket_categories", "ticket_events"):
        if table in sa.inspect(op.get_bind()).get_table_names():
            op.drop_table(table)
