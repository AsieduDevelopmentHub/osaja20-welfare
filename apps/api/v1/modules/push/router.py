from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member
from v1.core.config import settings
from v1.core.rate_limit import check_rate_limit
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.push_service import get_vapid_public_key, is_push_configured
from v1.core.schemas import ApiResponse, PushSubscribe
from v1.core.services import platform_service

router = APIRouter(prefix="/push", tags=["Push Notifications"])


@router.get("/vapid-public-key", response_model=ApiResponse)
async def vapid_public_key():
    key = get_vapid_public_key()
    if not key:
        raise HTTPException(status_code=503, detail="Web Push is not configured on the server")
    return ApiResponse(success=True, data={"public_key": key, "configured": is_push_configured()})


@router.post("/subscribe", response_model=ApiResponse)
async def subscribe_push(
    payload: PushSubscribe,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    """Store Web Push subscription for delivery (no background workers required)."""
    if not is_push_configured():
        raise HTTPException(status_code=503, detail="Web Push is not configured on the server")

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


@router.post("/test", response_model=ApiResponse)
async def test_push(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    check_rate_limit(
        request,
        key="push_test",
        limit=settings.rate_limit_push_test_per_minute,
    )
    """Send a test notification to the current member's registered devices."""
    try:
        result = await platform_service.send_test_push(db, current)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ApiResponse(success=True, data=result, message="Test push sent")
