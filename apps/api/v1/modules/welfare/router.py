from fastapi import APIRouter, HTTPException

from v1.core.schemas import ApiResponse, WelfareCaseCreate, WelfareTransition
from v1.core.services import services

router = APIRouter(prefix="/welfare", tags=["Welfare"])


@router.post("/cases", response_model=ApiResponse)
async def create_case(payload: WelfareCaseCreate):
    if payload.member_id not in services._members:
        raise HTTPException(status_code=404, detail="Member not found")
    case = services.create_welfare_case(payload.model_dump())
    return ApiResponse(success=True, data=case, message="Welfare case created")


@router.patch("/cases/{case_id}/transition", response_model=ApiResponse)
async def transition_case(case_id: str, payload: WelfareTransition):
    try:
        case = services.transition_welfare_case(case_id, payload.target_status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ApiResponse(success=True, data=case, message="Status updated")


@router.get("/cases/{case_id}", response_model=ApiResponse)
async def get_case(case_id: str):
    case = services._welfare_cases.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    transitions = services.welfare_fsm.get_available_transitions(case["status"])
    return ApiResponse(success=True, data={**case, "available_transitions": transitions})
