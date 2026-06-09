from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import require_executive, require_member
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import ApiResponse, SupportInquiryCreate, SupportInquiryReply
from v1.core.services import platform_service

router = APIRouter(prefix="/support", tags=["Support"])


@router.post("/inquiries", response_model=ApiResponse)
async def submit_inquiry(
    payload: SupportInquiryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    member: Annotated[Member, Depends(require_member)],
):
    data = await platform_service.submit_support_inquiry(
        db,
        member=member,
        message=payload.message,
        subject=payload.subject,
    )
    if data["notified"] == 0:
        message = (
            "Your message was saved. No executive is set up to receive alerts yet — "
            "try WhatsApp or email if you need an urgent reply."
        )
    else:
        message = "Your message was sent to the executive team."
    return ApiResponse(success=True, data=data, message=message)


@router.get("/inquiries", response_model=ApiResponse)
async def list_inquiries(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
):
    data = await platform_service.list_support_inquiries(
        db, page=page, page_size=page_size, status=status
    )
    return ApiResponse(success=True, data=data)


@router.post("/inquiries/{inquiry_id}/reply", response_model=ApiResponse)
async def reply_to_inquiry(
    inquiry_id: UUID,
    payload: SupportInquiryReply,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await platform_service.reply_support_inquiry(
            db,
            inquiry_id=inquiry_id,
            executive=executive,
            reply_message=payload.message,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Reply sent to member.")
