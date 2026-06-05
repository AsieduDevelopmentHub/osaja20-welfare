from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member, require_admin, require_executive
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import ApiResponse, MemberCreate
from v1.core.serializers import member_to_dict
from v1.core.services import platform_service

router = APIRouter(prefix="/members", tags=["Members"])


@router.post("", response_model=ApiResponse)
async def create_member(
    payload: MemberCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Member, Depends(require_admin)],
):
    member = await platform_service.register_member(
        db,
        full_name=payload.full_name,
        email=payload.email,
        phone_number=payload.phone_number,
        date_of_birth=payload.date_of_birth,
        membership_id=payload.membership_id,
        batch=payload.batch,
        actor_id=admin.id,
    )
    return ApiResponse(success=True, data=member_to_dict(member), message="Member registered")


@router.get("/search", response_model=ApiResponse)
async def search_members(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    q: str = Query(min_length=1),
    limit: int = Query(default=20, le=100),
):
    results = await platform_service.search_members(db, q, limit)
    return ApiResponse(success=True, data=results)


@router.get("/me", response_model=ApiResponse)
async def get_my_profile(current: Annotated[Member, Depends(get_current_member)]):
    return ApiResponse(success=True, data=member_to_dict(current))


@router.get("/{member_id}", response_model=ApiResponse)
async def get_member(
    member_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    member = await platform_service.get_member(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return ApiResponse(success=True, data=member_to_dict(member))


@router.get("/{member_id}/balance", response_model=ApiResponse)
async def get_member_balance(
    member_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    if current.role == "member" and current.id != member_id:
        raise HTTPException(status_code=403, detail="Cannot view another member's balance")

    member = await platform_service.get_member(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    balance_data = await platform_service.get_member_balance(db, member_id)
    return ApiResponse(success=True, data=balance_data)
