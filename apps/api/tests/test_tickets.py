from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select

from v1.core.auth.jwt import create_access_token
from v1.core.config import settings
from v1.core.database import async_session
from v1.core.models import Member, TicketCategory, TicketEvent
from v1.modules.tickets import service as ticket_service
from v1.modules.tickets.service import seed_default_event


async def _seed_and_get_double_category():
    async with async_session() as db:
        await seed_default_event(db)
        event = (
            await db.execute(
                select(TicketEvent).where(TicketEvent.slug == "bra-fie-night-2027")
            )
        ).scalar_one()
        category = (
            await db.execute(
                select(TicketCategory).where(
                    TicketCategory.event_id == event.id,
                    TicketCategory.name == "Double",
                )
            )
        ).scalar_one()
        await db.commit()
        return category.id


async def _create_admin():
    async with async_session() as db:
        member = Member(
            id=uuid4(),
            full_name="Ticket Scanner",
            username=f"scanner{uuid4().hex[:8]}",
            email=f"scanner-{uuid4().hex[:8]}@example.com",
            phone_number="0244123456",
            date_of_birth=date(1990, 1, 1),
            membership_id=f"OSAJA-{uuid4().hex[:8]}",
            status="active",
            role="administrator",
        )
        db.add(member)
        await db.commit()
        return member


