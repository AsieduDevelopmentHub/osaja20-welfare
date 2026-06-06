from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member
from v1.core.auth.jwt import create_access_token
from v1.core.auth.supabase_client import SupabaseAuthError, supabase_auth
from v1.core.auth.supabase_service import (
    extract_supabase_user,
    is_duplicate_signup_error,
    link_or_create_member_from_supabase,
    member_token_response,
)
from v1.core.config import settings
from v1.core.database import get_db
from v1.core.models import Member, MemberStatus
from v1.core.schemas import ApiResponse, AuthLogin, AuthProfileUpdate, AuthRegister, TokenResponse
from v1.core.serializers import member_to_dict
from v1.core.services import platform_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/health", response_model=ApiResponse)
async def auth_health():
    return ApiResponse(
        success=True,
        message=f"Auth module active ({'supabase' if settings.uses_supabase_auth else 'local'} mode)",
        data={
            "provider": "supabase" if settings.uses_supabase_auth else "local",
            "supabase_configured": supabase_auth.is_configured,
            "database": "postgresql" if not settings.database_url.startswith("sqlite") else "sqlite",
        },
    )


@router.post("/register", response_model=ApiResponse)
async def register(payload: AuthRegister, db: Annotated[AsyncSession, Depends(get_db)]):
    existing = await db.execute(select(Member).where(Member.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    if settings.uses_supabase_auth:
        metadata = {
            "full_name": payload.full_name,
            "membership_id": payload.membership_id,
            "phone_number": payload.phone_number,
            "date_of_birth": payload.date_of_birth.isoformat(),
            "batch": payload.batch,
        }
        profile = {
            "full_name": payload.full_name,
            "email": payload.email,
            "phone_number": payload.phone_number,
            "date_of_birth": payload.date_of_birth,
            "membership_id": payload.membership_id,
            "batch": payload.batch,
        }

        sb: dict
        try:
            sb = await supabase_auth.sign_up(payload.email, payload.password, metadata=metadata)
        except SupabaseAuthError as e:
            if not is_duplicate_signup_error(e):
                raise HTTPException(status_code=e.status_code, detail=str(e)) from e
            try:
                sb = await supabase_auth.sign_in(payload.email, payload.password)
            except SupabaseAuthError as login_err:
                detail = str(login_err)
                if "email not confirmed" in detail.lower():
                    detail = "Email not confirmed yet — check your inbox, then sign in."
                raise HTTPException(status_code=login_err.status_code, detail=detail) from login_err

        user = extract_supabase_user(sb)
        if not user.get("id"):
            raise HTTPException(status_code=400, detail="Supabase signup did not return a user")

        member = await link_or_create_member_from_supabase(db, user=user, session=sb, profile=profile)

        if sb.get("access_token"):
            token = member_token_response(member)
            message = "Registration successful"
        else:
            token = None
            message = "Account created — confirm your email, then sign in."

        return ApiResponse(
            success=True,
            data={
                "member": member_to_dict(member),
                "token": token,
                "requires_email_confirmation": token is None,
            },
            message=message,
        )

    member = await platform_service.register_member(
        db,
        full_name=payload.full_name,
        email=payload.email,
        phone_number=payload.phone_number,
        date_of_birth=payload.date_of_birth,
        membership_id=payload.membership_id,
        batch=payload.batch,
        password=payload.password,
    )

    token = create_access_token(
        subject=str(member.id),
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
    if settings.uses_supabase_auth:
        try:
            session = await supabase_auth.sign_in(payload.email, payload.password)
        except SupabaseAuthError as e:
            raise HTTPException(status_code=e.status_code, detail=str(e)) from e

        user = extract_supabase_user(session)
        if not user.get("id"):
            raise HTTPException(status_code=401, detail="Invalid Supabase session")

        member = await link_or_create_member_from_supabase(db, user=user, session=session)

        if member.status == MemberStatus.ARCHIVED.value:
            raise HTTPException(status_code=403, detail="Account archived")

        await platform_service.log_activity(
            db, actor_id=member.id, action="login", entity_type="member", entity_id=member.id
        )

        return ApiResponse(
            success=True,
            data={
                "member": member_to_dict(member),
                "token": member_token_response(member),
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
