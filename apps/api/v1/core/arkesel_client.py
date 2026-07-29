"""Arkesel SMS REST client (v2)."""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from v1.core.config import settings

logger = logging.getLogger(__name__)


class ArkeselError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None, payload: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


def is_configured() -> bool:
    return settings.arkesel_enabled


def normalize_gh_msisdn(phone: str) -> str | None:
    """Normalize Ghana mobile numbers to 233XXXXXXXXX (no plus).

    Arkesel expects recipients like ``["233553995047", "233544919953"]``.
    Placeholder numbers (e.g. 0000000000) are rejected.
    """
    digits = re.sub(r"\D", "", phone or "")
    if not digits:
        return None
    if digits.startswith("2330") and len(digits) == 13:
        digits = "233" + digits[4:]
    elif digits.startswith("0") and len(digits) == 10:
        digits = "233" + digits[1:]
    elif len(digits) == 9:
        digits = "233" + digits
    elif digits.startswith("233") and len(digits) == 12:
        pass
    else:
        return None

    # Ghana mobile: 233 + 9 digits, first of those must be 2–9 (not 0).
    if not re.fullmatch(r"233[2-9]\d{8}", digits):
        return None
    # Reject obvious placeholders (000000000, 111111111, …)
    national = digits[3:]
    if len(set(national)) == 1:
        return None
    return digits


def sms_page_count(message: str) -> int:
    """Estimate SMS pages (GSM-7 approximation: 160 / 153 concatenated)."""
    length = len(message or "")
    if length <= 0:
        return 0
    if length <= 160:
        return 1
    return (length + 152) // 153


def estimate_units(message: str, recipient_count: int) -> int:
    return sms_page_count(message) * max(recipient_count, 0)


def _headers() -> dict[str, str]:
    return {
        "api-key": settings.arkesel_api_key.strip(),
        "Content-Type": "application/json",
    }


def _base() -> str:
    return settings.arkesel_base_url.rstrip("/")


async def send_sms(
    *,
    message: str,
    recipients: list[str],
    sender: str | None = None,
    scheduled_date: str | None = None,
    sandbox: bool | None = None,
    callback_url: str | None = None,
) -> dict[str, Any]:
    if not is_configured():
        raise ArkeselError("Arkesel is not configured — set ARKESEL_API_KEY")

    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in recipients:
        msisdn = normalize_gh_msisdn(raw)
        if msisdn and msisdn not in seen:
            seen.add(msisdn)
            cleaned.append(msisdn)

    if not cleaned:
        raise ArkeselError("No valid recipient phone numbers")

    body: dict[str, Any] = {
        "sender": (sender or settings.arkesel_sender)[:11],
        "message": message,
        "recipients": cleaned,
    }
    if scheduled_date:
        body["scheduled_date"] = scheduled_date
    use_sandbox = settings.arkesel_sandbox if sandbox is None else sandbox
    if use_sandbox:
        body["sandbox"] = True
    if callback_url:
        body["callback_url"] = callback_url

    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(f"{_base()}/sms/send", json=body, headers=_headers())

    try:
        data = res.json()
    except Exception as exc:
        raise ArkeselError(
            f"Arkesel returned invalid JSON ({res.status_code})",
            status_code=res.status_code,
        ) from exc

    if not res.is_success:
        message_text = (
            data.get("message")
            or data.get("error")
            or data.get("status")
            or f"Arkesel send failed ({res.status_code})"
        )
        raise ArkeselError(str(message_text), status_code=res.status_code, payload=data)

    status = str(data.get("status", "")).lower()
    if status and status not in {"success", "ok"}:
        message_text = data.get("message") or data.get("error") or status
        raise ArkeselError(str(message_text), status_code=res.status_code, payload=data)

    return data


async def get_balance() -> dict[str, Any]:
    if not is_configured():
        raise ArkeselError("Arkesel is not configured — set ARKESEL_API_KEY")

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(f"{_base()}/clients/balance-details", headers=_headers())

    try:
        data = res.json()
    except Exception as exc:
        raise ArkeselError(
            f"Arkesel balance returned invalid JSON ({res.status_code})",
            status_code=res.status_code,
        ) from exc

    if not res.is_success:
        message_text = data.get("message") or data.get("error") or f"Balance check failed ({res.status_code})"
        raise ArkeselError(str(message_text), status_code=res.status_code, payload=data)

    return data
