from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.database import Base, engine
from v1.core.services import registry


async def init_database() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def warm_indexes(db: AsyncSession) -> None:
    await registry.rebuild(db)
