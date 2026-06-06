from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import ApiResponse, PushSubscribe
from v1.core.services import platform_service

router = APIRouter(prefix="/push", tags=["Push Notifications"])


@router.post("/subscribe", response_model=ApiResponse)
async def subscribe_push(
    payload: PushSubscribe,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    """Store Web Push subscription for future push delivery (no Celery required)."""
    sub = await platform_service.register_push_subscription(
        db,
        member_id=current.id,
        endpoint=payload.endpoint,
        p256dh_key=payload.keys.p256dh,
        auth_key=payload.keys.auth,
        user_agent=payload.user_agent,
    )
    return ApiResponse(success=True, data=sub, message="Push subscription saved")


@router.delete("/subscribe", response_model=ApiResponse)
async def unsubscribe_push(
    payload: PushSubscribe,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    removed = await platform_service.remove_push_subscription(
        db, member_id=current.id, endpoint=payload.endpoint
    )
    return ApiResponse(success=True, data={"removed": removed})
