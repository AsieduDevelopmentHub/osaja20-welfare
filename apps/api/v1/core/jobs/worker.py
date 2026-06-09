"""Background job worker — processes Redis queue + periodic email digests."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select

from v1.core.config import settings
from v1.core.database import async_session
from v1.core.email_service import build_digest_email, is_email_configured, send_email
from v1.core.jobs.queue import job_queue
from v1.core.member_preferences import merge_preferences
from v1.core.models import Member, MemberStatus, Notification
from v1.core.services import platform_service

logger = logging.getLogger(__name__)

DIGEST_INTERVAL_DAYS = 7
_last_digest_scan: datetime | None = None
_last_daily_scan: datetime | None = None


async def process_job(job: dict) -> None:
    job_type = job.get("type")
    payload = job.get("payload") or {}

    if job_type == "push_notification":
        await _handle_push(payload)
    elif job_type == "email_digest":
        await _handle_email_digest(payload)
    else:
        logger.warning("Unknown job type: %s", job_type)


async def _handle_push(payload: dict) -> None:
    async with async_session() as db:
        try:
            delivered = await platform_service.deliver_push_notification(
                db,
                member_id=UUID(payload["member_id"]),
                notification_id=UUID(payload["notification_id"]),
                notification_type=payload["notification_type"],
                title=payload["title"],
                message=payload["message"],
                url=payload.get("url", "/notifications"),
            )
            if delivered:
                notification = await db.get(Notification, UUID(payload["notification_id"]))
                if notification:
                    notification.push_pending = False
            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("Push job failed for notification %s", payload.get("notification_id"))


async def _handle_email_digest(payload: dict) -> None:
    member_id = UUID(payload["member_id"])
    async with async_session() as db:
        try:
            await platform_service.send_member_email_digest(db, member_id)
            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("Email digest failed for member %s", member_id)


async def maybe_run_daily_scans() -> None:
    """Birthday alerts, dues reminders, and auto-unpublish of stale vote results."""
    global _last_daily_scan

    now = datetime.now(timezone.utc)
    if _last_daily_scan and (now - _last_daily_scan) < timedelta(hours=20):
        return
    _last_daily_scan = now

    async with async_session() as db:
        try:
            birthdays = await platform_service.scan_birthday_notifications(db)
            reminders = await platform_service.scan_dues_reminder_notifications(db)
            unpublished = await platform_service.unpublish_stale_vote_results(db)
            await db.commit()
            if birthdays or reminders or unpublished:
                logger.info(
                    "Daily scan: %s birthday, %s dues reminders, %s vote results unpublished",
                    birthdays,
                    reminders,
                    unpublished,
                )
        except Exception:
            await db.rollback()
            logger.exception("Daily scan failed")


async def maybe_run_digest_scan() -> None:
    global _last_digest_scan

    if not is_email_configured():
        return

    now = datetime.now(timezone.utc)
    if _last_digest_scan and (now - _last_digest_scan) < timedelta(hours=1):
        return
    _last_digest_scan = now

    cutoff = now - timedelta(days=DIGEST_INTERVAL_DAYS)
    async with async_session() as db:
        result = await db.execute(
            select(Member).where(
                Member.status == MemberStatus.ACTIVE.value,
                Member.email.isnot(None),
            )
        )
        members = result.scalars().all()
        queued = 0
        for member in members:
            prefs = merge_preferences(member.preferences_json)
            if not prefs.get("email_digest"):
                continue
            last_sent_raw = (member.preferences_json or {}).get("last_email_digest_at")
            if last_sent_raw:
                try:
                    last_sent = datetime.fromisoformat(str(last_sent_raw))
                    if last_sent.tzinfo is None:
                        last_sent = last_sent.replace(tzinfo=timezone.utc)
                    if last_sent > cutoff:
                        continue
                except ValueError:
                    pass
            if await job_queue.enqueue("email_digest", {"member_id": str(member.id)}):
                queued += 1
        await db.commit()
        if queued:
            logger.info("Queued %s email digest jobs", queued)


async def _daily_scan_loop(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            await maybe_run_daily_scans()
        except Exception:
            logger.exception("Daily scan loop error")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=3600)
            break
        except asyncio.TimeoutError:
            pass


async def run_job_worker(stop_event: asyncio.Event) -> None:
    daily_task = asyncio.create_task(_daily_scan_loop(stop_event))

    if not settings.job_worker_enabled:
        logger.info("Job worker disabled — daily scans still active")
        await daily_task
        return

    logger.info("Job worker started (Redis queue)")
    redis_warned = False
    while not stop_event.is_set():
        try:
            if not await job_queue.is_available():
                if not redis_warned:
                    logger.warning(
                        "Redis unavailable at %s — job queue idle (start Redis or set JOB_WORKER_ENABLED=false)",
                        settings.redis_url,
                    )
                    redis_warned = True
                await asyncio.sleep(10)
                continue
            redis_warned = False
            await maybe_run_digest_scan()
            job = await job_queue.dequeue(timeout=2)
            if job:
                await process_job(job)
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Job worker loop error")
            await asyncio.sleep(2)

    daily_task.cancel()
    try:
        await daily_task
    except asyncio.CancelledError:
        pass
    await job_queue.close()
    logger.info("Job worker stopped")
