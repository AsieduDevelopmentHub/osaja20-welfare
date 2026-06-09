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
    if data.get("notified") == 0:
        message = (
            "Your message was saved. No executive is set up to receive alerts yet — "
            "try WhatsApp or email if you need an urgent reply."
        )
    else:
        message = "Your message was sent to the executive team."
    return ApiResponse(success=True, data=data, message=message)


@router.get("/inquiries/active", response_model=ApiResponse)
async def active_inquiry(
    db: Annotated[AsyncSession, Depends(get_db)],
    member: Annotated[Member, Depends(require_member)],
):
    data = await platform_service.get_member_active_inquiry(db, member=member)
    return ApiResponse(success=True, data=data)


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


@router.get("/inquiries/{inquiry_id}", response_model=ApiResponse)
async def get_inquiry(
    inquiry_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    viewer: Annotated[Member, Depends(require_member)],
):
    try:
        data = await platform_service.get_support_inquiry(
            db, inquiry_id=inquiry_id, viewer=viewer
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data)


@router.post("/inquiries/{inquiry_id}/messages", response_model=ApiResponse)
async def post_inquiry_message(
    inquiry_id: UUID,
    payload: SupportInquiryReply,
    db: Annotated[AsyncSession, Depends(get_db)],
    sender: Annotated[Member, Depends(require_member)],
):
    try:
        data = await platform_service.add_inquiry_message(
            db,
            inquiry_id=inquiry_id,
            sender=sender,
            body=payload.message,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Message sent.")


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


@router.post("/inquiries/{inquiry_id}/resolve", response_model=ApiResponse)
async def resolve_inquiry(
    inquiry_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await platform_service.resolve_support_inquiry(
            db, inquiry_id=inquiry_id, executive=executive
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Conversation marked as resolved.")
