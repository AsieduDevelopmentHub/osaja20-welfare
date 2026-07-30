"""Redis cache helper — works without a live Redis (graceful miss)."""

import pytest

from v1.core.redis_cache import RedisCache, invalidate_sms_caches


@pytest.mark.asyncio
async def test_redis_cache_miss_when_unavailable(monkeypatch):
    cache = RedisCache()

    async def _fail_client():
        return None

    monkeypatch.setattr(cache, "_client", _fail_client)
    assert await cache.get_json("sms:cache:dashboard") is None
    assert await cache.set_json("sms:cache:dashboard", {"ok": True}, ttl_seconds=5) is False
    await cache.delete("sms:cache:dashboard")
    await invalidate_sms_caches()


@pytest.mark.asyncio
async def test_redis_cache_roundtrip_when_available(monkeypatch):
    store: dict[str, str] = {}

    class FakeRedis:
        async def get(self, key: str):
            return store.get(key)

        async def set(self, key: str, value: str, ex: int | None = None):
            store[key] = value
            return True

        async def delete(self, *keys: str):
            for key in keys:
                store.pop(key, None)
            return len(keys)

        async def aclose(self):
            return None

        async def ping(self):
            return True

        async def scan(self, cursor: int = 0, match: str | None = None, count: int = 100):
            return 0, []

    cache = RedisCache()
    fake = FakeRedis()

    async def _client():
        cache._available = True
        cache._redis = fake
        return fake

    monkeypatch.setattr(cache, "_client", _client)
    assert await cache.set_json("sms:cache:balance", {"sms_balance": 12}, ttl_seconds=10) is True
    assert await cache.get_json("sms:cache:balance") == {"sms_balance": 12}
    await cache.delete("sms:cache:balance")
    assert await cache.get_json("sms:cache:balance") is None
