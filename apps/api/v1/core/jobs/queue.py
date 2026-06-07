"""Redis-backed job queue with in-process fallback."""

from __future__ import annotations

import json
import logging
from typing import Any

from v1.core.config import settings

logger = logging.getLogger(__name__)

JOB_QUEUE_KEY = "osaja:jobs"


class JobQueue:
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
            logger.debug("Redis unavailable: %s", exc)
            await self._reset()
            return None

    async def is_available(self) -> bool:
        if self._available is None:
            await self._client()
        return bool(self._available)

    async def enqueue(self, job_type: str, payload: dict[str, Any]) -> bool:
        client = await self._client()
        if not client:
            return False
        body = json.dumps({"type": job_type, "payload": payload})
        await client.rpush(JOB_QUEUE_KEY, body)
        return True

    async def dequeue(self, timeout: int = 5) -> dict[str, Any] | None:
        client = await self._client()
        if not client:
            return None
        try:
            result = await client.blpop(JOB_QUEUE_KEY, timeout=timeout)
        except Exception as exc:
            logger.debug("Redis dequeue failed: %s", exc)
            await self._reset()
            return None
        if not result:
            return None
        _, raw = result
        return json.loads(raw)

    async def close(self) -> None:
        await self._reset()


job_queue = JobQueue()
