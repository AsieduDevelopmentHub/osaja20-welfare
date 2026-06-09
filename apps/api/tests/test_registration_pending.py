"""Registration approval flow tests."""

import pytest

from v1.core.auth.supabase_service import link_or_create_member_from_supabase
from v1.core.config import Settings
from v1.core.database import async_session
from v1.core.models import MemberStatus


@pytest.mark.asyncio
async def test_pending_registration_blocks_login(client, monkeypatch):
    monkeypatch.setenv("REGISTRATION_AUTO_APPROVE", "false")
    from v1.core.config import Settings

    monkeypatch.setattr("v1.modules.auth.router.settings", Settings())

    payload = {
        "full_name": "Pending User",
        "email": "pending@example.com",
        "password": "securepass123",
        "phone_number": "0244999888",
        "date_of_birth": "1999-01-01",
        "batch": 2020,
    }

    reg = await client.post("/api/v1/auth/register", json=payload)
    assert reg.status_code == 200
    body = reg.json()
    assert body["data"]["requires_approval"] is True
    assert body["data"]["token"] is None

    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "pending@example.com", "password": "securepass123"},
    )
    assert login.status_code == 403
    assert "pending" in login.json()["detail"].lower()


@pytest.mark.asyncio
async def test_supabase_linked_member_stays_pending_without_auto_approve(monkeypatch):
    monkeypatch.setenv("REGISTRATION_AUTO_APPROVE", "false")
    settings = Settings()
    monkeypatch.setattr("v1.core.auth.supabase_service.settings", settings)

    user = {
        "id": "11111111-1111-1111-1111-111111111111",
        "email": "supabase.pending@example.com",
        "email_confirmed_at": "2026-01-01T00:00:00Z",
        "user_metadata": {
            "full_name": "Supabase Pending",
            "phone_number": "0244111222",
            "date_of_birth": "1998-05-05",
            "batch": 2020,
        },
    }
    profile = {
        "full_name": "Supabase Pending",
        "email": "supabase.pending@example.com",
        "phone_number": "0244111222",
        "date_of_birth": "1998-05-05",
        "batch": 2020,
    }

    async with async_session() as db:
        member = await link_or_create_member_from_supabase(db, user=user, profile=profile)
        await db.commit()

    assert member.status == MemberStatus.PENDING.value
    assert member.email_verified is True
