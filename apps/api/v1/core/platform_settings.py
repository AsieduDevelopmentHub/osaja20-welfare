"""Platform-wide settings stored in DB (payment instructions, dues amount, etc.)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.dues import MONTHLY_DUES_AMOUNT
from v1.core.models import PlatformSetting

PAYMENT_SETTINGS_KEY = "payment"

DEFAULT_PAYMENT_SETTINGS: dict = {
    "monthly_amount": MONTHLY_DUES_AMOUNT,
    "currency": "GHS",
    "title": "How to pay your dues",
    "note": (
        "After payment, the executive team will record it in the system within 24–48 hours. "
        "Contact the treasurer if your payment is not reflected."
    ),
    "momo_enabled": True,
    "momo_label": "Mobile Money (MTN)",
    "momo_detail": "Send your monthly dues to the welfare MoMo number below. Use your Member ID as the reference.",
    "momo_number": "024 XXX XXXX",
    "momo_account_name": "OSAJA'20 Welfare Fund",
    "bank_enabled": True,
    "bank_label": "Bank transfer",
    "bank_detail": "Transfer to the welfare account. Share your receipt with the treasurer on WhatsApp.",
    "bank_name": "GCB Bank",
    "bank_account_name": "OSAJA'20 Welfare Fund",
    "bank_account_number": "XXXX-XXXX-XXXX",
}


async def get_payment_settings(db: AsyncSession) -> dict:
    row = await db.get(PlatformSetting, PAYMENT_SETTINGS_KEY)
    merged = dict(DEFAULT_PAYMENT_SETTINGS)
    if row and row.value:
        merged.update(row.value)
    return merged


async def save_payment_settings(db: AsyncSession, updates: dict) -> dict:
    current = await get_payment_settings(db)
    current.update({k: v for k, v in updates.items() if v is not None})
    row = await db.get(PlatformSetting, PAYMENT_SETTINGS_KEY)
    if row:
        row.value = current
    else:
        db.add(PlatformSetting(key=PAYMENT_SETTINGS_KEY, value=current))
    await db.flush()
    return current


async def get_monthly_dues_amount(db: AsyncSession) -> float:
    settings = await get_payment_settings(db)
    return float(settings.get("monthly_amount", MONTHLY_DUES_AMOUNT))
