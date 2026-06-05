from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member
from v1.core.auth.jwt import create_access_token
from v1.core.auth.supabase_client import SupabaseAuthError, supabase_auth
from v1.core.config import settings
from v1.core.database import get_db
from v1.core.models import Member, MemberStatus
from v1.core.schemas import ApiResponse, AuthLogin, AuthProfileUpdate, AuthRegister, TokenResponse
from v1.core.serializers import member_to_dict
from v1.core.services import platform_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/health", response_model=ApiResponse)
async def auth_health():
    mode = "supabase" if supabase_auth.is_configured else "local"
    return ApiResponse(
        success=True,
        message=f"Auth module active ({mode} mode)",
        data={"provider": mode, "status": "ready"},
    )


@router.post("/register", response_model=ApiResponse)
async def register(payload: AuthRegister, db: Annotated[AsyncSession, Depends(get_db)]):
    existing = await db.execute(select(Member).where(Member.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    auth_user_id = None
    email_verified = False

    if supabase_auth.is_configured and not settings.use_local_auth:
        try:
            sb_user = await supabase_auth.sign_up(
                payload.email,
                payload.password,
                metadata={"full_name": payload.full_name, "membership_id": payload.membership_id},
            )
            auth_user_id = UUID(sb_user["user"]["id"]) if sb_user.get("user") else None
            email_verified = bool(sb_user.get("user", {}).get("email_confirmed_at"))
        except SupabaseAuthError as e:
            raise HTTPException(status_code=e.status_code, detail=str(e)) from e

    member = await platform_service.register_member(
        db,
        full_name=payload.full_name,
        email=payload.email,
        phone_number=payload.phone_number,
        date_of_birth=payload.date_of_birth,
        membership_id=payload.membership_id,
        batch=payload.batch,
        password=payload.password if settings.use_local_auth or not supabase_auth.is_configured else None,
        auth_user_id=auth_user_id,
        email_verified=email_verified,
    )

    token = create_access_token(
        subject=str(auth_user_id or member.id),
        email=member.email,
        role=member.role,
        member_id=str(member.id),
    )

    return ApiResponse(
        success=True,
        data={
            "member": member_to_dict(member),
            "token": TokenResponse(
                access_token=token,
                expires_in=settings.jwt_expire_minutes * 60,
            ).model_dump(),
        },
        message="Registration successful",
    )


@router.post("/login", response_model=ApiResponse)
async def login(payload: AuthLogin, db: Annotated[AsyncSession, Depends(get_db)]):
    if supabase_auth.is_configured and not settings.use_local_auth:
        try:
            session = await supabase_auth.sign_in(payload.email, payload.password)
        except SupabaseAuthError as e:
            raise HTTPException(status_code=e.status_code, detail=str(e)) from e

        user = session.get("user", {})
        result = await db.execute(
            select(Member).where(Member.auth_user_id == UUID(user["id"]))
        )
        member = result.scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=404, detail="Member profile not found")

        return ApiResponse(
            success=True,
            data={
                "member": member_to_dict(member),
                "token": {
                    "access_token": session["access_token"],
                    "token_type": "bearer",
                    "expires_in": session.get("expires_in", 3600),
                },
            },
            message="Login successful",
        )

    member = await platform_service.authenticate_local(db, payload.email, payload.password)
    if not member:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if member.status == MemberStatus.ARCHIVED.value:
        raise HTTPException(status_code=403, detail="Account archived")

    token = create_access_token(
        subject=str(member.auth_user_id or member.id),
        email=member.email,
        role=member.role,
        member_id=str(member.id),
    )

    await platform_service.log_activity(
        db, actor_id=member.id, action="login", entity_type="member", entity_id=member.id
    )

    return ApiResponse(
        success=True,
        data={
            "member": member_to_dict(member),
            "token": TokenResponse(
                access_token=token,
                expires_in=settings.jwt_expire_minutes * 60,
            ).model_dump(),
        },
        message="Login successful",
    )


@router.get("/me", response_model=ApiResponse)
async def get_me(current: Annotated[Member, Depends(get_current_member)]):
    return ApiResponse(success=True, data=member_to_dict(current))


@router.patch("/profile", response_model=ApiResponse)
async def update_profile(
    payload: AuthProfileUpdate,
    current: Annotated[Member, Depends(get_current_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if payload.full_name is not None:
        current.full_name = payload.full_name
    if payload.phone_number is not None:
        current.phone_number = payload.phone_number

    await db.flush()
    await platform_service.log_activity(
        db,
        actor_id=current.id,
        action="profile_updated",
        entity_type="member",
        entity_id=current.id,
    )
    return ApiResponse(success=True, data=member_to_dict(current), message="Profile updated")


@router.post("/logout", response_model=ApiResponse)
async def logout(current: Annotated[Member, Depends(get_current_member)]):
    return ApiResponse(success=True, message="Logged out — discard token on client")
