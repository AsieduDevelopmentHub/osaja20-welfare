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

_LOCALHOST_MARKERS = ("localhost", "127.0.0.1")


def _looks_local(url: str) -> bool:
    lower = url.strip().lower()
    return not lower or any(marker in lower for marker in _LOCALHOST_MARKERS)


def validate_settings() -> None:
    """Fail fast when production-like settings are unsafe."""
    if settings.debug:
        if settings.jwt_secret in _WEAK_JWT_SECRETS:
            logger.warning(
                "JWT_SECRET is using a default value — set a strong secret before production (DEBUG=false)"
            )
        return

    errors: list[str] = []
    warnings: list[str] = []

    if settings.jwt_secret in _WEAK_JWT_SECRETS or len(settings.jwt_secret) < 32:
        errors.append("JWT_SECRET must be at least 32 characters when DEBUG=false")

    if settings.database_url.startswith("sqlite"):
        errors.append("SQLite is not recommended when DEBUG=false — use PostgreSQL")

    if settings.uses_supabase_auth and not settings.supabase_service_key:
        errors.append("SUPABASE_SERVICE_KEY is required when using Supabase auth in production")

    if _looks_local(settings.member_portal_url):
        errors.append(
            "MEMBER_PORTAL_URL must be the live member portal URL (Paystack + password reset)"
        )

    if all(_looks_local(origin) for origin in settings.cors_origins_list):
        warnings.append(
            "CORS_ORIGINS only lists localhost — add production member/admin URLs if browsers call the API directly"
        )

    if settings.registration_auto_approve:
        warnings.append(
            "REGISTRATION_AUTO_APPROVE=true — new signups are active immediately; set false for executive approval"
        )

    if settings.allow_tunnel_cors:
        warnings.append("ALLOW_TUNNEL_CORS=true — set false in production unless using dev tunnels")

    if not settings.whatsapp_number.strip():
        warnings.append("WHATSAPP_NUMBER is empty — member contact FAB will rely on web env vars only")

    if not (settings.vapid_public_key and settings.vapid_private_key):
        warnings.append("VAPID keys missing — browser push notifications will not work")

    for message in warnings:
        logger.warning("Production config: %s", message)

    if errors:
        raise RuntimeError("Unsafe production configuration:\n- " + "\n- ".join(errors))
