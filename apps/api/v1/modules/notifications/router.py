from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member, require_executive
from v1.core.database import get_db
from v1.core.models import Member, Notification
from v1.core.schemas import ApiResponse, NotificationCreate
from v1.core.services import platform_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _notification_dict(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "read": n.read,
        "scheduled_at": n.scheduled_at.isoformat() if n.scheduled_at else None,
        "sent_at": n.sent_at.isoformat() if n.sent_at else None,
        "created_at": n.created_at.isoformat(),
    }


@router.get("", response_model=ApiResponse)
async def list_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
    unread_only: bool = False,
):
    query = select(Notification).where(Notification.member_id == current.id)
    if unread_only:
        query = query.where(Notification.read.is_(False))
    query = query.order_by(Notification.created_at.desc()).limit(50)
    result = await db.execute(query)
    items = [_notification_dict(n) for n in result.scalars().all()]
    return ApiResponse(success=True, data=items)


@router.get("/unread-count", response_model=ApiResponse)
async def unread_count(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    count = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.member_id == current.id, Notification.read.is_(False))
    )
    return ApiResponse(success=True, data={"count": count or 0})


@router.patch("/{notification_id}/read", response_model=ApiResponse)
async def mark_read(
    notification_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.member_id == current.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.read = True
    await db.flush()
    return ApiResponse(success=True, data=_notification_dict(notification))


@router.post("/mark-all-read", response_model=ApiResponse)
async def mark_all_read(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    result = await db.execute(
        select(Notification).where(
            Notification.member_id == current.id,
            Notification.read.is_(False),
        )
    )
    for n in result.scalars().all():
        n.read = True
    await db.flush()
    return ApiResponse(success=True, message="All notifications marked as read")


@router.post("", response_model=ApiResponse)
async def create_notification(
    payload: NotificationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    notification = await platform_service.create_notification(
        db,
        member_id=UUID(payload.member_id),
        type=payload.type,
        title=payload.title,
        message=payload.message,
        actor_id=executive.id,
    )
    return ApiResponse(success=True, data=notification, message="Notification created")


@router.post("/scan-birthdays", response_model=ApiResponse)
async def scan_birthdays(
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    """On-demand birthday scan (replaces Celery worker). Creates celebration notifications."""
    created = await platform_service.scan_birthday_notifications(db, actor_id=executive.id)
    return ApiResponse(
        success=True,
        data={"created": created},
        message=f"Created {created} birthday notification(s)",
    )
