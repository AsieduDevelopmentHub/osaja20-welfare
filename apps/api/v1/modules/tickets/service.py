import base64
import hashlib
import io
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

import qrcode
from cryptography.fernet import Fernet, InvalidToken
from qrcode.image.svg import SvgPathImage
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core import arkesel_client, resend_client
from v1.core.config import settings
from v1.core.models import (
    AdmissionTicket,
    TicketAdmission,
    TicketCategory,
    TicketEvent,
    TicketOrder,
)
from v1.core.paystack_client import PaystackError, initialize_transaction, verify_transaction
from v1.core.platform_settings import get_payment_settings
from v1.core.services import platform_service

logger = logging.getLogger(__name__)

EVENT_SLUG = "bra-fie-night-2027"
ORDER_RESERVATION_MINUTES = 15
MANUAL_ORDER_RESERVATION_HOURS = 24
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
            TicketOrder.status.in_(("pending", "awaiting_payment")),
            TicketOrder.expires_at <= now,
        )
    )
    for order in expired.scalars():
        claimed = await db.execute(
            update(TicketOrder)
            .where(TicketOrder.id == order.id, TicketOrder.status == order.status)
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


def normalize_purchaser_email(value: str | None) -> str | None:
    cleaned = (value or "").strip().lower()
    return cleaned or None


def phones_match(stored: str, provided: str) -> bool:
    stored_digits = re.sub(r"\D", "", stored or "")
    provided_digits = re.sub(r"\D", "", provided or "")
    if not stored_digits or not provided_digits:
        return False
    if stored_digits == provided_digits:
        return True
    normalized_stored = arkesel_client.normalize_gh_msisdn(stored)
    normalized_provided = arkesel_client.normalize_gh_msisdn(provided)
    return bool(normalized_stored and normalized_provided and normalized_stored == normalized_provided)


def order_matches_identity(
    order: TicketOrder,
    *,
    purchaser_email: str | None = None,
    purchaser_phone: str | None = None,
) -> bool:
    email = normalize_purchaser_email(purchaser_email)
    if email and order.purchaser_email and order.purchaser_email == email:
        return True
    if purchaser_phone and phones_match(order.purchaser_phone, purchaser_phone):
        return True
    return False


async def initialize_ticket_order(
    db: AsyncSession,
    *,
    event: TicketEvent,
    category: TicketCategory,
    quantity: int,
    purchaser_name: str,
    purchaser_email: str | None,
    purchaser_phone: str,
    payment_method: str,
    payment_details: dict | None = None,
) -> dict:
    if payment_method == "paystack" and not settings.paystack_secret_key.strip():
        raise ValueError("Online ticket payment is not configured. Please contact the organizers.")

    email = normalize_purchaser_email(purchaser_email)
    if payment_method == "paystack" and not email:
        raise ValueError("Email is required for Paystack ticket payments.")

    amount = (category.price * quantity).quantize(Decimal("0.01"))
    manual_payment = payment_method in {"momo", "bank"}
    expires_at = datetime.now(timezone.utc) + (
        timedelta(hours=MANUAL_ORDER_RESERVATION_HOURS)
        if manual_payment
        else timedelta(minutes=ORDER_RESERVATION_MINUTES)
    )
    for attempt in range(5):
        reference = f"TKT_{base64.b32encode(secrets.token_bytes(9)).decode('ascii')[:13]}"
        order = TicketOrder(
            event_id=event.id,
            category_id=category.id,
            purchaser_name=purchaser_name.strip(),
            purchaser_email=email,
            purchaser_phone=purchaser_phone.strip(),
            quantity=quantity,
            amount=amount,
            reference=reference,
            payment_method=payment_method,
            payment_details=payment_details,
            status="awaiting_payment" if manual_payment else "pending",
            expires_at=expires_at,
        )
        try:
            async with db.begin_nested():
                db.add(order)
                await db.flush()
            break
        except IntegrityError:
            collision = await db.scalar(select(TicketOrder.id).where(TicketOrder.reference == reference))
            if not collision or attempt == 4:
                raise

    if manual_payment:
        return {
            "reference": order.reference,
            "status": order.status,
            "amount": order.amount,
            "currency": order.currency,
            "quantity": order.quantity,
            "payment_method": order.payment_method,
            "payment_details": order.payment_details,
            "expires_at": order.expires_at,
        }

    try:
        payment = await initialize_transaction(
            email=email or "",
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
        "payment_method": order.payment_method,
        "authorization_url": order.authorization_url,
    }


async def _issue_tickets(db: AsyncSession, order: TicketOrder, category: TicketCategory) -> list[dict]:
    issued: list[dict] = []
    for _ in range(order.quantity):
        token = secrets.token_urlsafe(32)
        for attempt in range(5):
            number = secrets.token_hex(6).upper()
            ticket = AdmissionTicket(
                order_id=order.id,
                category_id=category.id,
                token_hash=_token_hash(token),
                token_encrypted=_encrypt_token(token),
                ticket_number=number,
                admission_entitlement=category.admissions_per_ticket,
                currently_inside=0,
            )
            try:
                async with db.begin_nested():
                    db.add(ticket)
                    await db.flush()
                break
            except IntegrityError:
                collision = await db.scalar(select(AdmissionTicket.id).where(AdmissionTicket.ticket_number == number))
                if not collision or attempt == 4:
                    raise
        issued.append(
            {
                "ticket_number": number,
                "category": category.name,
                "admission_entitlement": category.admissions_per_ticket,
                "token": token,
            }
        )
    return issued


async def notify_ticket_payment_submitted(db: AsyncSession, order: TicketOrder) -> None:
    try:
        await platform_service.notify_executives(
            db,
            notification_type="ticket",
            title="Ticket payment awaiting review",
            message=(
                f"{order.purchaser_name} submitted a {order.payment_method.upper()} payment "
                f"for {order.quantity} ticket(s) ({order.reference})."
            ),
        )
    except Exception:
        logger.exception("Failed to notify executives about ticket payment %s", order.reference)


async def deliver_issued_tickets(db: AsyncSession, order: TicketOrder) -> dict:
    """Best-effort buyer delivery + executive push after tickets are issued."""
    event = (
        await db.execute(select(TicketEvent).where(TicketEvent.id == order.event_id))
    ).scalar_one_or_none()
    category = (
        await db.execute(select(TicketCategory).where(TicketCategory.id == order.category_id))
    ).scalar_one_or_none()
    tickets = (
        await db.execute(select(AdmissionTicket).where(AdmissionTicket.order_id == order.id))
    ).scalars().all()
    ticket_numbers = [ticket.ticket_number for ticket in tickets if ticket.ticket_number]
    event_title = event.title if event else "Bra Fie Night"
    category_name = category.name if category else "Ticket"

    try:
        await platform_service.notify_executives(
            db,
            notification_type="ticket",
            title="Tickets issued",
            message=(
                f"{order.purchaser_name} — {order.quantity}× {category_name} issued "
                f"({order.reference})."
            ),
        )
    except Exception:
        logger.exception("Failed to notify executives about issued tickets %s", order.reference)

    delivery = {"email": "skipped", "sms": "skipped"}

    if not tickets:
        logger.warning("No tickets to deliver for order %s", order.reference)
        return delivery

    if not order.purchaser_email:
        delivery["email"] = "skipped_no_email"
        logger.info("Skip ticket email for %s — no purchaser email", order.reference)
    elif not resend_client.is_configured():
        delivery["email"] = "skipped_not_configured"
        logger.warning("Skip ticket email for %s — Resend is not configured", order.reference)
    else:
        try:
            event_date = _format_event_date(event.starts_at if event else None)
            venue = event.venue if event else ""
            attachments = []
            inline_cids: list[str] = []
            for index, ticket in enumerate(tickets):
                token = _decrypt_token(ticket.token_encrypted)
                number = ticket.ticket_number or f"ticket-{index + 1}"
                png = make_ticket_card_png(
                    token=token,
                    event_title=event_title,
                    event_date=event_date,
                    venue=venue,
                    category_name=category_name,
                    ticket_number=number,
                    admission_entitlement=ticket.admission_entitlement,
                    purchaser_name=order.purchaser_name,
                    order_reference=order.reference,
                )
                cid = f"ticket-{index + 1}"
                inline_cids.append(cid)
                attachments.append(
                    resend_client.attachment_from_bytes(
                        filename=f"ticket-{number}.png",
                        content=png,
                        content_id=cid,
                    )
                )
            subject, body_text, body_html = build_ticket_delivery_email(
                purchaser_name=order.purchaser_name,
                event_title=event_title,
                event_date=event_date,
                venue=venue,
                category_name=category_name,
                order_reference=order.reference,
                ticket_numbers=ticket_numbers,
                inline_image_cids=inline_cids,
            )
            resend_client.send_email(
                to_email=order.purchaser_email,
                subject=subject,
                body_text=body_text,
                body_html=body_html,
                attachments=attachments,
            )
            delivery["email"] = "sent"
            logger.info("Ticket email sent for %s to %s", order.reference, order.purchaser_email)
        except Exception:
            delivery["email"] = "failed"
            logger.exception("Failed to email tickets for order %s", order.reference)

    if not ticket_numbers:
        delivery["sms"] = "skipped_no_ticket_numbers"
        logger.warning("Skip ticket SMS for %s — no ticket numbers", order.reference)
    elif not arkesel_client.is_configured():
        delivery["sms"] = "skipped_not_configured"
        logger.warning("Skip ticket SMS for %s — Arkesel is not configured", order.reference)
    else:
        try:
            msisdn = arkesel_client.normalize_gh_msisdn(order.purchaser_phone)
            if not msisdn:
                delivery["sms"] = "skipped_invalid_phone"
                logger.warning(
                    "Skip ticket SMS for %s — phone could not be normalized (%s)",
                    order.reference,
                    order.purchaser_phone,
                )
            else:
                numbers_text = ", ".join(ticket_numbers)
                message = (
                    f"OSAJA {event_title}: payment confirmed. "
                    f"Ticket no: {numbers_text}. Show at the gate. Ref {order.reference}"
                )
                await arkesel_client.send_sms(message=message, recipients=[msisdn])
                delivery["sms"] = "sent"
                logger.info("Ticket SMS sent for %s to %s", order.reference, msisdn)
        except Exception:
            delivery["sms"] = "failed"
            logger.exception("Failed to SMS tickets for order %s", order.reference)

    return delivery


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
    if order.status not in {"pending", "payment_submitted", "expired", "refund_required"}:
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
        or (order.status == "pending" and _utc(order.expires_at) <= datetime.now(timezone.utc))
    ):
        was_pending = order.status in {"pending", "payment_submitted"}
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
        .where(TicketOrder.id == order.id, TicketOrder.status == order.status)
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
    await db.flush()
    await deliver_issued_tickets(db, order)
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

    verified_email = str(payment.get("customer", {}).get("email", "")).lower()
    if order.purchaser_email and verified_email and verified_email != order.purchaser_email:
        raise ValueError("The verified payment email does not match the ticket order")

    return await finalize_ticket_order(
        db,
        reference,
        amount_pesewas=int(payment.get("amount", 0)),
        currency=str(payment.get("currency", "")),
        provider_reference=str(payment.get("id", "")) or None,
    )


