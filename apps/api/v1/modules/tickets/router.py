from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import require_executive
from v1.core.database import get_db
from v1.core.models import (
    AdmissionTicket,
    Member,
    TicketCategory,
    TicketEvent,
    TicketOrder,
)
from v1.core.schemas import ApiResponse
from v1.modules.tickets.schemas import (
    TicketCategoryCreate,
    TicketCategoryUpdate,
    TicketEventView,
    TicketEventCreate,
    TicketEventUpdate,
    TicketLookupRequest,
    TicketManualPaymentDecision,
    TicketManualPaymentSubmit,
    TicketOrderCreate,
    TicketOrderRetrieve,
    TicketOrderStatusRequest,
    TicketScanRequest,
)
from v1.modules.tickets.service import (
    EVENT_SLUG,
    VALID_GATES,
    apply_ticket_action,
    available_ticket_payment_options,
    category_view,
    deliver_issued_tickets,
    finalize_ticket_order,
    initialize_ticket_order,
    lookup_tickets,
    notify_ticket_payment_submitted,
    order_matches_identity,
    release_expired_orders,
    retrieve_order_tickets,
    verify_ticket_order,
)

router = APIRouter(prefix="/tickets", tags=["Tickets"])


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _sale_is_open(start: datetime | None, end: datetime | None, now: datetime) -> bool:
    return not (
        (start and _as_utc(start) > now)
        or (end and _as_utc(end) <= now)
    )


def _validate_sales_window(start: datetime | None, end: datetime | None) -> None:
    if start and end and _as_utc(start) >= _as_utc(end):
        raise HTTPException(status_code=422, detail="Sales start must be before sales end")


