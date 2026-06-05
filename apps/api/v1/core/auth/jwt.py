from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from jose import JWTError, jwt

from v1.core.config import settings


def _jwt_secret() -> str:
    return settings.supabase_jwt_secret or settings.jwt_secret


def create_access_token(
    subject: str,
    *,
    email: str,
    role: str,
    member_id: str,
    expires_minutes: int | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.jwt_expire_minutes
    )
    payload = {
        "sub": subject,
        "email": email,
        "role": role,
        "member_id": member_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "aud": "authenticated",
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        _jwt_secret(),
        algorithms=[settings.jwt_algorithm],
        options={"verify_aud": False},
    )


def extract_member_id(payload: dict[str, Any]) -> UUID | None:
    raw = payload.get("member_id") or payload.get("user_metadata", {}).get("member_id")
    if raw:
        return UUID(str(raw))
    return None


def extract_role(payload: dict[str, Any]) -> str:
    return (
        payload.get("role")
        or payload.get("app_metadata", {}).get("role")
        or payload.get("user_metadata", {}).get("role")
        or "member"
    )


def safe_decode(token: str) -> dict[str, Any] | None:
    try:
        return decode_token(token)
    except JWTError:
        return None
