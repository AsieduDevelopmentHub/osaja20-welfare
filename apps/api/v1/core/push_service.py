"""Web Push delivery via VAPID (pywebpush)."""

from __future__ import annotations

import json
import logging
from typing import Any

from pywebpush import WebPushException, webpush

from v1.core.config import settings
from v1.core.member_preferences import merge_preferences

logger = logging.getLogger(__name__)

NOTIFICATION_PREF_KEY: dict[str, str] = {
    "contribution": "notify_dues",
    "voting": "notify_votes",
    "celebration": "notify_celebrations",
    "announcement": "notify_announcements",
    "welfare": "notify_welfare",
    "meeting": "notify_announcements",
}


def is_push_configured() -> bool:
    return bool(settings.vapid_public_key and settings.vapid_private_key and settings.vapid_contact_email)


def get_vapid_public_key() -> str | None:
    return settings.vapid_public_key or None


def member_allows_push_type(preferences_json: dict | None, notification_type: str) -> bool:
    prefs = merge_preferences(preferences_json)
    key = NOTIFICATION_PREF_KEY.get(notification_type)
    if not key:
        return True
    return bool(prefs.get(key, True))


def build_payload(*, title: str, message: str, notification_type: str, url: str = "/notifications") -> str:
    return json.dumps(
        {
            "title": title,
            "body": message,
            "type": notification_type,
            "url": url,
        }
    )


def send_web_push(*, endpoint: str, p256dh_key: str, auth_key: str, payload: str) -> None:
    if not is_push_configured():
        raise RuntimeError("VAPID keys are not configured")

    webpush(
        subscription_info={
            "endpoint": endpoint,
            "keys": {"p256dh": p256dh_key, "auth": auth_key},
        },
        data=payload,
        vapid_private_key=settings.vapid_private_key,
        vapid_claims={"sub": f"mailto:{settings.vapid_contact_email}"},
    )


def is_subscription_gone(exc: WebPushException) -> bool:
    if exc.response is not None and exc.response.status_code in (404, 410):
        return True
    return "410" in str(exc) or "404" in str(exc)
