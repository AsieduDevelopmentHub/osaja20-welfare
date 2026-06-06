from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
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
from v1.core.member_identity import validate_username
from v1.core.models import Member, MemberStatus
from v1.core.schemas import ApiResponse, AuthLogin, AuthProfileUpdate, AuthRegister, TokenResponse
from v1.core.avatar_storage import delete_member_avatar_files, save_avatar
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

    if payload.username:
        try:
            username = validate_username(payload.username)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        taken = await db.execute(select(Member).where(Member.username == username))
        if taken.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already taken")
    else:
        username = None

    if settings.uses_supabase_auth:
        metadata = {
            "full_name": payload.full_name,
            "phone_number": payload.phone_number,
            "date_of_birth": payload.date_of_birth.isoformat(),
            "batch": payload.batch,
        }
        if username:
            metadata["username"] = username

        profile = {
            "full_name": payload.full_name,
            "email": payload.email,
            "phone_number": payload.phone_number,
            "date_of_birth": payload.date_of_birth,
            "batch": payload.batch,
            "username": username,
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

        try:
            member = await link_or_create_member_from_supabase(db, user=user, session=sb, profile=profile)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        if sb.get("access_token"):
            token = member_token_response(member)
            message = (
                f"Registration successful. Your member ID is {member.membership_id} "
                f"and username is {member.username}."
            )
        else:
            token = None
            message = (
                f"Account created — confirm your email, then sign in. "
                f"Your member ID is {member.membership_id} and username is {member.username}."
            )

        return ApiResponse(
            success=True,
            data={
                "member": member_to_dict(member),
                "token": token,
                "requires_email_confirmation": token is None,
            },
            message=message,
        )

    try:
        member = await platform_service.register_member(
            db,
            full_name=payload.full_name,
            email=payload.email,
            phone_number=payload.phone_number,
            date_of_birth=payload.date_of_birth,
            batch=payload.batch,
            username=username,
            password=payload.password,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    member.status = MemberStatus.ACTIVE.value
    await db.flush()

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
        message=(
            f"Registration successful. Your member ID is {member.membership_id} "
            f"and username is {member.username}."
        ),
    )


@router.post("/login", response_model=ApiResponse)
async def login(payload: AuthLogin, db: Annotated[AsyncSession, Depends(get_db)]):
    if settings.uses_supabase_auth:
        login_email = await platform_service.resolve_login_email(db, payload.identifier)
        if not login_email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        try:
            session = await supabase_auth.sign_in(login_email, payload.password)
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

    member = await platform_service.authenticate_local(db, payload.identifier, payload.password)
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
    prefs = payload.preferences.model_dump(exclude_none=True) if payload.preferences else None
    try:
        member = await platform_service.update_member_profile(
            db,
            current,
            full_name=payload.full_name,
            phone_number=payload.phone_number,
            username=payload.username,
            date_of_birth=payload.date_of_birth,
            preferences=prefs,
            actor_id=current.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return ApiResponse(success=True, data=member_to_dict(member), message="Profile updated")


@router.post("/profile/avatar", response_model=ApiResponse)
async def upload_avatar(
    current: Annotated[Member, Depends(get_current_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
):
    avatar_url = await save_avatar(current.id, file)
    member = await platform_service.set_member_avatar(db, current, avatar_url, actor_id=current.id)
    return ApiResponse(success=True, data=member_to_dict(member), message="Profile photo updated")


@router.delete("/profile/avatar", response_model=ApiResponse)
async def remove_avatar(
    current: Annotated[Member, Depends(get_current_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    delete_member_avatar_files(current.id)
    member = await platform_service.clear_member_avatar(db, current, actor_id=current.id)
    return ApiResponse(success=True, data=member_to_dict(member), message="Profile photo removed")


@router.post("/logout", response_model=ApiResponse)
async def logout(current: Annotated[Member, Depends(get_current_member)]):
    return ApiResponse(success=True, message="Logged out — discard token on client")