async def available_ticket_payment_options(db: AsyncSession) -> list[dict]:
    config = await get_payment_settings(db)
    options: list[dict] = []
    if config.get("paystack_enabled") and settings.paystack_enabled:
        options.append({"method": "paystack", "label": "Pay securely with Paystack"})

    if not config.get("manual_payment_enabled"):
        return options

    momo_number = str(config.get("momo_number") or "").strip()
    if config.get("momo_enabled") and re.fullmatch(r"\+?[0-9 ()-]+", momo_number) and 7 <= sum(character.isdigit() for character in momo_number) <= 15:
        options.append(
            {
                "method": "momo",
                "label": str(config.get("momo_label") or "Mobile Money"),
                "detail": str(config.get("momo_detail") or ""),
                "number": momo_number,
                "account_name": str(config.get("momo_account_name") or ""),
                "note": str(config.get("note") or ""),
            }
        )
    if config.get("bank_enabled"):
        options.append(
            {
                "method": "bank",
                "label": str(config.get("bank_label") or "Bank transfer"),
                "detail": str(config.get("bank_detail") or ""),
                "bank_name": str(config.get("bank_name") or ""),
                "account_name": str(config.get("bank_account_name") or ""),
                "account_number": str(config.get("bank_account_number") or ""),
                "note": str(config.get("note") or ""),
            }
        )
    return options


