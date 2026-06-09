"""Support inquiry threaded chat flow."""

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
async def test_threaded_inquiry_chat(client):
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
    assert len(submit.json()["data"]["messages"]) == 1

    reply1 = await client.post(
        f"/api/v1/support/inquiries/{inquiry_id}/messages",
        json={"message": "We will review your account today."},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reply1.status_code == 200
    assert reply1.json()["data"]["status"] == "open"
    assert len(reply1.json()["data"]["messages"]) == 2

    follow_up = await client.post(
        f"/api/v1/support/inquiries/{inquiry_id}/messages",
        json={"message": "Thank you — when should I expect an update?"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert follow_up.status_code == 200
    assert len(follow_up.json()["data"]["messages"]) == 3

    resolve = await client.post(
        f"/api/v1/support/inquiries/{inquiry_id}/resolve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resolve.status_code == 200
    assert resolve.json()["data"]["status"] == "resolved"

    reopen = await client.post(
        "/api/v1/support/inquiries",
        json={"message": "One more question about receipts."},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert reopen.status_code == 200
    assert reopen.json()["data"]["id"] == inquiry_id
    assert reopen.json()["data"]["status"] == "open"
    assert len(reopen.json()["data"]["messages"]) == 4

    active = await client.get(
        "/api/v1/support/inquiries/active",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert active.status_code == 200
    assert active.json()["data"]["id"] == inquiry_id


@pytest.mark.asyncio
async def test_inquiry_saved_when_no_executives_to_notify(client):
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
