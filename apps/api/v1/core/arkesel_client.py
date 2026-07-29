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

    Accepts common local storage formats, for example:
    - ``0553995047``
    - ``+233553995047`` / ``233553995047``
    - ``+233 55 399 5047``
    - ``00233553995047``
    - ``2330553995047`` (country code + local leading 0)

    Arkesel expects recipients like ``["233553995047"]``.
    """
    digits = re.sub(r"\D", "", phone or "")
    if not digits:
        return None

    # International dial-out prefix
    if digits.startswith("00"):
        digits = digits[2:]

    # Country code + local leading zero: 2330XXXXXXXXX
    if digits.startswith("2330") and len(digits) >= 13:
        digits = "233" + digits[4:]
        if len(digits) > 12:
            digits = digits[:12]

    # Local format 0XXXXXXXXX (10 digits)
    if digits.startswith("0") and len(digits) == 10:
        digits = "233" + digits[1:]
    # Already E.164 Ghana without plus
    elif digits.startswith("233") and len(digits) == 12:
        pass
    # National significant number only (9 digits), e.g. 553995047
    elif len(digits) == 9 and digits[0] in "23456789":
        digits = "233" + digits
    # Soft recovery for longer 233… values
    elif digits.startswith("233") and len(digits) > 12:
        rest = digits[3:].lstrip("0")
        if len(rest) >= 9:
            digits = "233" + rest[:9]
        else:
            return None
    else:
        return None

    if not re.fullmatch(r"233[2-9]\d{8}", digits):
        return None

    national = digits[3:]
    if len(set(national)) == 1:
        return None
    return digits


def parse_phone_list(raw_phones: list[str] | str | None) -> tuple[list[str], list[str]]:
    """Split free-text / list phones into (valid_msisdns, invalid_raw_entries)."""
    if raw_phones is None:
        return [], []
    if isinstance(raw_phones, str):
        chunks = re.split(r"[\s,;]+", raw_phones)
    else:
        chunks = []
        for item in raw_phones:
            chunks.extend(re.split(r"[\s,;]+", str(item)))

    valid: list[str] = []
    invalid: list[str] = []
    seen: set[str] = set()
    for chunk in chunks:
        text = chunk.strip()
        if not text:
            continue
        msisdn = normalize_gh_msisdn(text)
        if not msisdn:
            invalid.append(text)
            continue
        if msisdn in seen:
            continue
        seen.add(msisdn)
        valid.append(msisdn)
    return valid, invalid


# GSM-7 basic set (3GPP TS 23.038). Extended set costs 2 septets each.
_GSM7_BASIC = (
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?"
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
)
_GSM7_EXTENDED = frozenset("^\\{}[~]|€")


def _is_gsm7(message: str) -> bool:
    for ch in message or "":
        if ch not in _GSM7_BASIC and ch not in _GSM7_EXTENDED:
            return False
    return True


def _gsm7_septet_count(message: str) -> int:
    return sum(2 if ch in _GSM7_EXTENDED else 1 for ch in (message or ""))


def sms_page_count(message: str) -> int:
    """Estimate SMS pages using GSM-7 (160/153) or UCS-2 (70/67) rules."""
    if not message:
        return 0
    if _is_gsm7(message):
        septets = _gsm7_septet_count(message)
        if septets <= 160:
            return 1
        return (septets + 152) // 153
    # UCS-2 / Unicode — count code points
    length = len(message)
    if length <= 70:
        return 1
    return (length + 66) // 67


def sms_encoding(message: str) -> str:
    return "GSM-7" if _is_gsm7(message or "") else "UCS-2"


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
    resolved_callback = callback_url if callback_url is not None else settings.arkesel_callback_url
    if resolved_callback:
        body["callback_url"] = resolved_callback

    logger.info(
        "Arkesel send: recipients=%s sandbox=%s scheduled=%s callback=%s",
        len(cleaned),
        use_sandbox,
        bool(scheduled_date),
        bool(resolved_callback),
    )

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

    nested = data.get("data") if isinstance(data.get("data"), dict) else {}
    sms_balance = nested.get("sms_balance", data.get("sms_balance"))
    main_balance = nested.get("main_balance", data.get("main_balance"))
    return {
        "sms_balance": sms_balance,
        "main_balance": main_balance,
        "status": data.get("status"),
    }


async def get_sms_details(message_id: str) -> dict[str, Any]:
    if not is_configured():
        raise ArkeselError("Arkesel is not configured — set ARKESEL_API_KEY")

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(f"{_base()}/sms/{message_id}", headers=_headers())

    try:
        data = res.json()
    except Exception as exc:
        raise ArkeselError(
            f"Arkesel SMS details returned invalid JSON ({res.status_code})",
            status_code=res.status_code,
        ) from exc

    if not res.is_success:
        message_text = data.get("message") or data.get("error") or f"SMS details failed ({res.status_code})"
        raise ArkeselError(str(message_text), status_code=res.status_code, payload=data)
    return data
