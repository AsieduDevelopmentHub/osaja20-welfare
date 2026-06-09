"""Delete all welfare data except the primary administrator account.

DESTRUCTIVE — for client handover / fresh production start only.

Usage:
  cd apps/api
  python scripts/purge_database.py --confirm PURGE --email admin@osaja.com

Requires DATABASE_URL (Supabase Postgres). Optionally clears Supabase Auth users
and Storage avatars when SUPABASE_URL + SUPABASE_SERVICE_KEY are set.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import delete, select

from v1.core.auth.supabase_client import supabase_auth
from v1.core.config import settings
from v1.core.database import async_session
from v1.core.init_db import init_database
from v1.core.models import (
    ActivityLog,
    Announcement,
    BirthdayWish,
    Contribution,
    Member,
    MemberStatus,
    Notification,
    PaymentTransaction,
    PlatformSetting,
    PushSubscription,
    SupportInquiry,
    SupportInquiryMessage,
    UserRole,
    Vote,
    VoteAuditLog,
    VoteOption,
    VoteSubmission,
    WelfareCase,
)
from v1.core.supabase_storage import supabase_storage


async def _purge_storage_except_admin(admin_id: str) -> int:
    if not supabase_storage.is_configured:
        return 0
    bucket = settings.supabase_storage_bucket
    removed = 0
    try:
        objects = await supabase_storage.list_objects(bucket)
    except Exception as exc:
        print(f"Warning: could not list storage bucket '{bucket}': {exc}")
        return 0
    for name in objects:
        if name.startswith(admin_id):
            continue
        try:
            await supabase_storage.remove(bucket, name)
            removed += 1
        except Exception:
            pass
    return removed


async def _purge_supabase_auth_except(email: str) -> int:
    if not settings.supabase_url or not settings.supabase_service_key:
        return 0
    removed = 0
    keep = email.lower()
    try:
        users = await supabase_auth.admin_list_users()
    except Exception as exc:
        print(f"Warning: could not list Supabase Auth users: {exc}")
        return 0
    for user in users:
        user_email = str(user.get("email", "")).lower()
        user_id = user.get("id")
        if not user_id or user_email == keep:
            continue
        try:
            await supabase_auth.admin_delete_user(str(user_id))
            removed += 1
        except Exception as exc:
            print(f"Warning: could not delete auth user {user_email}: {exc}")
    return removed


async def purge_database(*, admin_email: str) -> None:
    admin_email = admin_email.lower().strip()
    if settings.database_url.startswith("sqlite"):
        print("Refusing to purge SQLite — point DATABASE_URL at Supabase Postgres.")
        sys.exit(1)

    await init_database()

    async with async_session() as db:
        result = await db.execute(select(Member).where(Member.email == admin_email))
        admin = result.scalar_one_or_none()
        if not admin:
            print(f"Administrator not found: {admin_email}")
            print("Create the account first: python scripts/create_admin.py --email ...")
            sys.exit(1)

        admin_id = admin.id
        admin.role = UserRole.ADMINISTRATOR.value
        admin.status = MemberStatus.ACTIVE.value

        # Child tables first (FK-safe order)
        for model in (
            SupportInquiryMessage,
            SupportInquiry,
            VoteSubmission,
            VoteAuditLog,
            VoteOption,
            BirthdayWish,
            PushSubscription,
            Notification,
            ActivityLog,
            PaymentTransaction,
            Contribution,
            WelfareCase,
            Announcement,
            Vote,
            PlatformSetting,
        ):
            await db.execute(delete(model))

        await db.execute(delete(Member).where(Member.id != admin_id))
        await db.commit()

    storage_removed = await _purge_storage_except_admin(str(admin_id))
    auth_removed = await _purge_supabase_auth_except(admin_email)

    print("Purge complete.")
    print(f"  Kept administrator: {admin_email} ({admin_id})")
    print(f"  Storage objects removed: {storage_removed}")
    print(f"  Supabase Auth users removed: {auth_removed}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Delete all data except the primary admin.")
    parser.add_argument(
        "--confirm",
        required=True,
        help='Must be exactly "PURGE" to run',
    )
    parser.add_argument(
        "--email",
        default="admin@osaja.com",
        help="Administrator email to keep (default: admin@osaja.com)",
    )
    args = parser.parse_args()

    if args.confirm != "PURGE":
        print('Refusing to run — pass --confirm PURGE')
        sys.exit(1)

    print("WARNING: This permanently deletes members, contributions, votes, inquiries, etc.")
    print(f"Only {args.email.lower()} will remain in the members table.")
    asyncio.run(purge_database(admin_email=args.email))


if __name__ == "__main__":
    main()
