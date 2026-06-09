from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import ApiResponse, BirthdayWishCreate, BirthdayWishReply
from v1.core.services import platform_service

router = APIRouter(prefix="/birthdays", tags=["Birthdays"])


@router.get("/wishes", response_model=ApiResponse)
async def list_birthday_wishes(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
    recipient_id: UUID = Query(...),
    birthday_on: date | None = None,
):
    data = await platform_service.list_birthday_wishes(
        db, recipient_id=recipient_id, birthday_on=birthday_on
    )
    return ApiResponse(success=True, data=data)


@router.post("/wishes", response_model=ApiResponse)
async def create_birthday_wish(
    payload: BirthdayWishCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    try:
        wish = await platform_service.create_birthday_wish(
            db,
            author_id=current.id,
            recipient_id=UUID(payload.recipient_id),
            message=payload.message,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(success=True, data=wish, message="Birthday wish sent")


@router.post("/wishes/{wish_id}/reply", response_model=ApiResponse)
async def reply_birthday_wish(
    wish_id: UUID,
    payload: BirthdayWishReply,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    try:
        reply = await platform_service.reply_birthday_wish(
            db,
            recipient_id=current.id,
            parent_id=wish_id,
            message=payload.message,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(success=True, data=reply, message="Reply posted")
