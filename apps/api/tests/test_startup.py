import pytest

from v1.core.config import Settings
from v1.core.startup import validate_settings


def test_cors_origins_comma_separated():
    s = Settings(cors_origins="https://a.example.com,https://b.example.com")
    assert s.cors_origins_list == ["https://a.example.com", "https://b.example.com"]


def test_cors_origins_empty_falls_back_to_localhost_in_debug():
    s = Settings(cors_origins="", debug=True)
    assert "http://localhost:3000" in s.cors_origins_list


def test_cors_origins_empty_in_production():
    s = Settings(cors_origins="", debug=False)
    assert s.cors_origins_list == []


def test_cors_tunnel_regex_only_when_enabled():
    s = Settings(allow_tunnel_cors=False)
    assert s.cors_origin_regex is None
    s2 = Settings(allow_tunnel_cors=True)
    assert s2.cors_origin_regex is not None


def test_validate_settings_blocks_local_member_portal_in_production(monkeypatch):
    from v1.core import startup

    fake = Settings(
        debug=False,
        jwt_secret="x" * 32,
        database_url="postgresql+asyncpg://user:pass@db.example.com/postgres",
        member_portal_url="http://localhost:3000",
    )
    monkeypatch.setattr(startup, "settings", fake)
    with pytest.raises(RuntimeError, match="MEMBER_PORTAL_URL"):
        startup.validate_settings()