async def retrieve_order_tickets(
    db: AsyncSession,
    reference: str,
    *,
    purchaser_email: str | None = None,
    purchaser_phone: str | None = None,
) -> list[dict]:
    result = await db.execute(
        select(TicketOrder, TicketCategory)
        .join(TicketCategory, TicketCategory.id == TicketOrder.category_id)
        .where(
            TicketOrder.reference == reference,
            TicketOrder.status == "paid",
        )
    )
    order_category = result.first()
    if not order_category:
        raise ValueError("Paid ticket order not found")
    order, category = order_category
    if not order_matches_identity(order, purchaser_email=purchaser_email, purchaser_phone=purchaser_phone):
        raise ValueError("Paid ticket order not found for these details")

    tickets_result = await db.execute(
        select(AdmissionTicket).where(AdmissionTicket.order_id == order.id)
    )
    tickets = []
    for ticket in tickets_result.scalars():
        token = _decrypt_token(ticket.token_encrypted)
        tickets.append({
            "ticket_number": ticket.ticket_number,
            "category": category.name,
            "admission_entitlement": ticket.admission_entitlement,
            "admissions_used": ticket.admissions_used,
            "currently_inside": ticket.currently_inside,
            "admissions_remaining": ticket.admission_entitlement - ticket.admissions_used,
            "status": ticket.status,
            "token": token,
            "qr_svg_base64": base64.b64encode(make_ticket_qr(token)).decode("ascii"),
        })
    return tickets


