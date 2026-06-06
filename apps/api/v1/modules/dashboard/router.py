from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member, require_executive
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import ApiResponse
from v1.core.services import platform_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=ApiResponse)
async def dashboard_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    stats = await platform_service.dashboard_stats(db)
    return ApiResponse(success=True, data=stats)


@router.get("/birthdays", response_model=ApiResponse)
async def monthly_birthdays(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(get_current_member)],
    month: int | None = None,
):
    target_month = month or date.today().month
    birthdays = await platform_service.monthly_birthdays(db, target_month)
    return ApiResponse(success=True, data=birthdays)
