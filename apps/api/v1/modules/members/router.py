from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query

from v1.core.schemas import ApiResponse, MemberCreate, MemberResponse
from v1.core.services import services

router = APIRouter(prefix="/members", tags=["Members"])


@router.post("", response_model=ApiResponse)
async def create_member(payload: MemberCreate):
    member = services.register_member({
        "full_name": payload.full_name,
        "email": payload.email,
        "phone_number": payload.phone_number,
        "date_of_birth": payload.date_of_birth.isoformat(),
        "membership_id": payload.membership_id,
        "batch": payload.batch,
        "status": "active",
        "email_verified": False,
        "registration_date": datetime.utcnow().isoformat(),
    })
    return ApiResponse(success=True, data=member, message="Member registered")


@router.get("/search", response_model=ApiResponse)
async def search_members(q: str = Query(min_length=1), limit: int = Query(default=20, le=100)):
    results = services.search_members(q, limit)
    return ApiResponse(success=True, data=results)


@router.get("/{member_id}", response_model=ApiResponse)
async def get_member(member_id: str):
    member = services._members.get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return ApiResponse(success=True, data=member)


@router.get("/{member_id}/balance", response_model=ApiResponse)
async def get_member_balance(member_id: str):
    if member_id not in services._members:
        raise HTTPException(status_code=404, detail="Member not found")
    balance = services.ledger.get_balance(member_id)
    reconciliation = services.ledger.reconcile(member_id)
    return ApiResponse(
        success=True,
        data={"balance": balance, "reconciliation": reconciliation},
    )
