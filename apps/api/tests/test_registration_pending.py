"""Registration approval flow tests."""

import os

import pytest


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
