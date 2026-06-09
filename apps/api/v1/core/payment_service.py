"""Paystack dues payments — initialize, verify, webhook."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.config import settings
from v1.core.models import Member, PaymentTransaction
from v1.core.paystack_client import PaystackError, initialize_transaction, verify_transaction
from v1.core.platform_settings import get_monthly_dues_amount, get_payment_settings
from v1.core.services import platform_service

logger = logging.getLogger(__name__)


def _callback_url() -> str:
    base = settings.member_portal_url.rstrip("/")
    return f"{base}/contributions/callback"


def _unpaid_periods(dues_summary: dict) -> list[dict]:
    return [
        {"year": p["year"], "month": p["month"]}
        for p in dues_summary.get("periods", [])
        if p.get("status") in ("due", "overdue")
    ]


def _period_key(year: int, month: int) -> str:
    return f"{year}-{month:02d}"


def _member_ref_suffix(membership_id: str) -> str:
    digits = re.sub(r"\D", "", membership_id or "")
    if not digits:
        return "000"
    return digits[-3:].zfill(3)


async def _build_paystack_reference(
    db: AsyncSession,
    member: Member,
    periods: list[dict],
) -> str:
    """osaja{member3}{MM}{YYYY} — e.g. osaja001062026"""
    primary = sorted(periods, key=lambda p: (p["year"], p["month"]))[0]
    base = (
        f"osaja{_member_ref_suffix(member.membership_id)}"
        f"{primary['month']:02d}{primary['year']}"
    )
    reference = base
    for attempt in range(1, 20):
        existing = await db.execute(
            select(PaymentTransaction.id).where(PaymentTransaction.reference == reference)
        )
        if not existing.scalar_one_or_none():
            return reference
        reference = f"{base}{attempt}"
    return f"{base}{uuid4().hex[:4]}"


async def _validate_periods(
    db: AsyncSession,
    member: Member,
    periods: list[dict],
) -> tuple[list[dict], float]:
    if not periods:
        raise ValueError("Select at least one month to pay")

    dues = await platform_service.get_member_dues(db, member)
    unpaid = {_period_key(p["year"], p["month"]): p for p in _unpaid_periods(dues)}
    monthly = await get_monthly_dues_amount(db)

    normalized: list[dict] = []
    seen: set[str] = set()
    for raw in periods:
        year = int(raw["year"])
        month = int(raw["month"])
        key = _period_key(year, month)
        if key in seen:
            continue
        if key not in unpaid:
            raise ValueError(f"{month}/{year} is not payable (already paid or not due)")
        seen.add(key)
        normalized.append({"year": year, "month": month})

    if not normalized:
        raise ValueError("No payable months selected")

    amount = round(monthly * len(normalized), 2)
    return normalized, amount


def _transaction_to_dict(tx: PaymentTransaction) -> dict:
    return {
        "id": str(tx.id),
        "reference": tx.reference,
        "status": tx.status,
        "amount": float(tx.amount),
        "currency": tx.currency,
        "periods": tx.periods_json or [],
        "contribution_ids": tx.contribution_ids_json or [],
        "authorization_url": tx.authorization_url,
        "created_at": tx.created_at.isoformat() if tx.created_at else None,
        "completed_at": tx.completed_at.isoformat() if tx.completed_at else None,
    }


async def initialize_dues_payment(
    db: AsyncSession,
    member: Member,
    periods: list[dict],
) -> dict:
    payment_settings = await get_payment_settings(db)
    if not payment_settings.get("paystack_enabled", True):
        raise ValueError("Online payments are not enabled")
    if not settings.paystack_secret_key.strip():
        raise ValueError("Paystack is not configured on the server")

    normalized, amount = await _validate_periods(db, member, periods)
    reference = await _build_paystack_reference(db, member, normalized)
    amount_pesewas = int(round(amount * 100))

    tx = PaymentTransaction(
        id=uuid4(),
        member_id=member.id,
        amount=Decimal(str(amount)),
        currency="GHS",
        status="pending",
        reference=reference,
        periods_json=normalized,
    )
    db.add(tx)
    await db.flush()

    try:
        data = await initialize_transaction(
            email=member.email,
            amount_pesewas=amount_pesewas,
            reference=reference,
            callback_url=_callback_url(),
            metadata={
                "member_id": str(member.id),
                "membership_id": member.membership_id,
                "periods": normalized,
                "transaction_id": str(tx.id),
            },
        )
    except PaystackError as exc:
        tx.status = "failed"
        await db.flush()
        raise ValueError(str(exc)) from exc

    tx.authorization_url = data.get("authorization_url")
    tx.paystack_access_code = data.get("access_code")
    await db.flush()

    result = _transaction_to_dict(tx)
    result["authorization_url"] = data.get("authorization_url")
    return result


async def complete_payment_if_successful(
    db: AsyncSession,
    reference: str,
    *,
    actor_id: UUID | None = None,
) -> dict:
    result = await db.execute(
        select(PaymentTransaction).where(PaymentTransaction.reference == reference)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise ValueError("Payment not found")

    if tx.status == "success":
        return _transaction_to_dict(tx)

    try:
        paystack_data = await verify_transaction(reference)
    except PaystackError as exc:
        raise ValueError(str(exc)) from exc

    status = str(paystack_data.get("status", "")).lower()
    if status != "success":
        tx.status = "failed" if status in ("failed", "abandoned") else tx.status
        await db.flush()
        raise ValueError(f"Payment not completed (status: {status or 'unknown'})")

    amount_paid = float(paystack_data.get("amount", 0)) / 100.0
    if abs(amount_paid - float(tx.amount)) > 0.01:
        logger.warning(
            "Paystack amount mismatch for %s: expected %s got %s",
            reference,
            tx.amount,
            amount_paid,
        )

    tx.paystack_reference = str(paystack_data.get("reference") or reference)
    contribution_ids: list[str] = list(tx.contribution_ids_json or [])
    monthly = await get_monthly_dues_amount(db)
    periods = list(tx.periods_json or [])

    member_result = await db.execute(select(Member).where(Member.id == tx.member_id))
    member = member_result.scalar_one_or_none()
    if not member:
        raise ValueError("Member not found for payment")

    for period in periods:
        period_ref = f"{reference}-{period['month']:02d}"
        try:
            record = await platform_service.record_contribution(
                db,
                {
                    "member_id": str(member.id),
                    "amount": monthly,
                    "type": "dues",
                    "reference": period_ref,
                    "period_year": period["year"],
                    "period_month": period["month"],
                    "created_by": str(member.id),
                },
                actor_id=actor_id or member.id,
            )
            contribution_ids.append(record["id"])
        except ValueError as exc:
            if "already recorded" in str(exc).lower():
                logger.info("Skipping already-recorded period %s for %s", period, reference)
                continue
            raise

    tx.status = "success"
    tx.contribution_ids_json = contribution_ids
    tx.completed_at = datetime.now(timezone.utc)
    await db.flush()

    return _transaction_to_dict(tx)


async def handle_paystack_webhook(db: AsyncSession, event: str, data: dict) -> dict | None:
    if event != "charge.success":
        return None

    reference = str(data.get("reference", ""))
    if not reference:
        return None

    try:
        return await complete_payment_if_successful(db, reference)
    except ValueError as exc:
        logger.warning("Webhook payment completion skipped for %s: %s", reference, exc)
        return None