async def handle_ticket_webhook(db: AsyncSession, event: str, data: dict) -> bool:
    reference = str(data.get("reference", ""))
    if not (reference.startswith("osaja_ticket_") or re.fullmatch(r"TKT_(?:[A-Z2-7]{13}|[0-9A-F]{16})", reference)):
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


def make_ticket_qr_png(token: str) -> bytes:
    code = qrcode.QRCode(version=None, box_size=8, border=2)
    code.add_data(token)
    code.make(fit=True)
    try:
        from qrcode.image.pil import PilImage

        image = code.make_image(image_factory=PilImage)
        output = io.BytesIO()
        image.save(output, format="PNG")
        return output.getvalue()
    except Exception:
        # Fallback: wrap SVG bytes so email still has an attachment
        return make_ticket_qr(token)


def _format_event_date(value: datetime | None) -> str:
    if not value:
        return ""
    text = _utc(value).strftime("%d %b %Y")
    return text[1:] if text.startswith("0") else text


def make_ticket_card_png(
    *,
    token: str,
    event_title: str,
    event_date: str,
    venue: str,
    category_name: str,
    ticket_number: str,
    admission_entitlement: int,
    purchaser_name: str,
    order_reference: str,
) -> bytes:
    """Render a portal-style ticket card (details + QR) as PNG for email."""
    from PIL import Image, ImageDraw, ImageFont

    qr_bytes = make_ticket_qr_png(token)
    qr = Image.open(io.BytesIO(qr_bytes)).convert("RGB")
    qr = qr.resize((280, 280))

    width, height = 720, 980
    card = Image.new("RGB", (width, height), "#ffffff")
    draw = ImageDraw.Draw(card)

    try:
        title_font = ImageFont.truetype("arialbd.ttf", 36)
        label_font = ImageFont.truetype("arialbd.ttf", 18)
        body_font = ImageFont.truetype("arial.ttf", 22)
        mono_font = ImageFont.truetype("consola.ttf", 20)
        small_font = ImageFont.truetype("arial.ttf", 16)
    except OSError:
        title_font = ImageFont.load_default()
        label_font = title_font
        body_font = title_font
        mono_font = title_font
        small_font = title_font

    # Top accent bar
    draw.rectangle((0, 0, width, 10), fill="#8c1d2c")
    draw.rectangle((40, 40, width - 40, height - 40), outline="#e2e8f0", width=2)

    y = 70
    eyebrow = f"{event_title}  ·  {event_date}".upper()
    draw.text((64, y), eyebrow, fill="#8c1d2c", font=label_font)
    y += 42
    draw.text((64, y), category_name, fill="#260b10", font=title_font)
    y += 58

    if ticket_number:
        draw.text((64, y), f"Ticket: {ticket_number}", fill="#334155", font=mono_font)
        y += 36
    admissions_label = "admission" if admission_entitlement == 1 else "admissions"
    draw.text((64, y), f"{admission_entitlement} {admissions_label}", fill="#475569", font=body_font)
    y += 34
    draw.text((64, y), purchaser_name, fill="#475569", font=body_font)
    y += 34
    if venue:
        # wrap venue lightly
        max_chars = 48
        venue_lines = [venue[i : i + max_chars] for i in range(0, len(venue), max_chars)][:3]
        for line in venue_lines:
            draw.text((64, y), line, fill="#64748b", font=small_font)
            y += 24
    y += 12
    draw.text((64, y), f"Order {order_reference}", fill="#94a3b8", font=small_font)

    qr_x = (width - qr.width) // 2
    qr_y = 520
    card.paste(qr, (qr_x, qr_y))
    draw.text(
        (width // 2, qr_y + qr.height + 24),
        "Show this code at the entrance",
        fill="#64748b",
        font=small_font,
        anchor="mt",
    )
    draw.text(
        (width // 2, height - 70),
        "OSAJA'20 Welfare",
        fill="#8c1d2c",
        font=label_font,
        anchor="mt",
    )

    output = io.BytesIO()
    card.save(output, format="PNG", optimize=True)
    return output.getvalue()


def build_ticket_delivery_email(
    *,
    purchaser_name: str,
    event_title: str,
    event_date: str,
    venue: str,
    category_name: str,
    order_reference: str,
    ticket_numbers: list[str],
    inline_image_cids: list[str],
) -> tuple[str, str, str]:
    numbers_text = ", ".join(ticket_numbers) if ticket_numbers else "see attached ticket"
    subject = f"Your {event_title} ticket is ready"
    first_name = purchaser_name.strip().split(" ")[0] or "guest"

    body_text = (
        f"Hello {purchaser_name},\n\n"
        f"Your payment for {event_title} is confirmed.\n"
        f"Category: {category_name}\n"
        f"Date: {event_date}\n"
        f"Venue: {venue}\n"
        f"Ticket number(s): {numbers_text}\n"
        f"Order: {order_reference}\n\n"
        f"Your ticket image(s) are attached — show them at the gate.\n\n"
        f"— OSAJA'20 Welfare"
    )

    ticket_previews = "".join(
        f'<img src="cid:{cid}" alt="Ticket" width="320" '
        f'style="display:block;width:100%;max-width:320px;height:auto;border-radius:16px;'
        f'border:1px solid #e2e8f0;margin:0 auto 16px;" />'
        for cid in inline_image_cids
    )

    body_html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,'Times New Roman',serif;color:#260b10;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#300b12,#8c1d2c);padding:28px 32px;color:#fff7ed;">
              <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#fde68a;font-family:Arial,sans-serif;">OSAJA'20 Welfare</p>
              <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:600;">{event_title}</h1>
              <p style="margin:10px 0 0;font-size:14px;color:#fecaca;font-family:Arial,sans-serif;">{event_date}{f' · {venue}' if venue else ''}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 12px;font-size:16px;font-family:Arial,sans-serif;color:#334155;">Hello {first_name},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:#475569;">
                Your payment is confirmed. Your <strong style="color:#260b10;">{category_name}</strong> ticket is ready for the gate.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 18px;font-family:Arial,sans-serif;font-size:13px;color:#7c2d12;line-height:1.7;">
                    <strong>Ticket number(s):</strong> {numbers_text}<br/>
                    <strong>Order:</strong> {order_reference}<br/>
                    <strong>Guest:</strong> {purchaser_name}
                  </td>
                </tr>
              </table>
              {ticket_previews}
              <p style="margin:8px 0 0;font-size:13px;line-height:1.6;font-family:Arial,sans-serif;color:#64748b;">
                Full ticket images are also attached to this email. Present the QR at the entrance.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 28px;border-top:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;">
              OSAJA'20 Welfare · Bra Fie Night ticketing
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return subject, body_text, body_html


async def admission_history(db: AsyncSession, ticket_id: UUID) -> list[dict]:
    result = await db.execute(
        select(TicketAdmission)
        .where(TicketAdmission.ticket_id == ticket_id)
        .order_by(TicketAdmission.created_at.desc())
    )
    return [
        {
            "count": entry.admission_count,
            "direction": entry.direction,
            "gate": entry.gate,
            "device_id": entry.device_id,
            "staff_id": str(entry.staff_id),
            "at": entry.created_at,
        }
        for entry in result.scalars()
    ]


def ticket_detail_payload(
    *,
    ticket: AdmissionTicket,
    category: TicketCategory,
    order: TicketOrder,
    history: list[dict] | None = None,
) -> dict:
    outside = max(0, ticket.admissions_used - ticket.currently_inside)
    remaining = max(0, ticket.admission_entitlement - ticket.admissions_used)
    return {
        "ticket_id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "token_hint": (ticket.ticket_number or "")[:4],
        "purchaser_name": order.purchaser_name,
        "purchaser_email": order.purchaser_email,
        "purchaser_phone": order.purchaser_phone,
        "order_reference": order.reference,
        "category": category.name,
        "status": ticket.status,
        "admission_entitlement": ticket.admission_entitlement,
        "admissions_used": ticket.admissions_used,
        "currently_inside": ticket.currently_inside,
        "outside": outside,
        "admissions_remaining": remaining,
        "can_enter": ticket.status == "valid" and remaining > 0 and ticket.currently_inside < ticket.admission_entitlement,
        "can_exit": ticket.status == "valid" and ticket.currently_inside > 0,
        "can_return": ticket.status == "valid" and outside > 0,
        "history": history or [],
    }


async def lookup_tickets(db: AsyncSession, query: str) -> dict:
    term = query.strip()
    if not term:
        raise ValueError("Enter a ticket code or guest name")

    exact = await db.execute(
        select(AdmissionTicket, TicketCategory, TicketOrder, TicketEvent)
        .join(TicketCategory, TicketCategory.id == AdmissionTicket.category_id)
        .join(TicketOrder, TicketOrder.id == AdmissionTicket.order_id)
        .join(TicketEvent, TicketEvent.id == TicketOrder.event_id)
        .where(
            or_(
                AdmissionTicket.token_hash == _token_hash(term),
                AdmissionTicket.ticket_number == term.upper(),
            )
        )
    )
    record = exact.first()
    if record:
        ticket, category, order, _event = record
        history = await admission_history(db, ticket.id)
        return {
            "matches": [ticket_detail_payload(ticket=ticket, category=category, order=order, history=history)],
            "exact": True,
        }

    name_result = await db.execute(
        select(AdmissionTicket, TicketCategory, TicketOrder)
        .join(TicketCategory, TicketCategory.id == AdmissionTicket.category_id)
        .join(TicketOrder, TicketOrder.id == AdmissionTicket.order_id)
        .where(
            TicketOrder.status == "paid",
            or_(
                TicketOrder.purchaser_name.icontains(term, autoescape=True),
                AdmissionTicket.ticket_number.icontains(term, autoescape=True),
            ),
        )
        .order_by(TicketOrder.purchaser_name, AdmissionTicket.ticket_number)
        .limit(20)
    )
    matches = [
        ticket_detail_payload(ticket=ticket, category=category, order=order)
        for ticket, category, order in name_result.all()
    ]
    return {"matches": matches, "exact": False}


async def apply_ticket_action(
    db: AsyncSession,
    *,
    token: str,
    action: str,
    admission_count: int,
    gate: str,
    device_id: str,
    staff_id: UUID,
) -> dict:
    result = await db.execute(
        select(AdmissionTicket, TicketCategory, TicketOrder, TicketEvent)
        .join(TicketCategory, TicketCategory.id == AdmissionTicket.category_id)
        .join(TicketOrder, TicketOrder.id == AdmissionTicket.order_id)
        .join(TicketEvent, TicketEvent.id == TicketOrder.event_id)
        .where(
            or_(
                AdmissionTicket.token_hash == _token_hash(token),
                AdmissionTicket.ticket_number == token.upper(),
            )
        )
        .with_for_update()
    )
    record = result.first()
    if not record:
        raise ValueError("Ticket code is not recognized")
    ticket, category, order, event = record

    detail = ticket_detail_payload(ticket=ticket, category=category, order=order)

    if order.status != "paid":
        return {**detail, "outcome": "unpaid", "message": "Payment is not confirmed"}
    if not event.is_active:
        return {**detail, "outcome": "event_closed", "message": "Event admission is closed"}
    if ticket.status != "valid":
        history = await admission_history(db, ticket.id)
        return {
            **detail,
            "outcome": ticket.status,
            "history": history,
            "message": "Ticket is not valid for entry",
        }

    if action == "enter":
        updated = await db.execute(
            update(AdmissionTicket)
            .where(
                AdmissionTicket.id == ticket.id,
                AdmissionTicket.status == "valid",
                AdmissionTicket.admissions_used + admission_count
                <= AdmissionTicket.admission_entitlement,
                AdmissionTicket.currently_inside + admission_count
                <= AdmissionTicket.admission_entitlement,
            )
            .values(
                admissions_used=AdmissionTicket.admissions_used + admission_count,
                currently_inside=AdmissionTicket.currently_inside + admission_count,
            )
        )
        if updated.rowcount != 1:
            await db.refresh(ticket)
            history = await admission_history(db, ticket.id)
            remaining = max(0, ticket.admission_entitlement - ticket.admissions_used)
            outside = max(0, ticket.admissions_used - ticket.currently_inside)
            if remaining == 0 and outside > 0:
                outcome, message = "must_return", "Guests already admitted are outside — use Return"
            elif remaining == 0:
                outcome, message = "fully_used", "No admissions remain on this ticket"
            else:
                outcome, message = "quantity_exceeded", f"Only {remaining} new admission(s) remain"
            return {
                **ticket_detail_payload(ticket=ticket, category=category, order=order, history=history),
                "outcome": outcome,
                "message": message,
            }
        direction = "enter"
        outcome_ok = "admitted"
        message_ok = f"{admission_count} guest(s) admitted at {gate}"
    elif action == "exit":
        updated = await db.execute(
            update(AdmissionTicket)
            .where(
                AdmissionTicket.id == ticket.id,
                AdmissionTicket.status == "valid",
                AdmissionTicket.currently_inside >= admission_count,
            )
            .values(currently_inside=AdmissionTicket.currently_inside - admission_count)
        )
        if updated.rowcount != 1:
            await db.refresh(ticket)
            history = await admission_history(db, ticket.id)
            return {
                **ticket_detail_payload(ticket=ticket, category=category, order=order, history=history),
                "outcome": "not_inside",
                "message": "Not enough guests are currently inside to mark as going out",
            }
        direction = "exit"
        outcome_ok = "exited"
        message_ok = f"{admission_count} guest(s) marked going out at {gate}"
    elif action == "return":
        updated = await db.execute(
            update(AdmissionTicket)
            .where(
                AdmissionTicket.id == ticket.id,
                AdmissionTicket.status == "valid",
                (AdmissionTicket.admissions_used - AdmissionTicket.currently_inside) >= admission_count,
                AdmissionTicket.currently_inside + admission_count
                <= AdmissionTicket.admission_entitlement,
            )
            .values(currently_inside=AdmissionTicket.currently_inside + admission_count)
        )
        if updated.rowcount != 1:
            await db.refresh(ticket)
            history = await admission_history(db, ticket.id)
            return {
                **ticket_detail_payload(ticket=ticket, category=category, order=order, history=history),
                "outcome": "no_return",
                "message": "No exited guests are available to return on this ticket",
            }
        direction = "return"
        outcome_ok = "returned"
        message_ok = f"{admission_count} guest(s) returned at {gate}"
    else:
        raise ValueError("Unknown gate action")

    db.add(
        TicketAdmission(
            ticket_id=ticket.id,
            admission_count=admission_count,
            direction=direction,
            gate=gate,
            device_id=device_id,
            staff_id=staff_id,
        )
    )
    await db.flush()
    await db.refresh(ticket)
    history = await admission_history(db, ticket.id)
    remaining = ticket.admission_entitlement - ticket.admissions_used
    if action == "enter":
        outcome = "admitted" if remaining == 0 else "partially_used"
    else:
        outcome = outcome_ok
    return {
        **ticket_detail_payload(ticket=ticket, category=category, order=order, history=history),
        "outcome": outcome,
        "message": message_ok,
    }
