from uuid import uuid4

from fastapi import APIRouter, HTTPException

from v1.core.schemas import ApiResponse, VoteCreate, VoteSubmit
from v1.core.services import services

router = APIRouter(prefix="/voting", tags=["Voting"])


@router.post("", response_model=ApiResponse)
async def create_vote(payload: VoteCreate):
    options = [{**opt, "id": opt.get("id", str(uuid4()))} for opt in payload.options]
    vote = services.create_vote({
        **payload.model_dump(),
        "options": options,
        "opens_at": payload.opens_at.isoformat(),
        "closes_at": payload.closes_at.isoformat(),
    })
    return ApiResponse(success=True, data=vote, message="Vote created")


@router.patch("/{vote_id}/open", response_model=ApiResponse)
async def open_vote(vote_id: str):
    vote = services._votes.get(vote_id)
    if not vote:
        raise HTTPException(status_code=404, detail="Vote not found")
    vote["status"] = "open"
    return ApiResponse(success=True, data=vote, message="Vote opened")


@router.post("/{vote_id}/submit", response_model=ApiResponse)
async def submit_vote(vote_id: str, payload: VoteSubmit):
    try:
        result = services.submit_vote(vote_id, payload.member_id, payload.option_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ApiResponse(success=True, data=result, message="Vote submitted and locked")


@router.get("/{vote_id}/results", response_model=ApiResponse)
async def vote_results(vote_id: str):
    try:
        results = services.get_vote_results(vote_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    option_ids = [o["id"] for o in services._votes[vote_id].get("options", [])]
    winner = services.vote_engine.get_winner(vote_id, option_ids)

    return ApiResponse(
        success=True,
        data={
            "results": results,
            "winner_option_id": winner,
            "total_votes": services.vote_engine.get_total_votes(vote_id),
        },
    )
