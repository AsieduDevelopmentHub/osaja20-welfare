from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import require_executive
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import ApiResponse, ContributionCreate
from v1.core.services import platform_service

router = APIRouter(prefix="/contributions", tags=["Contributions"])


@router.get("", response_model=ApiResponse)
async def list_contributions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    member_id: UUID | None = None,
):
    data = await platform_service.list_contributions(
        db, page=page, page_size=page_size, member_id=member_id
    )
    return ApiResponse(success=True, data=data)


@router.post("", response_model=ApiResponse)
async def record_contribution(
    payload: ContributionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    member = await platform_service.get_member(db, UUID(payload.member_id))
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    try:
        record = await platform_service.record_contribution(
            db,
            {
                **payload.model_dump(),
                "created_by": str(executive.id),
            },
            actor_id=executive.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ApiResponse(success=True, data=record, message="Contribution recorded")


@router.get("/summary", response_model=ApiResponse)
async def contribution_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    summary = await platform_service.get_contribution_summary(db)
    return ApiResponse(success=True, data=summary)
