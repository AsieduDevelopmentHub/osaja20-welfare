"""Supabase Auth helpers — member linking and token handling."""

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.supabase_client import SupabaseAuthError
from v1.core.models import Member, MemberStatus
from v1.core.services import platform_service


def extract_supabase_user(response: dict) -> dict:
    """Normalize signup/signin payloads — user may be nested or top-level."""
    user = response.get("user")
    if isinstance(user, dict) and user.get("id"):
        return user
    if response.get("id"):
        return response
    return {}


def is_duplicate_signup_error(error: SupabaseAuthError) -> bool:
    message = str(error).lower()
    return error.status_code in (400, 422) and any(
        phrase in message
        for phrase in ("already registered", "already been registered", "user already exists")
    )


async def find_member_for_supabase_user(
    db: AsyncSession,
    *,
    auth_user_id: str,
    email: str | None = None,
) -> Member | None:
    result = await db.execute(select(Member).where(Member.auth_user_id == UUID(auth_user_id)))
    member = result.scalar_one_or_none()
    if member:
        return member

    if email:
        result = await db.execute(select(Member).where(Member.email == email.lower()))
        member = result.scalar_one_or_none()
        if member:
            member.auth_user_id = UUID(auth_user_id)
            await db.flush()
            return member

    return None


async def link_or_create_member_from_supabase(
    db: AsyncSession,
    *,
    user: dict,
    session: dict | None = None,
    profile: dict | None = None,
) -> Member:
    auth_user_id = user["id"]
    email = (user.get("email") or (profile or {}).get("email") or "").lower()
    metadata = user.get("user_metadata") or {}
    profile = profile or {}

    existing = await find_member_for_supabase_user(db, auth_user_id=auth_user_id, email=email)
    if existing:
        if not existing.email_verified and user.get("email_confirmed_at"):
            existing.email_verified = True
            existing.status = MemberStatus.ACTIVE.value
        await db.flush()
        return existing

    dob_raw = profile.get("date_of_birth") or metadata.get("date_of_birth") or "1990-01-01"
    if isinstance(dob_raw, date):
        dob = dob_raw
    elif isinstance(dob_raw, str):
        dob = date.fromisoformat(dob_raw)
    else:
        dob = date(1990, 1, 1)

    member = await platform_service.register_member(
        db,
        full_name=profile.get("full_name") or metadata.get("full_name") or email.split("@")[0],
        email=email,
        phone_number=profile.get("phone_number") or metadata.get("phone_number") or "0000000000",
        date_of_birth=dob,
        membership_id=profile.get("membership_id")
        or metadata.get("membership_id")
        or f"OSA-{auth_user_id[:8].upper()}",
        batch=int(profile.get("batch") or metadata.get("batch") or 2020),
        password=None,
        auth_user_id=UUID(auth_user_id),
        email_verified=bool(user.get("email_confirmed_at")),
    )
    member.status = MemberStatus.ACTIVE.value
    await db.flush()
    return member


def session_token_response(session: dict) -> dict:
    return {
        "access_token": session["access_token"],
        "token_type": session.get("token_type", "bearer"),
        "expires_in": session.get("expires_in", 3600),
    }


def member_token_response(member: Member) -> dict:
    """Issue an API JWT the backend can always validate (includes member_id)."""
    from v1.core.auth.jwt import create_access_token
    from v1.core.config import settings

    token = create_access_token(
        subject=str(member.auth_user_id or member.id),
        email=member.email,
        role=member.role,
        member_id=str(member.id),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": settings.jwt_expire_minutes * 60,
    }
