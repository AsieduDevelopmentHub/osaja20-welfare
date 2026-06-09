"""Paystack REST API client."""

from __future__ import annotations

import hashlib
import hmac
from typing import Any

import httpx

from v1.core.config import settings

PAYSTACK_BASE = "https://api.paystack.co"


class PaystackError(Exception):
    pass


def is_configured() -> bool:
    return bool(settings.paystack_secret_key.strip())


def verify_webhook_signature(payload: bytes, signature: str | None) -> bool:
    secret = settings.paystack_secret_key.strip()
    if not secret or not signature:
        return False
    digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha512).hexdigest()
    return hmac.compare_digest(digest, signature)


async def initialize_transaction(
    *,
    email: str,
    amount_pesewas: int,
    reference: str,
    callback_url: str,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    if not is_configured():
        raise PaystackError("Paystack is not configured")

    headers = {"Authorization": f"Bearer {settings.paystack_secret_key}"}
    body = {
        "email": email,
        "amount": amount_pesewas,
        "reference": reference,
        "currency": "GHS",
        "callback_url": callback_url,
        "metadata": metadata,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(f"{PAYSTACK_BASE}/transaction/initialize", json=body, headers=headers)
    data = res.json()
    if not res.is_success or not data.get("status"):
        message = data.get("message", "Paystack initialize failed")
        raise PaystackError(str(message))
    return data["data"]


async def verify_transaction(reference: str) -> dict[str, Any]:
    if not is_configured():
        raise PaystackError("Paystack is not configured")

    headers = {"Authorization": f"Bearer {settings.paystack_secret_key}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(f"{PAYSTACK_BASE}/transaction/verify/{reference}", headers=headers)
    data = res.json()
    if not res.is_success or not data.get("status"):
        message = data.get("message", "Paystack verify failed")
        raise PaystackError(str(message))
    return data["data"]
