"""Promote an existing member to administrator or executive. Run inside activated venv."""

import asyncio
import sys
from pathlib import Path

_API_ROOT = Path(__file__).resolve().parents[1]
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

from sqlalchemy import select

from v1.core.database import async_session
from v1.core.init_db import init_database
from v1.core.models import Member, MemberStatus, UserRole


async def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/promote_admin.py <email> [administrator|executive]")
        sys.exit(1)

    email = sys.argv[1].lower()
    role = sys.argv[2] if len(sys.argv) > 2 else UserRole.ADMINISTRATOR.value
    if role not in {UserRole.ADMINISTRATOR.value, UserRole.EXECUTIVE.value}:
        print("Role must be 'administrator' or 'executive'")
        sys.exit(1)

    await init_database()
    async with async_session() as db:
        result = await db.execute(select(Member).where(Member.email == email))
        member = result.scalar_one_or_none()
        if not member:
            print(f"No member found with email: {email}")
            sys.exit(1)

        member.role = role
        member.status = MemberStatus.ACTIVE.value
        await db.commit()
        print(f"Promoted {member.email} to {role} (id={member.id})")


if __name__ == "__main__":
    asyncio.run(main())
