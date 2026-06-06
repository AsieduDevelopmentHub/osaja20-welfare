"""Create an administrator account (local bcrypt or Supabase + local profile).

Usage:
  python scripts/create_admin.py --email admin@osaja.com --password 'YourPassword'
  python scripts/create_admin.py --email admin@osaja.com --password 'YourPassword' --full-name "OSAJA Admin"
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date
from uuid import UUID

from sqlalchemy import select

from v1.core.auth.supabase_client import SupabaseAuthError, supabase_auth
from v1.core.auth.supabase_service import extract_supabase_user
from v1.core.config import settings
from v1.core.database import async_session
from v1.core.init_db import init_database
from v1.core.models import Member, MemberStatus, UserRole
from v1.core.services import platform_service


async def create_admin(
    *,
    email: str,
    password: str,
    full_name: str = "System Administrator",
    membership_id: str = "OSA-ADMIN-001",
    phone_number: str = "0000000000",
    batch: int = 2020,
) -> Member:
    email = email.lower()
    await init_database()

    async with async_session() as db:
        result = await db.execute(select(Member).where(Member.email == email))
        existing = result.scalar_one_or_none()

        if settings.uses_supabase_auth:
            metadata = {
                "full_name": full_name,
                "membership_id": membership_id,
                "phone_number": phone_number,
                "date_of_birth": "1990-01-01",
                "batch": batch,
            }

            auth_user_id: UUID | None = existing.auth_user_id if existing else None

            if not auth_user_id:
                try:
                    sb_user = await supabase_auth.admin_create_user(
                        email,
                        password,
                        metadata=metadata,
                        email_confirm=True,
                    )
                    user = extract_supabase_user(sb_user)
                    if not user.get("id"):
                        raise SystemExit("Supabase admin API did not return a user id")
                    auth_user_id = UUID(user["id"])
                except SupabaseAuthError as err:
                    if "already" not in str(err).lower():
                        try:
                            session = await supabase_auth.sign_in(email, password)
                            user = extract_supabase_user(session)
                            auth_user_id = UUID(user["id"])
                        except SupabaseAuthError:
                            raise SystemExit(
                                f"Supabase user exists but password did not match. "
                                f"Reset password in Supabase dashboard or use a new email. ({err})"
                            ) from err
                    else:
                        raise SystemExit(
                            f"Could not create Supabase user: {err}. "
                            "If the email exists, reset the password in Supabase or use promote_admin.py."
                        ) from err

            if existing:
                existing.full_name = full_name
                existing.membership_id = membership_id
                existing.phone_number = phone_number
                existing.role = UserRole.ADMINISTRATOR.value
                existing.status = MemberStatus.ACTIVE.value
                existing.email_verified = True
                if auth_user_id:
                    existing.auth_user_id = auth_user_id
                member = existing
            else:
                member = await platform_service.register_member(
                    db,
                    full_name=full_name,
                    email=email,
                    phone_number=phone_number,
                    date_of_birth=date(1990, 1, 1),
                    membership_id=membership_id,
                    batch=batch,
                    password=None,
                    role=UserRole.ADMINISTRATOR.value,
                    auth_user_id=auth_user_id,
                    email_verified=True,
                )
                member.status = MemberStatus.ACTIVE.value

            await db.commit()
            return member

        if existing:
            if not existing.password_hash:
                raise SystemExit(
                    f"Member {email} exists without a local password (Supabase account). "
                    "Use create_admin with USE_LOCAL_AUTH=false or promote_admin.py."
                )
            existing.full_name = full_name
            existing.membership_id = membership_id
            existing.role = UserRole.ADMINISTRATOR.value
            existing.status = MemberStatus.ACTIVE.value
            existing.email_verified = True
            from v1.core.password import hash_password

            existing.password_hash = hash_password(password)
            await db.commit()
            return existing

        member = await platform_service.register_member(
            db,
            full_name=full_name,
            email=email,
            phone_number=phone_number,
            date_of_birth=date(1990, 1, 1),
            membership_id=membership_id,
            batch=batch,
            password=password,
            role=UserRole.ADMINISTRATOR.value,
            email_verified=True,
        )
        member.status = MemberStatus.ACTIVE.value
        await db.commit()
        return member


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create an OSAJA administrator account")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=True, help="Admin password (min 8 characters)")
    parser.add_argument("--full-name", default="System Administrator", help="Display name")
    parser.add_argument("--membership-id", default="OSA-ADMIN-001", help="Membership ID")
    parser.add_argument("--phone", default="0000000000", help="Phone number")
    parser.add_argument("--batch", type=int, default=2020, help="Batch year")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    if len(args.password) < 8:
        print("Error: password must be at least 8 characters", file=sys.stderr)
        sys.exit(1)

    mode = "supabase" if settings.uses_supabase_auth else "local"
    print(f"Creating administrator ({mode} auth)...")

    member = await create_admin(
        email=args.email,
        password=args.password,
        full_name=args.full_name,
        membership_id=args.membership_id,
        phone_number=args.phone,
        batch=args.batch,
    )

    print("Administrator ready:")
    print(f"  Email:          {member.email}")
    print(f"  Member ID:      {member.id}")
    print(f"  Role:           {member.role}")
    print(f"  Membership ID:  {member.membership_id}")
    print(f"  Admin login:    http://localhost:3001/login")


if __name__ == "__main__":
    asyncio.run(main())
