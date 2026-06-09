from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import jwt
from jwt.exceptions import PyJWTError

from v1.core.config import settings


def _api_jwt_secret() -> str:
    """Secret used for API-issued member tokens."""
    return settings.jwt_secret


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
    return jwt.encode(payload, _api_jwt_secret(), algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    secrets: list[str] = []
    for secret in (_api_jwt_secret(), settings.supabase_jwt_secret):
        if secret and secret not in secrets:
            secrets.append(secret)

    last_error: PyJWTError | None = None
    for secret in secrets:
        try:
            return jwt.decode(
                token,
                secret,
                algorithms=[settings.jwt_algorithm],
                options={"verify_aud": False},
            )
        except PyJWTError as exc:
            last_error = exc

    if last_error:
        raise last_error
    raise PyJWTError("No JWT secret configured")


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
    except PyJWTError:
        return None
