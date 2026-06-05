from fastapi import APIRouter, HTTPException

from v1.core.schemas import ApiResponse, ContributionCreate
from v1.core.services import services

router = APIRouter(prefix="/contributions", tags=["Contributions"])


@router.post("", response_model=ApiResponse)
async def record_contribution(payload: ContributionCreate):
    if payload.member_id not in services._members:
        raise HTTPException(status_code=404, detail="Member not found")
    try:
        record = services.record_contribution(payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ApiResponse(success=True, data=record, message="Contribution recorded")


@router.get("/summary", response_model=ApiResponse)
async def contribution_summary():
    return ApiResponse(
        success=True,
        data={"total_contributions": services.ledger.get_total_contributions()},
    )
