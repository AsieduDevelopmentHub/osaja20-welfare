"""Add charge_amount to payment_transactions (Paystack gross-up).

Revision ID: 20260610_payment_charge
Revises: 20260609_inquiry_messages
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260610_payment_charge"
down_revision: Union[str, None] = "20260609_inquiry_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "payment_transactions" not in insp.get_table_names():
        return
    columns = {c["name"] for c in insp.get_columns("payment_transactions")}
    if "charge_amount" not in columns:
        op.add_column(
            "payment_transactions",
            sa.Column("charge_amount", sa.Numeric(12, 2), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "payment_transactions" not in insp.get_table_names():
        return
    columns = {c["name"] for c in insp.get_columns("payment_transactions")}
    if "charge_amount" in columns:
        op.drop_column("payment_transactions", "charge_amount")
