"""Seed the first administrator account. LOCAL DEV ONLY — use create_admin.py in production."""

import asyncio
import sys

from v1.core.config import settings
from v1.core.database import async_session
from v1.core.init_db import init_database
from v1.core.models import MemberStatus, UserRole
from v1.core.services import platform_service


async def main() -> None:
    if not settings.debug:
        print(
            "seed_admin.py is for local development only.\n"
            "Use: python scripts/create_admin.py --email you@example.com --password 'YourSecurePassword'"
        )
        sys.exit(1)

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