def _admin_headers(member):
    token = create_access_token(
        str(member.id),
        email=member.email,
        role=member.role,
        member_id=str(member.id),
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_public_event_exposes_double_admission_category(client):
    await _seed_and_get_double_category()

    response = await client.get("/api/v1/tickets/events/bra-fie-night-2027")

    assert response.status_code == 200
    assert response.json()["data"]["venue"] == (
        "Candix Royal Hotel, Amanfrom Sawmill Junction, opposite Seventh Day Adventist (SDA) School"
    )
    categories = response.json()["data"]["categories"]
    double = next(category for category in categories if category["name"] == "Double")
    assert Decimal(double["price"]) == Decimal("180.00")
    assert double["admissions_per_ticket"] == 2
    assert double["inventory_remaining"] is None


@pytest.mark.asyncio
async def test_double_ticket_can_be_admitted_in_two_visits(client, monkeypatch):
    category_id = await _seed_and_get_double_category()
    member = await _create_admin()
    original_secret = settings.paystack_secret_key
    settings.paystack_secret_key = "test-paystack-secret"

    async def initialize(**kwargs):
        return {"authorization_url": "https://checkout.example.test/pay"}

    async def verify(reference):
        return {
            "status": "success",
            "amount": 18000,
            "currency": "GHS",
            "customer": {"email": "buyer@example.com"},
            "id": "test-provider-transaction",
        }

    monkeypatch.setattr(ticket_service, "initialize_transaction", initialize)
    monkeypatch.setattr(ticket_service, "verify_transaction", verify)
    try:
        order_response = await client.post(
            "/api/v1/tickets/orders",
            json={
                "category_id": str(category_id),
                "quantity": 1,
                "purchaser_name": "Test Buyer",
                "purchaser_email": "buyer@example.com",
                "purchaser_phone": "0244123456",
            },
        )
        assert order_response.status_code == 200
        order = order_response.json()["data"]
        assert order["authorization_url"] == "https://checkout.example.test/pay"

        verified = await client.post(f"/api/v1/tickets/orders/{order['reference']}/verify")
        assert verified.status_code == 200
        assert verified.json()["data"]["status"] == "paid"

        repeated_verify = await client.post(f"/api/v1/tickets/orders/{order['reference']}/verify")
        assert repeated_verify.status_code == 200
        assert repeated_verify.json()["data"]["status"] == "paid"

        retrieved = await client.post(
            f"/api/v1/tickets/orders/{order['reference']}/retrieve",
            json={"purchaser_email": "buyer@example.com"},
        )
        ticket = retrieved.json()["data"]["tickets"][0]
        assert ticket["admission_entitlement"] == 2
        assert ticket["qr_svg_base64"]

        scan1 = await client.post(
            "/api/v1/tickets/scan",
            headers=_admin_headers(member),
            json={
                "token": ticket["token"],
                "admission_count": 1,
                "gate": "Gate 1",
                "device_id": "test-device-1",
            },
        )
        assert scan1.status_code == 200
        assert scan1.json()["data"]["outcome"] == "partially_used"
        assert scan1.json()["data"]["admissions_remaining"] == 1

        excess_scan = await client.post(
            "/api/v1/tickets/scan",
            headers=_admin_headers(member),
            json={
                "token": ticket["token"],
                "admission_count": 2,
                "gate": "Gate 2",
                "device_id": "test-device-over-limit",
            },
        )
        assert excess_scan.status_code == 200
        assert excess_scan.json()["data"]["outcome"] == "quantity_exceeded"
        assert excess_scan.json()["data"]["admissions_remaining"] == 1

        scan2 = await client.post(
            "/api/v1/tickets/scan",
            headers=_admin_headers(member),
            json={
                "token": ticket["token"],
                "admission_count": 1,
                "gate": "Gate 2",
                "device_id": "test-device-2",
            },
        )
        assert scan2.status_code == 200
        assert scan2.json()["data"]["outcome"] == "admitted"
        assert scan2.json()["data"]["admissions_remaining"] == 0

        scan3 = await client.post(
            "/api/v1/tickets/scan",
            headers=_admin_headers(member),
            json={
                "token": ticket["token"],
                "admission_count": 1,
                "gate": "Gate 3",
                "device_id": "test-device-3",
            },
        )
        assert scan3.status_code == 200
        assert scan3.json()["data"]["outcome"] == "fully_used"
        assert len(scan3.json()["data"]["history"]) == 2
    finally:
        settings.paystack_secret_key = original_secret


@pytest.mark.asyncio
async def test_scanner_requires_authorized_staff(client):
    response = await client.post(
        "/api/v1/tickets/scan",
        json={
            "token": "ticket-token-that-does-not-exist",
            "admission_count": 1,
            "gate": "Gate 1",
            "device_id": "unauthorized-device",
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_ticket_order_requires_server_payment_configuration(client):
    category_id = await _seed_and_get_double_category()
    original_secret = settings.paystack_secret_key
    settings.paystack_secret_key = ""
    try:
        response = await client.post(
            "/api/v1/tickets/orders",
            json={
                "category_id": str(category_id),
                "quantity": 1,
                "purchaser_name": "Test Buyer",
                "purchaser_email": "buyer@example.com",
                "purchaser_phone": "0244123456",
            },
        )
    finally:
        settings.paystack_secret_key = original_secret

    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


@pytest.mark.asyncio
async def test_admin_can_create_event_and_enforce_category_inventory(client, monkeypatch):
    member = await _create_admin()
    headers = _admin_headers(member)
    event_response = await client.post(
        "/api/v1/tickets/admin/events",
        headers=headers,
        json={
            "slug": f"test-event-{uuid4().hex[:8]}",
            "title": "Test Event",
            "description": "A test event",
            "venue": "Test Hall",
            "starts_at": "2030-01-01T17:00:00Z",
        },
    )
    assert event_response.status_code == 200
    event_id = event_response.json()["data"]["id"]

    category_response = await client.post(
        f"/api/v1/tickets/admin/events/{event_id}/categories",
        headers=headers,
        json={
            "name": "Limited",
            "description": "One ticket only",
            "price": "25.00",
            "inventory_limit": 1,
        },
    )
    assert category_response.status_code == 200
    category_id = category_response.json()["data"]["id"]

    original_secret = settings.paystack_secret_key
    settings.paystack_secret_key = "test-paystack-secret"

    async def initialize(**kwargs):
        return {"authorization_url": "https://checkout.example.test/pay"}

    monkeypatch.setattr(ticket_service, "initialize_transaction", initialize)
    order_payload = {
        "category_id": category_id,
        "quantity": 1,
        "purchaser_name": "Test Buyer",
        "purchaser_email": "buyer@example.com",
        "purchaser_phone": "0244123456",
    }
    try:
        first_order = await client.post("/api/v1/tickets/orders", json=order_payload)
        second_order = await client.post("/api/v1/tickets/orders", json=order_payload)
    finally:
        settings.paystack_secret_key = original_secret

    assert first_order.status_code == 200
    assert second_order.status_code == 409
