"""Shared fixtures for API tests."""

import os

# Must be set before v1 modules load the engine
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-minimum-32-characters-long")
os.environ.setdefault("USE_LOCAL_AUTH", "true")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("REGISTRATION_AUTO_APPROVE", "true")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from v1.core.database import Base, async_session, engine, get_db
from v1.main import app


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    async def override_get_db():
        async with async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
