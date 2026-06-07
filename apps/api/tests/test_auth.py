"""Auth route integration tests."""

import pytest


REGISTER_PAYLOAD = {
    "full_name": "Test Member",
    "email": "test.member@example.com",
    "password": "securepass123",
    "phone_number": "0244123456",
    "date_of_birth": "1998-05-15",
    "batch": 2020,
}


@pytest.mark.asyncio
async def test_register_and_login(client):
    reg = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    assert reg.status_code == 200
    body = reg.json()
    assert body["success"] is True
    assert body["data"]["member"]["email"] == "test.member@example.com"
    assert body["data"]["token"] is not None

    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "test.member@example.com", "password": "securepass123"},
    )
    assert login.status_code == 200
    assert login.json()["data"]["token"]["access_token"]


@pytest.mark.asyncio
async def test_login_invalid_credentials(client):
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "nobody@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    dup = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    assert dup.status_code == 400


@pytest.mark.asyncio
async def test_forgot_password_local_auth(client):
    response = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "unknown@example.com"},
    )
    assert response.status_code == 200
    assert response.json()["success"] is True


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