@router.get("/events/{slug}", response_model=ApiResponse)
async def get_public_event(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await release_expired_orders(db)
    event_result = await db.execute(
        select(TicketEvent).where(TicketEvent.slug == slug, TicketEvent.is_active.is_(True))
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    now = datetime.now(timezone.utc)
    if not _sale_is_open(event.sales_start_at, event.sales_end_at, now):
        raise HTTPException(status_code=410, detail="Ticket sales are closed for this event")

    categories_result = await db.execute(
        select(TicketCategory)
        .where(
            TicketCategory.event_id == event.id,
            TicketCategory.is_active.is_(True),
        )
        .order_by(TicketCategory.price, TicketCategory.name)
    )
    categories = [
        category_view(category)
        for category in categories_result.scalars()
        if _sale_is_open(category.sales_start_at, category.sales_end_at, now)
    ]
    return ApiResponse(
        success=True,
        data=TicketEventView(
            slug=event.slug,
            title=event.title,
            description=event.description,
            venue=event.venue,
            starts_at=event.starts_at,
            categories=categories,
            payment_options=await available_ticket_payment_options(db),
        ).model_dump(mode="json"),
    )


@router.post("/orders", response_model=ApiResponse)
async def create_ticket_order(
    payload: TicketOrderCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await release_expired_orders(db)
    now = datetime.now(timezone.utc)
    category_result = await db.execute(
        select(TicketCategory, TicketEvent)
        .join(TicketEvent, TicketEvent.id == TicketCategory.event_id)
        .where(
            TicketCategory.id == payload.category_id,
            TicketCategory.is_active.is_(True),
            TicketEvent.is_active.is_(True),
        )
    )
    record = category_result.first()
    if not record:
        raise HTTPException(status_code=404, detail="Ticket category not found")
    category, event = record

    if not _sale_is_open(event.sales_start_at, event.sales_end_at, now) or not _sale_is_open(
        category.sales_start_at, category.sales_end_at, now
    ):
        raise HTTPException(status_code=410, detail="Ticket sales are closed")

    payment_options = await available_ticket_payment_options(db)
    if not payment_options:
        raise HTTPException(
            status_code=503,
            detail="Ticket payments are not configured. Please contact the organizers.",
        )
    requested_method = payload.payment_method or str(payment_options[0]["method"])
    payment_option = next(
        (option for option in payment_options if option["method"] == requested_method),
        None,
    )
    if not payment_option:
        raise HTTPException(
            status_code=409,
            detail="That ticket payment method is not currently enabled.",
        )

    inventory = await db.execute(
        update(TicketCategory)
        .where(
            TicketCategory.id == category.id,
            or_(
                TicketCategory.inventory_limit.is_(None),
                TicketCategory.inventory_limit
                >= TicketCategory.sold_quantity
                + TicketCategory.reserved_quantity
                + payload.quantity,
            ),
        )
        .values(reserved_quantity=TicketCategory.reserved_quantity + payload.quantity)
    )
    if inventory.rowcount != 1:
        raise HTTPException(status_code=409, detail="Not enough tickets remain in this category")

    try:
        order = await initialize_ticket_order(
            db,
            event=event,
            category=category,
            quantity=payload.quantity,
            purchaser_name=payload.purchaser_name,
            purchaser_email=str(payload.purchaser_email) if payload.purchaser_email else None,
            purchaser_phone=payload.purchaser_phone,
            payment_method=requested_method,
            payment_details=payment_option if requested_method != "paystack" else None,
        )
    except ValueError as exc:
        message = str(exc)
        code = 422 if "email is required" in message.lower() else 503
        raise HTTPException(status_code=code, detail=message) from exc
    return ApiResponse(
        success=True,
        data=order,
        message=(
            "Continue to Paystack to pay securely"
            if requested_method == "paystack"
            else "Order reserved. Complete your transfer and submit its reference."
        ),
    )


@router.post("/orders/{reference}/verify", response_model=ApiResponse)
async def verify_order(
    reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        result = await verify_ticket_order(db, reference)
    except ValueError as exc:
        message = str(exc)
        code = 404 if "not found" in message.lower() else 502
        raise HTTPException(status_code=code, detail=message) from exc
    return ApiResponse(
        success=True,
        data={"reference": reference, "status": result},
        message=(
            "Payment confirmed. Retrieve your tickets with your email or phone."
            if result == "paid"
            else "Payment is not confirmed yet. Your tickets have not been issued."
        ),
    )


@router.post("/orders/{reference}/retrieve", response_model=ApiResponse)
async def retrieve_tickets(
    reference: str,
    payload: TicketOrderRetrieve,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        tickets = await retrieve_order_tickets(
            db,
            reference,
            purchaser_email=str(payload.purchaser_email) if payload.purchaser_email else None,
            purchaser_phone=payload.purchaser_phone,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ApiResponse(success=True, data={"tickets": tickets})


@router.post("/orders/{reference}/submit-payment", response_model=ApiResponse)
async def submit_manual_ticket_payment(
    reference: str,
    payload: TicketManualPaymentSubmit,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    order_result = await db.execute(
        select(TicketOrder).where(TicketOrder.reference == reference).with_for_update()
    )
    order = order_result.scalar_one_or_none()
    if not order or not order_matches_identity(
        order,
        purchaser_email=str(payload.purchaser_email) if payload.purchaser_email else None,
        purchaser_phone=payload.purchaser_phone,
    ):
        raise HTTPException(status_code=404, detail="Ticket order not found for these details")
    if order.payment_method not in {"momo", "bank"}:
        raise HTTPException(status_code=409, detail="This order does not use a manual payment method")
    if order.status != "awaiting_payment":
        raise HTTPException(status_code=409, detail="This order is no longer accepting payment references")
    if _as_utc(order.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This ticket reservation has expired")

    transaction_reference = payload.transaction_reference.strip().upper()
    duplicate = await db.execute(
        select(TicketOrder.id).where(
            TicketOrder.manual_payment_reference == transaction_reference
        )
    )
    if duplicate.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="This payment reference has already been submitted")

    order.manual_payment_reference = transaction_reference
    order.manual_payment_sender_name = payload.sender_name
    order.payment_submitted_at = datetime.now(timezone.utc)
    order.status = "payment_submitted"
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This payment reference has already been submitted",
        ) from exc

    await notify_ticket_payment_submitted(db, order)

    return ApiResponse(
        success=True,
        data={"reference": order.reference, "status": order.status},
        message="Payment reference received. Tickets will be issued after staff confirmation.",
    )


@router.post("/orders/{reference}/status", response_model=ApiResponse)
async def get_ticket_order_status(
    reference: str,
    payload: TicketOrderStatusRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await release_expired_orders(db)
    result = await db.execute(select(TicketOrder).where(TicketOrder.reference == reference))
    order = result.scalar_one_or_none()
    if not order or not order_matches_identity(
        order,
        purchaser_email=str(payload.purchaser_email) if payload.purchaser_email else None,
        purchaser_phone=payload.purchaser_phone,
    ):
        raise HTTPException(status_code=404, detail="Ticket order not found for these details")
    return ApiResponse(
        success=True,
        data={
            "reference": order.reference,
            "status": order.status,
            "payment_method": order.payment_method,
            "payment_details": order.payment_details,
            "amount": order.amount,
            "currency": order.currency,
            "quantity": order.quantity,
            "expires_at": _as_utc(order.expires_at),
            "payment_submitted_at": order.payment_submitted_at,
            "review_note": order.review_note,
            "purchaser_email": order.purchaser_email,
            "purchaser_phone": order.purchaser_phone,
        },
    )


@router.post("/lookup", response_model=ApiResponse)
async def lookup_ticket(
    payload: TicketLookupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await lookup_tickets(db, payload.query)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not data["matches"]:
        raise HTTPException(status_code=404, detail="No matching tickets found")
    return ApiResponse(
        success=True,
        data=data,
        message="Verify guest details before admitting, exiting, or returning.",
    )


@router.post("/scan", response_model=ApiResponse)
async def scan_ticket(
    payload: TicketScanRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    staff: Annotated[Member, Depends(require_executive)],
):
    if payload.gate not in VALID_GATES:
        raise HTTPException(status_code=400, detail="Choose a registered gate")

    try:
        result = await apply_ticket_action(
            db,
            token=payload.token,
            action=payload.action,
            admission_count=payload.admission_count,
            gate=payload.gate,
            device_id=payload.device_id,
            staff_id=staff.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return ApiResponse(
        success=True,
        data=result,
        message=result.get("message") or "Gate action processed",
    )


@router.get("/admin/overview", response_model=ApiResponse)
async def ticket_admin_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
    search: Annotated[str, Query(max_length=200)] = "",
):
    await release_expired_orders(db)
    event_result = await db.execute(select(TicketEvent).where(TicketEvent.slug == EVENT_SLUG))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Ticket event has not been configured")

    categories_result = await db.execute(
        select(TicketCategory).where(TicketCategory.event_id == event.id).order_by(TicketCategory.price)
    )
    categories = [category_view(category) for category in categories_result.scalars()]
    order_filter = [TicketOrder.event_id == event.id]
    if search.strip():
        term = search.strip()
        order_filter.append(or_(
            TicketOrder.purchaser_name.icontains(term, autoescape=True),
            TicketOrder.purchaser_email.icontains(term, autoescape=True),
            TicketOrder.purchaser_phone.icontains(term, autoescape=True),
            TicketOrder.reference.icontains(term, autoescape=True),
            TicketOrder.status.icontains(term, autoescape=True),
            TicketOrder.payment_method.icontains(term, autoescape=True),
            TicketOrder.manual_payment_reference.icontains(term, autoescape=True),
            TicketOrder.manual_payment_sender_name.icontains(term, autoescape=True),
            select(TicketCategory.id).where(
                TicketCategory.id == TicketOrder.category_id,
                TicketCategory.name.icontains(term, autoescape=True),
            ).correlate(TicketOrder).exists(),
            select(AdmissionTicket.id).where(
                AdmissionTicket.order_id == TicketOrder.id,
                AdmissionTicket.ticket_number.icontains(term, autoescape=True),
            ).correlate(TicketOrder).exists(),
        ))
    total_orders = (await db.execute(select(func.count(TicketOrder.id)).where(*order_filter))).scalar_one()
    order_result = await db.execute(
        select(TicketOrder, TicketCategory.name)
        .join(TicketCategory, TicketCategory.id == TicketOrder.category_id)
        .where(*order_filter)
        .order_by(TicketOrder.created_at.desc(), TicketOrder.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    order_rows = order_result.all()
    order_ids = [order.id for order, _ in order_rows]
    ticket_numbers: dict[UUID, list[str]] = {}
    if order_ids:
        ticket_result = await db.execute(
            select(AdmissionTicket.order_id, AdmissionTicket.ticket_number)
            .where(AdmissionTicket.order_id.in_(order_ids))
            .order_by(AdmissionTicket.created_at, AdmissionTicket.id)
        )
        for order_id, ticket_number in ticket_result:
            if ticket_number:
                ticket_numbers.setdefault(order_id, []).append(ticket_number)
    orders = [
        {
            "reference": order.reference,
            "purchaser_name": order.purchaser_name,
            "purchaser_email": order.purchaser_email,
            "category": category_name,
            "quantity": order.quantity,
            "amount": order.amount,
            "status": order.status,
            "payment_method": order.payment_method,
            "manual_payment_reference": order.manual_payment_reference,
            "manual_payment_phone": order.manual_payment_phone,
            "manual_payment_sender_name": order.manual_payment_sender_name,
            "ticket_numbers": ticket_numbers.get(order.id, []),
            "payment_submitted_at": order.payment_submitted_at,
            "created_at": order.created_at,
        }
        for order, category_name in order_rows
    ]
    stats_result = await db.execute(
        select(
            TicketOrder.status,
            func.count(TicketOrder.id),
            func.sum(TicketOrder.amount),
            func.sum(TicketOrder.quantity),
        )
        .where(TicketOrder.event_id == event.id)
        .group_by(TicketOrder.status)
    )
    stats = {
        row[0]: {"orders": row[1], "revenue": row[2] or Decimal("0"), "tickets": row[3] or 0}
        for row in stats_result
    }
    checked_in = await db.execute(
        select(func.coalesce(func.sum(AdmissionTicket.currently_inside), 0))
        .join(TicketOrder, TicketOrder.id == AdmissionTicket.order_id)
        .where(
            TicketOrder.event_id == event.id,
            TicketOrder.status == "paid",
            AdmissionTicket.status == "valid",
        )
    )
    stats["checked_in"] = checked_in.scalar_one()
    return ApiResponse(
        success=True,
        data={
            "event": {
                "slug": event.slug,
                "title": event.title,
                "description": event.description,
                "venue": event.venue,
                "starts_at": event.starts_at,
                "is_active": event.is_active,
            },
            "categories": categories,
            "orders": orders,
            "pagination": {"page": page, "page_size": page_size, "total": total_orders},
            "stats": stats,
        },
    )


@router.post("/admin/orders/{reference}/confirm", response_model=ApiResponse)
async def confirm_manual_ticket_payment(
    reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    staff: Annotated[Member, Depends(require_executive)],
):
    result = await db.execute(
        select(TicketOrder).where(TicketOrder.reference == reference).with_for_update()
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Ticket order not found")
    if order.payment_method not in {"momo", "bank"} or order.status != "payment_submitted":
        raise HTTPException(status_code=409, detail="This order is not awaiting manual payment confirmation")

    status = await finalize_ticket_order(
        db,
        order.reference,
        amount_pesewas=int(order.amount * 100),
        currency=order.currency,
        provider_reference=order.manual_payment_reference,
    )
    if status != "paid":
        raise HTTPException(status_code=409, detail=f"Order could not be confirmed (status: {status})")
    order.reviewed_by = staff.id
    order.reviewed_at = datetime.now(timezone.utc)
    order.review_note = None
    await db.flush()
    return ApiResponse(
        success=True,
        data={"reference": order.reference, "status": "paid"},
        message="Payment confirmed and tickets issued",
    )


@router.post("/admin/orders/{reference}/resend-delivery", response_model=ApiResponse)
async def resend_ticket_delivery(
    reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    result = await db.execute(select(TicketOrder).where(TicketOrder.reference == reference))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Ticket order not found")
    if order.status != "paid":
        raise HTTPException(status_code=409, detail="Tickets are only delivered after payment is confirmed")
    delivery = await deliver_issued_tickets(db, order)
    return ApiResponse(
        success=True,
        data={"reference": order.reference, "delivery": delivery},
        message="Ticket delivery attempted",
    )


@router.post("/admin/orders/{reference}/reject", response_model=ApiResponse)
async def reject_manual_ticket_payment(
    reference: str,
    payload: TicketManualPaymentDecision,
    db: Annotated[AsyncSession, Depends(get_db)],
    staff: Annotated[Member, Depends(require_executive)],
):
    result = await db.execute(
        select(TicketOrder).where(TicketOrder.reference == reference).with_for_update()
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Ticket order not found")
    if order.payment_method not in {"momo", "bank"} or order.status != "payment_submitted":
        raise HTTPException(status_code=409, detail="This order is not awaiting manual payment confirmation")

    released = await db.execute(
        update(TicketCategory)
        .where(
            TicketCategory.id == order.category_id,
            TicketCategory.reserved_quantity >= order.quantity,
        )
        .values(reserved_quantity=TicketCategory.reserved_quantity - order.quantity)
    )
    if released.rowcount != 1:
        raise HTTPException(status_code=409, detail="Reserved ticket inventory could not be reconciled")
    order.status = "rejected"
    order.reviewed_by = staff.id
    order.reviewed_at = datetime.now(timezone.utc)
    order.review_note = (payload.note or "Payment reference could not be verified").strip()
    await db.flush()
    return ApiResponse(success=True, data={"reference": order.reference, "status": "rejected"}, message="Payment submission rejected")


@router.post("/admin/events", response_model=ApiResponse)
async def create_ticket_event(
    payload: TicketEventCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    duplicate = await db.execute(select(TicketEvent.id).where(TicketEvent.slug == payload.slug))
    if duplicate.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An event with this slug already exists")
    _validate_sales_window(payload.sales_start_at, payload.sales_end_at)
    event = TicketEvent(**payload.model_dump())
    db.add(event)
    await db.flush()
    return ApiResponse(success=True, data={"id": event.id, "slug": event.slug}, message="Event created")


@router.patch("/admin/events/{event_id}", response_model=ApiResponse)
async def update_ticket_event(
    event_id: UUID,
    payload: TicketEventUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    result = await db.execute(select(TicketEvent).where(TicketEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    changes = payload.model_dump(exclude_unset=True)
    for field in ("title", "description", "venue", "starts_at", "is_active"):
        if field in changes and changes[field] is None:
            raise HTTPException(status_code=422, detail=f"{field} cannot be null")
    _validate_sales_window(
        changes.get("sales_start_at", event.sales_start_at),
        changes.get("sales_end_at", event.sales_end_at),
    )
    for field, value in changes.items():
        setattr(event, field, value)
    await db.flush()
    return ApiResponse(success=True, data={"id": event.id, "slug": event.slug}, message="Event updated")


@router.post("/admin/events/{event_id}/categories", response_model=ApiResponse)
async def create_ticket_category(
    event_id: UUID,
    payload: TicketCategoryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    event_result = await db.execute(select(TicketEvent.id).where(TicketEvent.id == event_id))
    if not event_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Event not found")
    duplicate = await db.execute(
        select(TicketCategory.id).where(
            TicketCategory.event_id == event_id,
            TicketCategory.name == payload.name,
        )
    )
    if duplicate.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A category with this name already exists")
    _validate_sales_window(payload.sales_start_at, payload.sales_end_at)
    category = TicketCategory(event_id=event_id, **payload.model_dump())
    db.add(category)
    await db.flush()
    return ApiResponse(
        success=True,
        data=category_view(category),
        message="Ticket category created",
    )


@router.patch("/admin/categories/{category_id}", response_model=ApiResponse)
async def update_ticket_category(
    category_id: UUID,
    payload: TicketCategoryUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    result = await db.execute(select(TicketCategory).where(TicketCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Ticket category not found")

    changes = payload.model_dump(exclude_unset=True)
    for field in ("name", "description", "price", "admissions_per_ticket", "is_active"):
        if field in changes and changes[field] is None:
            raise HTTPException(status_code=422, detail=f"{field} cannot be null")
    if "name" in changes:
        duplicate = await db.execute(
            select(TicketCategory.id).where(
                TicketCategory.event_id == category.event_id,
                TicketCategory.name == changes["name"],
                TicketCategory.id != category.id,
            )
        )
        if duplicate.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="A category with this name already exists")
    if "inventory_limit" in changes and changes["inventory_limit"] is not None:
        if changes["inventory_limit"] < category.sold_quantity + category.reserved_quantity:
            raise HTTPException(
                status_code=409,
                detail="Inventory cannot be lower than tickets already sold or reserved",
            )
    _validate_sales_window(
        changes.get("sales_start_at", category.sales_start_at),
        changes.get("sales_end_at", category.sales_end_at),
    )

    for field, value in changes.items():
        setattr(category, field, value)
    await db.flush()
    return ApiResponse(success=True, data=category_view(category), message="Ticket category updated")


@router.post("/admin/tickets/{ticket_id}/revoke", response_model=ApiResponse)
async def revoke_ticket(
    ticket_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    result = await db.execute(select(AdmissionTicket).where(AdmissionTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == "revoked":
        return ApiResponse(success=True, message="Ticket is already revoked")
    ticket.status = "revoked"
    await db.flush()
    return ApiResponse(success=True, message="Ticket revoked")
