from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import require_executive
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import ApiResponse
from v1.core.services import platform_service

router = APIRouter(prefix="/activity", tags=["Activity"])


@router.get("", response_model=ApiResponse)
async def list_activity(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    action: str | None = Query(default=None, max_length=100),
):
    data = await platform_service.list_activity_logs(
        db, page=page, page_size=page_size, action=action
    )
    return ApiResponse(success=True, data=data)
