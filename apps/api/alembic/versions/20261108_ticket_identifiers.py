"""Add public ticket numbers and manual payer names.

Revision ID: 20261108_ticket_ids
Revises: 20261107_ticket_payment
"""

import secrets
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261108_ticket_ids"
down_revision: Union[str, None] = "20261107_ticket_payment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("ticket_orders"):
        columns = {column["name"] for column in inspector.get_columns("ticket_orders")}
        if "manual_payment_sender_name" not in columns:
            op.add_column("ticket_orders", sa.Column("manual_payment_sender_name", sa.String(200), nullable=True))

    if not inspector.has_table("admission_tickets"):
        return
    columns = {column["name"] for column in inspector.get_columns("admission_tickets")}
    if "ticket_number" not in columns:
        op.add_column("admission_tickets", sa.Column("ticket_number", sa.String(16), nullable=True))
    tickets = sa.table("admission_tickets", sa.column("id", sa.Uuid()), sa.column("ticket_number", sa.String(16)))
    existing = set(bind.execute(sa.select(tickets.c.ticket_number).where(tickets.c.ticket_number.is_not(None))).scalars())
    missing = bind.execute(sa.select(tickets.c.id).where(tickets.c.ticket_number.is_(None))).scalars().all()
    for ticket_id in missing:
        number = secrets.token_hex(6).upper()
        while number in existing:
            number = secrets.token_hex(6).upper()
        bind.execute(tickets.update().where(tickets.c.id == ticket_id).values(ticket_number=number))
        existing.add(number)
    indexes = {index["name"] for index in sa.inspect(bind).get_indexes("admission_tickets")}
    if "ix_admission_tickets_ticket_number" not in indexes:
        op.create_index("ix_admission_tickets_ticket_number", "admission_tickets", ["ticket_number"], unique=True)


def downgrade() -> None:
    pass