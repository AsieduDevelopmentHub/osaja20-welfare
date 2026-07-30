"""Lightweight Redis JSON cache with graceful fallback when Redis is down."""

from __future__ import annotations

import json
import logging
from typing import Any

from v1.core.config import settings

logger = logging.getLogger(__name__)


class RedisCache:
    def __init__(self) -> None:
        self._redis = None
        self._available: bool | None = None

    async def _reset(self) -> None:
        if self._redis is not None:
            try:
                await self._redis.aclose()
            except Exception:
                pass
        self._redis = None
        self._available = False

    async def _client(self):
        if self._redis is not None and self._available:
            return self._redis
        try:
            import redis.asyncio as redis

            client = redis.from_url(settings.redis_url, decode_responses=True)
            await client.ping()
            self._redis = client
            self._available = True
            return self._redis
        except Exception as exc:
            logger.debug("Redis cache unavailable: %s", exc)
            await self._reset()
            return None

    async def is_available(self) -> bool:
        if self._available is None:
            await self._client()
        return bool(self._available)

    async def get_json(self, key: str) -> Any | None:
        client = await self._client()
        if not client:
            return None
        try:
            raw = await client.get(key)
        except Exception as exc:
            logger.debug("Redis get failed (%s): %s", key, exc)
            await self._reset()
            return None
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    async def set_json(self, key: str, value: Any, *, ttl_seconds: int = 30) -> bool:
        client = await self._client()
        if not client:
            return False
        try:
            await client.set(key, json.dumps(value, default=str), ex=max(1, ttl_seconds))
            return True
        except Exception as exc:
            logger.debug("Redis set failed (%s): %s", key, exc)
            await self._reset()
            return False

    async def delete(self, *keys: str) -> None:
        if not keys:
            return
        client = await self._client()
        if not client:
            return
        try:
            await client.delete(*keys)
        except Exception as exc:
            logger.debug("Redis delete failed: %s", exc)
            await self._reset()

    async def delete_prefix(self, prefix: str) -> None:
        client = await self._client()
        if not client:
            return
        try:
            cursor = 0
            pattern = f"{prefix}*"
            while True:
                cursor, keys = await client.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    await client.delete(*keys)
                if cursor == 0:
                    break
        except Exception as exc:
            logger.debug("Redis delete_prefix failed (%s): %s", prefix, exc)
            await self._reset()

    async def close(self) -> None:
        await self._reset()


redis_cache = RedisCache()

# SMS portal cache keys
SMS_DASHBOARD_KEY = "sms:cache:dashboard"
SMS_BALANCE_KEY = "sms:cache:balance"
SMS_RECIPIENT_GROUPS_KEY = "sms:cache:recipient_groups"

SMS_DASHBOARD_TTL = 20
SMS_BALANCE_TTL = 30
SMS_RECIPIENT_GROUPS_TTL = 45


async def invalidate_sms_caches() -> None:
    """Drop SMS read caches after sends / group mutations."""
    await redis_cache.delete(SMS_DASHBOARD_KEY, SMS_BALANCE_KEY, SMS_RECIPIENT_GROUPS_KEY)
