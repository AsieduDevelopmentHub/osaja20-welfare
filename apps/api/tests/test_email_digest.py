"""Email digest service tests."""

import pytest

from v1.core.email_service import build_digest_email, is_email_configured


def test_build_digest_email():
    subject, text, html = build_digest_email(
        member_name="Kwame",
        items=[{"type": "announcement", "title": "Meeting", "message": "Town hall on Friday"}],
    )
    assert "Kwame" in text
    assert "Meeting" in text
    assert "Meeting" in html
    assert "digest" in subject.lower()


@pytest.mark.asyncio
async def test_send_digest_skips_when_email_disabled():
    from uuid import uuid4

    from v1.core.database import async_session
    from v1.core.services import platform_service

    async with async_session() as db:
        result = await platform_service.send_member_email_digest(db, uuid4())
        assert result is False
    assert is_email_configured() is False
