"""Seed the first administrator account. Run inside activated venv."""

import asyncio

from v1.core.database import async_session
from v1.core.init_db import init_database
from v1.core.models import MemberStatus, UserRole
from v1.core.services import platform_service


async def main() -> None:
    await init_database()
    async with async_session() as db:
        member = await platform_service.register_member(
            db,
            full_name="System Administrator",
            email="admin@osaja20.local",
            phone_number="0000000000",
            date_of_birth=__import__("datetime").date(1990, 1, 1),
            membership_id="OSA-ADMIN-001",
            batch=2020,
            password="Admin@OSAJA20",
            role=UserRole.ADMINISTRATOR.value,
            email_verified=True,
        )
        member.status = MemberStatus.ACTIVE.value
        await db.commit()
        print(f"Admin seeded: {member.email} (id={member.id})")


if __name__ == "__main__":
    asyncio.run(main())
