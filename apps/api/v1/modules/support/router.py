from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import require_member
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import ApiResponse, SupportInquiryCreate
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
        raise HTTPException(
            status_code=503,
            detail="No executives are available to receive your message. Try WhatsApp or email instead.",
        )
    return ApiResponse(
        success=True,
        data=data,
        message="Your message was sent to the executive team.",
    )
