from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member, require_executive
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


@router.get("/manage", response_model=ApiResponse)
async def manage_votes(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
):
    data = await platform_service.list_all_votes(db, status=status, page=page, page_size=page_size)
    return ApiResponse(success=True, data=data)


@router.post("", response_model=ApiResponse)
async def create_vote(
    payload: VoteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    options = [{**opt, "id": opt.get("id", str(uuid4()))} for opt in payload.options]
    vote = await platform_service.create_vote(
        db,
        {**payload.model_dump(), "options": options},
        created_by=executive.id,
    )
    return ApiResponse(success=True, data=vote, message="Vote created")


@router.patch("/{vote_id}/open", response_model=ApiResponse)
async def open_vote(
    vote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    try:
        vote = await platform_service.open_vote(db, vote_id, actor_id=executive.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return ApiResponse(success=True, data=vote, message="Vote opened")


@router.patch("/{vote_id}/close", response_model=ApiResponse)
async def close_vote(
    vote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    try:
        vote = await platform_service.close_vote(db, vote_id, actor_id=executive.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return ApiResponse(success=True, data=vote, message="Vote closed")


@router.patch("/{vote_id}/publish-results", response_model=ApiResponse)
async def publish_vote_results(
    vote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    try:
        vote = await platform_service.publish_vote_results(db, vote_id, actor_id=executive.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ApiResponse(success=True, data=vote, message="Results published to members")


@router.get("/published-results", response_model=ApiResponse)
async def published_results(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    data = await platform_service.list_published_vote_results(db, current.id)
    return ApiResponse(success=True, data=data)


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
    current: Annotated[Member, Depends(get_current_member)],
):
    is_executive = current.role in ("executive", "administrator")
    try:
        data = await platform_service.get_vote_results(
            db, vote_id, allow_member=not is_executive
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return ApiResponse(success=True, data=data)
