from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member, require_admin, require_executive
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import ApiResponse, MemberCreate, MemberRoleUpdate
from v1.core.serializers import member_to_dict
from v1.core.services import platform_service

router = APIRouter(prefix="/members", tags=["Members"])


@router.get("", response_model=ApiResponse)
async def list_members(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
):
    data = await platform_service.list_members(db, page=page, page_size=page_size, status=status)
    return ApiResponse(success=True, data=data)


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
        username=payload.username,
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


@router.get("/me/dues", response_model=ApiResponse)
async def get_my_dues(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    data = await platform_service.get_member_dues(db, current)
    return ApiResponse(success=True, data=data)


@router.get("/me/contributions", response_model=ApiResponse)
async def get_my_contributions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = await platform_service.list_member_contributions(
        db, current.id, page=page, page_size=page_size
    )
    return ApiResponse(success=True, data=data)


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


@router.get("/{member_id}/dues", response_model=ApiResponse)
async def get_member_dues(
    member_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
):
    if current.role == "member" and current.id != member_id:
        raise HTTPException(status_code=403, detail="Cannot view another member's dues")

    member = await platform_service.get_member(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    data = await platform_service.get_member_dues(db, member)
    return ApiResponse(success=True, data=data)


@router.get("/{member_id}/contributions", response_model=ApiResponse)
async def get_member_contributions(
    member_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[Member, Depends(get_current_member)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    if current.role == "member" and current.id != member_id:
        raise HTTPException(status_code=403, detail="Cannot view another member's contributions")

    member = await platform_service.get_member(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    data = await platform_service.list_member_contributions(
        db, member_id, page=page, page_size=page_size
    )
    return ApiResponse(success=True, data=data)


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


@router.patch("/{member_id}/role", response_model=ApiResponse)
async def update_member_role(
    member_id: UUID,
    payload: MemberRoleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Member, Depends(require_admin)],
):
    try:
        member = await platform_service.update_member_role(
            db, member_id, payload.role, actor_id=admin.id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return ApiResponse(success=True, data=member_to_dict(member), message="Role updated")
