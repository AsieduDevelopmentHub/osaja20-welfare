from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from v1.core.config import settings


def _engine_kwargs() -> dict:
    kwargs: dict = {"echo": settings.debug, "pool_pre_ping": True}
    if settings.database_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        return kwargs

    connect_args: dict = {}
    if settings.database_requires_ssl:
        connect_args["ssl"] = "require"
    if settings.database_uses_pgbouncer:
        # PgBouncer transaction pooler does not support asyncpg prepared statements
        connect_args["statement_cache_size"] = 0

    if connect_args:
        kwargs["connect_args"] = connect_args
    return kwargs


engine = create_async_engine(settings.database_url, **_engine_kwargs())
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
