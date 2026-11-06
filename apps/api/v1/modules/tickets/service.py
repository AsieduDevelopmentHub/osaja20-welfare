import base64
import hashlib
import io
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import qrcode
from cryptography.fernet import Fernet, InvalidToken
from qrcode.image.svg import SvgPathImage
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.config import settings
from v1.core.models import (
    AdmissionTicket,
    TicketAdmission,
    TicketCategory,
    TicketEvent,
    TicketOrder,
)
from v1.core.paystack_client import PaystackError, initialize_transaction, verify_transaction

EVENT_SLUG = "bra-fie-night-2027"
ORDER_RESERVATION_MINUTES = 15
VALID_GATES = {"Gate 1", "Gate 2", "Gate 3"}
DEFAULT_EVENT_VENUE = (
    "Candix Royal Hotel, Amanfrom Sawmill Junction, opposite Seventh Day Adventist (SDA) School"
)


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _token_cipher() -> Fernet:
    configured_key = settings.ticket_token_encryption_key.strip()
    key = (
        configured_key.encode("ascii")
        if configured_key
        else base64.urlsafe_b64encode(hashlib.sha256(settings.jwt_secret.encode("utf-8")).digest())
    )
    return Fernet(key)


def _encrypt_token(token: str) -> str:
    return _token_cipher().encrypt(token.encode("utf-8")).decode("ascii")


def _decrypt_token(value: str) -> str:
    try:
        return _token_cipher().decrypt(value.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Ticket retrieval is unavailable; contact event support") from exc


async def seed_default_event(db: AsyncSession) -> None:
    existing = await db.execute(select(TicketEvent).where(TicketEvent.slug == EVENT_SLUG))
    event = existing.scalar_one_or_none()
    if event:
        if event.venue == "Venue details to be announced":
            event.venue = DEFAULT_EVENT_VENUE
        return

    event = TicketEvent(
        slug=EVENT_SLUG,
        title="Bra Fie Night 2027",
        description="A night to reconnect, celebrate, and make new memories with the OSAJA'20 family.",
        venue=DEFAULT_EVENT_VENUE,
        starts_at=datetime(2027, 1, 1, 17, tzinfo=timezone.utc),
        is_active=True,
    )
    db.add(event)
    await db.flush()
    db.add_all(
        [
            TicketCategory(
                event_id=event.id,
                name="Early Bird",
                description="Early-bird admission for one guest.",
                price=Decimal("90.00"),
                admissions_per_ticket=1,
            ),
            TicketCategory(
                event_id=event.id,
                name="Single",
                description="Admission for one guest.",
                price=Decimal("100.00"),
                admissions_per_ticket=1,
            ),
            TicketCategory(
                event_id=event.id,
                name="Double",
                description="One ticket and one QR code for two guests. Arrive together or separately.",
                price=Decimal("180.00"),
                admissions_per_ticket=2,
            ),
        ]
    )
    await db.flush()


def category_view(category: TicketCategory) -> dict:
    remaining = None
    if category.inventory_limit is not None:
        remaining = max(
            0, category.inventory_limit - category.sold_quantity - category.reserved_quantity
        )
    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "price": category.price,
        "admissions_per_ticket": category.admissions_per_ticket,
        "inventory_limit": category.inventory_limit,
        "inventory_remaining": remaining,
        "sold_quantity": category.sold_quantity,
        "reserved_quantity": category.reserved_quantity,
        "sales_start_at": category.sales_start_at,
        "sales_end_at": category.sales_end_at,
        "is_active": category.is_active,
    }


