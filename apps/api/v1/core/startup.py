"""Startup validation for production safety."""

import logging

from v1.core.config import settings

logger = logging.getLogger(__name__)

_WEAK_JWT_SECRETS = frozenset(
    {
        "",
        "change-me-in-production",
        "change-me-in-production-use-long-random-string",
    }
)


def validate_settings() -> None:
    """Fail fast when production-like settings are unsafe."""
    if settings.debug:
        if settings.jwt_secret in _WEAK_JWT_SECRETS:
            logger.warning(
                "JWT_SECRET is using a default value — set a strong secret before production (DEBUG=false)"
            )
        return

    errors: list[str] = []

    if settings.jwt_secret in _WEAK_JWT_SECRETS or len(settings.jwt_secret) < 32:
        errors.append("JWT_SECRET must be at least 32 characters when DEBUG=false")

    if settings.database_url.startswith("sqlite"):
        errors.append("SQLite is not recommended when DEBUG=false — use PostgreSQL")

    if settings.uses_supabase_auth and not settings.supabase_service_key:
        errors.append("SUPABASE_SERVICE_KEY is required when using Supabase auth in production")

    if errors:
        raise RuntimeError("Unsafe production configuration:\n- " + "\n- ".join(errors))
