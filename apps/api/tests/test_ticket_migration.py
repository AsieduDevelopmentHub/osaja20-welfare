import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


@pytest.mark.parametrize("existing_columns", [False, True])
def test_ticket_payment_migration_preserves_existing_orders(existing_columns):
    path = Path(__file__).parents[1] / "alembic" / "versions" / "20261107_ticket_payment_columns.py"
    spec = importlib.util.spec_from_file_location("ticket_payment_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE members (id CHAR(32) PRIMARY KEY)"))
        connection.execute(sa.text("CREATE TABLE ticket_orders (id INTEGER PRIMARY KEY)"))
        connection.execute(sa.text("INSERT INTO ticket_orders (id) VALUES (1)"))
        migration.op = Operations(MigrationContext.configure(connection))
        if existing_columns:
            migration.upgrade()
        migration.upgrade()

        inspector = sa.inspect(connection)
        columns = {column["name"] for column in inspector.get_columns("ticket_orders")}
        assert {"payment_method", "payment_details", "manual_payment_reference", "manual_payment_phone", "payment_submitted_at", "reviewed_by", "reviewed_at", "review_note"} <= columns
        assert connection.execute(sa.text("SELECT payment_method FROM ticket_orders WHERE id = 1")).scalar_one() == "paystack"
        assert any(index["unique"] and index["column_names"] == ["manual_payment_reference"] for index in inspector.get_indexes("ticket_orders"))
        assert any(fk["constrained_columns"] == ["reviewed_by"] for fk in inspector.get_foreign_keys("ticket_orders"))


def test_ticket_identifier_migration_backfills_existing_tickets():
    path = Path(__file__).parents[1] / "alembic" / "versions" / "20261108_ticket_identifiers.py"
    spec = importlib.util.spec_from_file_location("ticket_identifier_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE ticket_orders (id INTEGER PRIMARY KEY)"))
        connection.execute(sa.text("CREATE TABLE admission_tickets (id CHAR(32) PRIMARY KEY)"))
        connection.execute(sa.text("INSERT INTO admission_tickets (id) VALUES (:id)"), [{"id": uuid4().hex}, {"id": uuid4().hex}])
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        original = connection.execute(sa.text("SELECT ticket_number FROM admission_tickets ORDER BY id")).scalars().all()
        migration.upgrade()
        numbers = connection.execute(sa.text("SELECT ticket_number FROM admission_tickets ORDER BY id")).scalars().all()
        assert numbers == original
        assert len(set(numbers)) == 2 and all(len(number) == 12 for number in numbers)
        inspector = sa.inspect(connection)
        assert "manual_payment_sender_name" in {column["name"] for column in inspector.get_columns("ticket_orders")}
        assert any(index["unique"] and index["column_names"] == ["ticket_number"] for index in inspector.get_indexes("admission_tickets"))