async def release_expired_orders(db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    expired = await db.execute(
        select(TicketOrder).where(
            TicketOrder.status == "pending",
            TicketOrder.expires_at <= now,
        )
    )
    for order in expired.scalars():
        claimed = await db.execute(
            update(TicketOrder)
            .where(TicketOrder.id == order.id, TicketOrder.status == "pending")
            .values(status="expired")
        )
        if claimed.rowcount:
            await db.execute(
                update(TicketCategory)
                .where(
                    TicketCategory.id == order.category_id,
                    TicketCategory.reserved_quantity >= order.quantity,
                )
                .values(reserved_quantity=TicketCategory.reserved_quantity - order.quantity)
            )
    await db.flush()


async def initialize_ticket_order(
    db: AsyncSession,
    *,
    event: TicketEvent,
    category: TicketCategory,
    quantity: int,
    purchaser_name: str,
    purchaser_email: str,
    purchaser_phone: str,
) -> dict:
    if not settings.paystack_secret_key.strip():
        raise ValueError("Online ticket payment is not configured. Please contact the organizers.")

    reference = f"osaja_ticket_{uuid4().hex}"
    amount = (category.price * quantity).quantize(Decimal("0.01"))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ORDER_RESERVATION_MINUTES)
    order = TicketOrder(
        event_id=event.id,
        category_id=category.id,
        purchaser_name=purchaser_name.strip(),
        purchaser_email=purchaser_email.strip().lower(),
        purchaser_phone=purchaser_phone.strip(),
        quantity=quantity,
        amount=amount,
        reference=reference,
        expires_at=expires_at,
    )
    db.add(order)
    await db.flush()

    try:
        payment = await initialize_transaction(
            email=order.purchaser_email,
            amount_pesewas=int(amount * 100),
            reference=reference,
            callback_url=settings.ticket_callback_url,
            metadata={
                "type": "ticket_order",
                "order_id": str(order.id),
                "event_slug": event.slug,
                "category_id": str(category.id),
                "quantity": quantity,
            },
        )
    except PaystackError as exc:
        raise ValueError(f"Unable to start ticket payment: {exc}") from exc

    order.authorization_url = payment.get("authorization_url")
    await db.flush()
    return {
        "reference": order.reference,
        "status": order.status,
        "amount": order.amount,
        "currency": order.currency,
        "quantity": order.quantity,
        "authorization_url": order.authorization_url,
    }


async def _issue_tickets(db: AsyncSession, order: TicketOrder, category: TicketCategory) -> list[dict]:
    tickets: list[AdmissionTicket] = []
    issued: list[dict] = []
    for _ in range(order.quantity):
        token = secrets.token_urlsafe(32)
        ticket = AdmissionTicket(
            order_id=order.id,
            category_id=category.id,
            token_hash=_token_hash(token),
            token_encrypted=_encrypt_token(token),
            admission_entitlement=category.admissions_per_ticket,
        )
        db.add(ticket)
        tickets.append(ticket)
        issued.append(
            {
                "category": category.name,
                "admission_entitlement": category.admissions_per_ticket,
                "token": token,
            }
        )
    await db.flush()
    return issued


async def finalize_ticket_order(
    db: AsyncSession,
    reference: str,
    *,
    amount_pesewas: int,
    currency: str,
    provider_reference: str | None = None,
) -> str:
    result = await db.execute(
        select(TicketOrder).where(TicketOrder.reference == reference).with_for_update()
    )
    order = result.scalar_one_or_none()
    if not order:
        raise ValueError("Ticket order not found")
    if order.status == "paid":
        return "paid"
    if order.status not in {"pending", "expired", "refund_required"}:
        return order.status

    expected_amount = int((order.amount * 100).quantize(Decimal("1")))
    if amount_pesewas != expected_amount or currency.upper() != order.currency:
        raise ValueError("Payment amount or currency does not match the ticket order")

    category_result = await db.execute(
        select(TicketCategory).where(TicketCategory.id == order.category_id)
    )
    category = category_result.scalar_one()

    if (
        order.status in {"expired", "refund_required"}
        or _utc(order.expires_at) <= datetime.now(timezone.utc)
    ):
        was_pending = order.status == "pending"
        order.status = "refund_required"
        order.provider_reference = provider_reference
        if was_pending:
            released = await db.execute(
                update(TicketCategory)
                .where(
                    TicketCategory.id == category.id,
                    TicketCategory.reserved_quantity >= order.quantity,
                )
                .values(reserved_quantity=TicketCategory.reserved_quantity - order.quantity)
            )
            if released.rowcount != 1:
                raise ValueError("Expired ticket inventory could not be reconciled")
        await db.flush()
        return "refund_required"

    claimed = await db.execute(
        update(TicketOrder)
        .where(TicketOrder.id == order.id, TicketOrder.status == "pending")
        .values(status="paid", paid_at=datetime.now(timezone.utc), provider_reference=provider_reference)
    )
    if claimed.rowcount != 1:
        await db.refresh(order)
        return order.status

    moved_inventory = await db.execute(
        update(TicketCategory)
        .where(
            TicketCategory.id == category.id,
            TicketCategory.reserved_quantity >= order.quantity,
        )
        .values(
            reserved_quantity=TicketCategory.reserved_quantity - order.quantity,
            sold_quantity=TicketCategory.sold_quantity + order.quantity,
        )
    )
    if moved_inventory.rowcount != 1:
        raise ValueError("Reserved ticket inventory could not be reconciled")

    await _issue_tickets(db, order, category)
    return "paid"


