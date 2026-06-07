from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member, require_executive
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import ApiResponse, WelfareCaseCreate, WelfareTransition
from v1.core.services import platform_service

router = APIRouter(prefix="/welfare", tags=["Welfare"])


@router.get("/cases", response_model=ApiResponse)
async def list_cases(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
):
    data = await platform_service.list_welfare_cases(db, page=page, page_size=page_size, status=status)
    return ApiResponse(success=True, data=data)


@router.get("/me/cases", response_model=ApiResponse)
async def list_my_cases(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = await platform_service.list_member_welfare_cases(
        db, current.id, page=page, page_size=page_size
    )
    return ApiResponse(success=True, data=data)


@router.post("/cases", response_model=ApiResponse)
async def create_case(
    payload: WelfareCaseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    member = await platform_service.get_member(db, UUID(payload.member_id))
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    is_executive = current.role in ("executive", "administrator")
    if not is_executive and current.id != member.id:
        raise HTTPException(status_code=403, detail="Cannot create case for another member")

    case = await platform_service.create_welfare_case(db, payload.model_dump(), actor_id=current.id)
    return ApiResponse(success=True, data=case, message="Welfare case created")


@router.patch("/cases/{case_id}/transition", response_model=ApiResponse)
async def transition_case(
    case_id: UUID,
    payload: WelfareTransition,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    try:
        case = await platform_service.transition_welfare_case(
            db, case_id, payload.target_status, actor_id=executive.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ApiResponse(success=True, data=case, message="Status updated")


@router.get("/cases/{case_id}", response_model=ApiResponse)
async def get_case(
    case_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    case = await platform_service.get_welfare_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if current.role == "member" and case["member_id"] != str(current.id):
        raise HTTPException(status_code=403, detail="Access denied")

    return ApiResponse(success=True, data=case)
