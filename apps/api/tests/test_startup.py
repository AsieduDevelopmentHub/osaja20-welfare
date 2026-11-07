from contextlib import asynccontextmanager, contextmanager
import importlib
from pathlib import Path
import runpy
from types import SimpleNamespace

import pytest

from v1.core.config import Settings
from v1.core.startup import validate_settings


def test_cors_origins_comma_separated():
    s = Settings(cors_origins="https://a.example.com,https://b.example.com")
    assert s.cors_origins_list == ["https://a.example.com", "https://b.example.com"]


def test_cors_origins_empty_falls_back_to_localhost_in_debug():
    s = Settings(cors_origins="", debug=True)
    assert "http://localhost:3000" in s.cors_origins_list


def test_cors_origins_empty_in_production():
    s = Settings(cors_origins="", debug=False)
    assert s.cors_origins_list == []


def test_cors_tunnel_regex_only_when_enabled():
    s = Settings(allow_tunnel_cors=False)
    assert s.cors_origin_regex is None
    s2 = Settings(allow_tunnel_cors=True)
    assert s2.cors_origin_regex is not None


def test_validate_settings_blocks_local_member_portal_in_production(monkeypatch):
    from v1.core import startup

    fake = Settings(
        debug=False,
        jwt_secret="x" * 32,
        database_url="postgresql+asyncpg://user:pass@db.example.com/postgres",
        member_portal_url="http://localhost:3000",
    )
    monkeypatch.setattr(startup, "settings", fake)
    with pytest.raises(RuntimeError, match="MEMBER_PORTAL_URL"):
        startup.validate_settings()


@pytest.mark.parametrize("dialect, expected", [("postgresql", 1), ("sqlite", 0)])
def test_schema_lock_only_runs_on_postgresql(dialect, expected):
    from v1.core.database import acquire_schema_lock

    statements = []
    connection = SimpleNamespace(
        dialect=SimpleNamespace(name=dialect),
        execute=lambda statement, parameters: statements.append((str(statement), parameters)),
    )
    acquire_schema_lock(connection)
    assert len(statements) == expected
    if statements:
        assert "pg_advisory_xact_lock" in statements[0][0]


@pytest.mark.asyncio
async def test_init_database_locks_before_creating_tables(monkeypatch):
    from v1.core import init_db

    events = []
    sync_connection = SimpleNamespace(
        dialect=SimpleNamespace(name="postgresql"),
        execute=lambda statement, parameters: events.append("lock"),
    )

    class FakeConnection:
        async def run_sync(self, function):
            if function == init_db.acquire_schema_lock:
                function(sync_connection)
            else:
                events.append("create tables")

    @asynccontextmanager
    async def begin():
        yield FakeConnection()

    async def migrate(connection):
        events.append("migrate")

    monkeypatch.setattr(init_db, "engine", SimpleNamespace(begin=begin))
    monkeypatch.setattr(init_db, "_apply_migrations", migrate)
    await init_db.init_database()
    assert events == ["lock", "create tables", "migrate"]


def test_alembic_locks_before_running_migrations(monkeypatch):
    from alembic import context

    events = []

    @contextmanager
    def transaction():
        events.append("begin")
        yield
        events.append("end")

    config = SimpleNamespace(
        config_file_name=None,
        set_main_option=lambda *args: None,
        get_main_option=lambda *args: "sqlite://",
    )
    monkeypatch.setattr(context, "config", config, raising=False)
    monkeypatch.setattr(context, "is_offline_mode", lambda: True)
    monkeypatch.setattr(context, "configure", lambda **kwargs: None)
    monkeypatch.setattr(context, "begin_transaction", transaction)
    monkeypatch.setattr(context, "run_migrations", lambda: events.append("migrate"))
    namespace = runpy.run_path(str(Path(__file__).parents[1] / "alembic" / "env.py"))
    events.clear()
    connection = SimpleNamespace(
        dialect=SimpleNamespace(name="postgresql"),
        execute=lambda statement, parameters: events.append("lock"),
    )
    namespace["do_run_migrations"](connection)
    assert events == ["begin", "lock", "migrate", "end"]


@pytest.mark.asyncio
async def test_startup_locks_before_seeding_event(monkeypatch):
    app_module = importlib.import_module("v1.main")
    events = []
    sync_connection = SimpleNamespace(
        dialect=SimpleNamespace(name="postgresql"),
        execute=lambda statement, parameters: events.append("lock"),
    )

    class FakeConnection:
        async def run_sync(self, function):
            function(sync_connection)

    class FakeSession:
        async def connection(self):
            return FakeConnection()

        async def commit(self):
            events.append("commit")

    @asynccontextmanager
    async def session_factory():
        yield FakeSession()

    async def initialize():
        events.append("initialize")

    async def seed(session):
        events.append("seed")

    async def warm(session):
        events.append("warm")

    async def worker(stop_event):
        await stop_event.wait()

    monkeypatch.setattr(app_module, "settings", SimpleNamespace(uses_supabase_storage=True))
    monkeypatch.setattr(app_module, "validate_settings", lambda: None)
    monkeypatch.setattr(app_module, "init_database", initialize)
    monkeypatch.setattr(app_module, "async_session", session_factory)
    monkeypatch.setattr(app_module, "seed_default_event", seed)
    monkeypatch.setattr(app_module, "warm_indexes", warm)
    monkeypatch.setattr(app_module, "run_job_worker", worker)
    async with app_module.lifespan(app_module.app):
        assert events == ["initialize", "lock", "seed", "warm", "commit"]
