"""Member ID / username generation and login identifier resolution."""

from __future__ import annotations

import re
import secrets

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.models import Member

USERNAME_PATTERN = re.compile(r"^[a-z0-9_]{3,30}$")


def normalize_username(value: str) -> str:
    return value.strip().lower()


def validate_username(value: str) -> str:
    normalized = normalize_username(value)
    if not USERNAME_PATTERN.match(normalized):
        raise ValueError("Username must be 3–30 characters: lowercase letters, numbers, underscores only")
    return normalized


def slugify_username(full_name: str, email: str) -> str:
    from_name = re.sub(r"[^a-z0-9]", "", full_name.lower().replace(" ", ""))
    if len(from_name) >= 3:
        return from_name[:20]
    local = email.split("@")[0].lower()
    local = re.sub(r"[^a-z0-9_]", "", local)
    return (local or "member")[:20]


async def generate_membership_id(db: AsyncSession, batch: int) -> str:
    prefix = f"OSA{batch}-"
    result = await db.execute(select(Member.membership_id).where(Member.membership_id.like(f"{prefix}%")))
    nums: list[int] = []
    for (mid,) in result:
        suffix = mid.rsplit("-", 1)[-1]
        if suffix.isdigit():
            nums.append(int(suffix))
    next_num = max(nums, default=0) + 1
    candidate = f"{prefix}{next_num:05d}"
    # Rare collision fallback
    existing = await db.execute(select(Member.id).where(Member.membership_id == candidate))
    if existing.scalar_one_or_none():
        candidate = f"{prefix}{next_num:05d}{secrets.token_hex(2).upper()}"
    return candidate


async def generate_username(db: AsyncSession, full_name: str, email: str) -> str:
    base = slugify_username(full_name, email)
    if len(base) < 3:
        base = f"member{secrets.token_hex(2)}"

    candidate = base
    for i in range(100):
        result = await db.execute(select(Member.id).where(Member.username == candidate))
        if not result.scalar_one_or_none():
            return candidate
        candidate = f"{base}{i + 1}"[:30]

    return f"{base}{secrets.token_hex(3)}"[:30]


async def resolve_member_by_identifier(db: AsyncSession, identifier: str) -> Member | None:
    key = identifier.strip()
    if not key:
        return None

    if "@" in key:
        result = await db.execute(select(Member).where(Member.email == key.lower()))
        return result.scalar_one_or_none()

    key_lower = key.lower()
    result = await db.execute(
        select(Member).where(
            or_(
                Member.username == key_lower,
                func.lower(Member.membership_id) == key_lower,
                Member.email == key_lower,
            )
        )
    )
    return result.scalar_one_or_none()
