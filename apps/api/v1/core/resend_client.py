"""Resend transactional email client for ticket delivery."""

from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from v1.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


class ResendError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None, payload: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


def is_configured() -> bool:
    return bool(settings.resend_api_key.strip() and _from_address())


def _from_address() -> str:
    """Build Resend `from` as `Name <email>` when a display name is configured."""
    raw = settings.resend_from_email.strip()
    if not raw:
        return ""

    # Already "Name <email@domain>"
    if "<" in raw and ">" in raw:
        return raw

    # Bare email — attach configured display name
    name = settings.resend_from_name.strip() or "OSAJA'20 Welfare"
    # Escape quotes in display name for RFC 5322 style
    safe_name = name.replace('"', "")
    return f"{safe_name} <{raw}>"


def send_email(
    *,
    to_email: str,
    subject: str,
    body_text: str,
    body_html: str | None = None,
    attachments: list[dict] | None = None,
) -> dict:
    if not is_configured():
        raise ResendError("Resend is not configured on the server")

    payload: dict[str, Any] = {
        "from": _from_address(),
        "to": [to_email.strip()],
        "subject": subject,
        "text": body_text,
    }
    if body_html:
        payload["html"] = body_html
    if attachments:
        payload["attachments"] = attachments

    headers = {
        "Authorization": f"Bearer {settings.resend_api_key.strip()}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(RESEND_API_URL, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise ResendError(f"Resend request failed: {exc}") from exc

    try:
        data = response.json()
    except ValueError:
        data = {"raw": response.text}

    if response.status_code >= 400:
        message = data.get("message") if isinstance(data, dict) else str(data)
        raise ResendError(
            message or f"Resend returned HTTP {response.status_code}",
            status_code=response.status_code,
            payload=data,
        )

    logger.info("Resend email sent to %s — %s", to_email, subject)
    return data if isinstance(data, dict) else {"result": data}


def attachment_from_bytes(*, filename: str, content: bytes, content_id: str | None = None) -> dict:
    item = {
        "filename": filename,
        "content": base64.b64encode(content).decode("ascii"),
    }
    if content_id:
        item["content_id"] = content_id
    return item
