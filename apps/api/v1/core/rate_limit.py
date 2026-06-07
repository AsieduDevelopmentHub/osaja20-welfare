"""Simple in-memory rate limiting (per client IP + route key)."""

from collections import defaultdict
from time import time

from fastapi import HTTPException, Request, status

_buckets: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(request: Request, *, key: str, limit: int, window_seconds: int = 60) -> None:
    client_ip = request.client.host if request.client else "unknown"
    bucket_key = f"{key}:{client_ip}"
    now = time()
    cutoff = now - window_seconds
    hits = [t for t in _buckets[bucket_key] if t > cutoff]
    if len(hits) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests — please try again shortly",
        )
    hits.append(now)
    _buckets[bucket_key] = hits
