from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member, require_executive
from v1.core.database import get_db
from v1.core.models import Announcement, Member
from v1.core.schemas import AnnouncementCreate, AnnouncementUpdate, ApiResponse
from v1.core.services import platform_service

router = APIRouter(prefix="/announcements", tags=["Announcements"])


def _announcement_dict(a: Announcement) -> dict:
    return {
        "id": str(a.id),
        "title": a.title,
        "content": a.content,
        "target_audience": a.target_audience,
        "published_at": a.published_at.isoformat() if a.published_at else None,
        "archived": a.archived,
        "created_at": a.created_at.isoformat(),
    }


@router.get("", response_model=ApiResponse)
async def list_announcements(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(get_current_member)],
    limit: int = Query(default=50, ge=1, le=100),
):
    result = await db.execute(
        select(Announcement)
        .where(Announcement.archived.is_(False), Announcement.published_at.isnot(None))
        .order_by(Announcement.published_at.desc())
        .limit(limit)
    )
    return ApiResponse(success=True, data=[_announcement_dict(a) for a in result.scalars().all()])


@router.post("", response_model=ApiResponse)
async def publish_announcement(
    payload: AnnouncementCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    announcement = await platform_service.publish_announcement(
        db,
        title=payload.title,
        content=payload.content,
        target_audience=payload.target_audience,
        created_by=executive.id,
        notify_members=payload.notify_members,
    )
    return ApiResponse(success=True, data=announcement, message="Announcement published")


@router.patch("/{announcement_id}", response_model=ApiResponse)
async def update_announcement(
    announcement_id: UUID,
    payload: AnnouncementUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await platform_service.update_announcement(
            db,
            announcement_id,
            title=payload.title,
            content=payload.content,
            notify_members=payload.notify_members,
            actor_id=executive.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return ApiResponse(success=True, data=data, message="Announcement updated")


@router.delete("/{announcement_id}", response_model=ApiResponse)
async def delete_announcement(
    announcement_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    try:
        await platform_service.archive_announcement(db, announcement_id, actor_id=executive.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return ApiResponse(success=True, message="Announcement removed")
