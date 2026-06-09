"""Support inquiry flow: member submit → executive list → reply."""

import pytest

from v1.core.database import async_session
from v1.core.models import Member, MemberStatus, UserRole


MEMBER_PAYLOAD = {
    "full_name": "Inquiry Member",
    "email": "inquiry.member@example.com",
    "password": "securepass123",
    "phone_number": "0244111222",
    "date_of_birth": "1998-05-15",
    "batch": 2020,
}

ADMIN_PAYLOAD = {
    "full_name": "Inquiry Admin",
    "email": "inquiry.admin@example.com",
    "password": "securepass123",
    "phone_number": "0244333444",
    "date_of_birth": "1990-01-01",
    "batch": 2020,
}


async def _register_and_token(client, payload):
    reg = await client.post("/api/v1/auth/register", json=payload)
    assert reg.status_code == 200
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": payload["email"], "password": payload["password"]},
    )
    assert login.status_code == 200
    return login.json()["data"]["token"]["access_token"]


async def _promote_admin(email: str):
    async with async_session() as db:
        from sqlalchemy import select

        result = await db.execute(select(Member).where(Member.email == email))
        member = result.scalar_one()
        member.role = UserRole.ADMINISTRATOR.value
        member.status = MemberStatus.ACTIVE.value
        await db.commit()


@pytest.mark.asyncio
async def test_member_inquiry_lists_for_executive(client):
    await client.post("/api/v1/auth/register", json=ADMIN_PAYLOAD)
    await _promote_admin(ADMIN_PAYLOAD["email"])
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": ADMIN_PAYLOAD["email"], "password": ADMIN_PAYLOAD["password"]},
    )
    admin_token = admin_login.json()["data"]["token"]["access_token"]

    member_token = await _register_and_token(client, MEMBER_PAYLOAD)

    submit = await client.post(
        "/api/v1/support/inquiries",
        json={"message": "Please help with my dues payment"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert submit.status_code == 200
    inquiry_id = submit.json()["data"]["id"]

    listed = await client.get(
        "/api/v1/support/inquiries?status=open",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert listed.status_code == 200
    items = listed.json()["data"]["items"]
    assert any(item["id"] == inquiry_id for item in items)

    reply = await client.post(
        f"/api/v1/support/inquiries/{inquiry_id}/reply",
        json={"message": "We will look into this today."},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reply.status_code == 200
    assert reply.json()["data"]["status"] == "resolved"

    resolved = await client.get(
        "/api/v1/support/inquiries?status=resolved",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert any(item["id"] == inquiry_id for item in resolved.json()["data"]["items"])


@pytest.mark.asyncio
async def test_inquiry_saved_when_no_executives_to_notify(client, monkeypatch):
    """Inquiry must persist even when notify_executives returns 0."""
    member_token = await _register_and_token(client, MEMBER_PAYLOAD)

    submit = await client.post(
        "/api/v1/support/inquiries",
        json={"message": "Hello executives, anyone there?"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert submit.status_code == 200
    inquiry_id = submit.json()["data"]["id"]

    listed = await client.get(
        "/api/v1/support/inquiries",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert listed.status_code == 403

    async with async_session() as db:
        from uuid import UUID

        from v1.core.models import SupportInquiry

        row = await db.get(SupportInquiry, UUID(inquiry_id))
        assert row is not None
        assert row.message.startswith("Hello executives")