async def fail_ticket_order(db: AsyncSession, reference: str) -> str:
    result = await db.execute(
        select(TicketOrder).where(TicketOrder.reference == reference).with_for_update()
    )
    order = result.scalar_one_or_none()
    if not order or order.status != "pending":
        return order.status if order else "not_found"

    changed = await db.execute(
        update(TicketOrder)
        .where(TicketOrder.id == order.id, TicketOrder.status == "pending")
        .values(status="failed")
    )
    if changed.rowcount:
        released = await db.execute(
            update(TicketCategory)
            .where(
                TicketCategory.id == order.category_id,
                TicketCategory.reserved_quantity >= order.quantity,
            )
            .values(reserved_quantity=TicketCategory.reserved_quantity - order.quantity)
        )
        if released.rowcount != 1:
            raise ValueError("Failed ticket inventory could not be released")
        return "failed"


async def verify_ticket_order(db: AsyncSession, reference: str) -> str:
    if not settings.paystack_secret_key.strip():
        raise ValueError("Online ticket payment is not configured")
    result = await db.execute(select(TicketOrder).where(TicketOrder.reference == reference))
    order = result.scalar_one_or_none()
    if not order:
        raise ValueError("Ticket order not found")
    if order.status != "pending":
        return order.status

    try:
        payment = await verify_transaction(reference)
    except PaystackError as exc:
        raise ValueError(f"Unable to verify payment: {exc}") from exc

    status = str(payment.get("status", "")).lower()
    if status != "success":
        if status in {"failed", "abandoned"}:
            return await fail_ticket_order(db, reference)
        return "pending"

    if str(payment.get("customer", {}).get("email", "")).lower() != order.purchaser_email:
        raise ValueError("The verified payment email does not match the ticket order")

    return await finalize_ticket_order(
        db,
        reference,
        amount_pesewas=int(payment.get("amount", 0)),
        currency=str(payment.get("currency", "")),
        provider_reference=str(payment.get("id", "")) or None,
    )


async def retrieve_order_tickets(
    db: AsyncSession,
    reference: str,
    purchaser_email: str,
) -> list[dict]:
    result = await db.execute(
        select(TicketOrder, TicketCategory)
        .join(TicketCategory, TicketCategory.id == TicketOrder.category_id)
        .where(
            TicketOrder.reference == reference,
            TicketOrder.purchaser_email == purchaser_email.strip().lower(),
            TicketOrder.status == "paid",
        )
    )
    order_category = result.first()
    if not order_category:
        raise ValueError("Paid ticket order not found for this email")

    order, category = order_category
    tickets_result = await db.execute(
        select(AdmissionTicket).where(AdmissionTicket.order_id == order.id)
    )
    tickets = []
    for ticket in tickets_result.scalars():
        token = _decrypt_token(ticket.token_encrypted)
        tickets.append({
            "category": category.name,
            "admission_entitlement": ticket.admission_entitlement,
            "admissions_used": ticket.admissions_used,
            "admissions_remaining": ticket.admission_entitlement - ticket.admissions_used,
            "status": ticket.status,
            "token": token,
            "qr_svg_base64": base64.b64encode(make_ticket_qr(token)).decode("ascii"),
        })
    return tickets


async def handle_ticket_webhook(db: AsyncSession, event: str, data: dict) -> bool:
    reference = str(data.get("reference", ""))
    if not reference.startswith("osaja_ticket_"):
        return False
    if event == "charge.success" and str(data.get("status", "")).lower() == "success":
        await finalize_ticket_order(
            db,
            reference,
            amount_pesewas=int(data.get("amount", 0)),
            currency=str(data.get("currency", "")),
            provider_reference=str(data.get("id", "")) or None,
        )
    elif event == "charge.failed":
        await fail_ticket_order(db, reference)
    return True


def make_ticket_qr(token: str) -> bytes:
    code = qrcode.QRCode(version=None, box_size=8, border=2)
    code.add_data(token)
    code.make(fit=True)
    image = code.make_image(image_factory=SvgPathImage)
    output = io.BytesIO()
    image.save(output)
    return output.getvalue()
