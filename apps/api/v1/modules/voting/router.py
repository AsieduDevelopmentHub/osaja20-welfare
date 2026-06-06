from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member, require_admin
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import ApiResponse, VoteCreate, VoteSubmit
from v1.core.services import platform_service

router = APIRouter(prefix="/voting", tags=["Voting"])


@router.get("", response_model=ApiResponse)
async def list_votes(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    votes = await platform_service.list_active_votes(db, current.id)
    return ApiResponse(success=True, data=votes)


@router.post("", response_model=ApiResponse)
async def create_vote(
    payload: VoteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Member, Depends(require_admin)],
):
    options = [{**opt, "id": opt.get("id", str(uuid4()))} for opt in payload.options]
    vote = await platform_service.create_vote(
        db,
        {**payload.model_dump(), "options": options},
        created_by=admin.id,
    )
    return ApiResponse(success=True, data=vote, message="Vote created")


@router.patch("/{vote_id}/open", response_model=ApiResponse)
async def open_vote(
    vote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Member, Depends(require_admin)],
):
    try:
        vote = await platform_service.open_vote(db, vote_id, actor_id=admin.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return ApiResponse(success=True, data=vote, message="Vote opened")


@router.post("/{vote_id}/submit", response_model=ApiResponse)
async def submit_vote(
    vote_id: UUID,
    payload: VoteSubmit,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    try:
        result = await platform_service.submit_vote(
            db, vote_id, current.id, UUID(payload.option_id), actor_id=current.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ApiResponse(success=True, data=result, message="Vote submitted and locked")


@router.get("/{vote_id}/results", response_model=ApiResponse)
async def vote_results(
    vote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(get_current_member)],
):
    try:
        data = await platform_service.get_vote_results(db, vote_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return ApiResponse(success=True, data=data)
