from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.arkesel_client import ArkeselError, normalize_gh_msisdn
from v1.core.auth.dependencies import require_executive
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import (
    ApiResponse,
    SmsComposeRequest,
    SmsEstimateRequest,
    SmsTemplateCreate,
)
from v1.core.serializers import member_to_dict
from v1.core.sms_service import sms_service

router = APIRouter(prefix="/sms", tags=["SMS"])


@router.get("/dashboard", response_model=ApiResponse)
async def sms_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    data = await sms_service.dashboard_stats(db)
    return ApiResponse(success=True, data=data)


@router.get("/balance", response_model=ApiResponse)
async def sms_balance(
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        from v1.core import arkesel_client

        data = await arkesel_client.get_balance()
    except ArkeselError as exc:
        upstream = exc.status_code or 502
        status_code = 502 if upstream in (401, 403) else (upstream if 400 <= upstream < 600 else 502)
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data)


@router.get("/settings", response_model=ApiResponse)
async def sms_settings(_: Annotated[Member, Depends(require_executive)]):
    return ApiResponse(success=True, data=sms_service.settings_public())


@router.get("/recipients/groups", response_model=ApiResponse)
async def list_recipient_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    data = await sms_service.list_recipient_groups(db)
    return ApiResponse(success=True, data=data)


@router.get("/recipients", response_model=ApiResponse)
async def list_recipients(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    group: str = Query(default="active"),
    member_ids: list[UUID] | None = Query(default=None),
):
    try:
        members = await sms_service.resolve_recipients(
            db, group=group, member_ids=member_ids or []
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(
        success=True,
        data=[
            {
                **member_to_dict(m),
                "phone_normalized": normalize_gh_msisdn(m.phone_number),
            }
            for m in members
        ],
    )


@router.post("/estimate", response_model=ApiResponse)
async def estimate_sms(
    payload: SmsEstimateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.estimate(
            db,
            message=payload.message,
            recipient_group=payload.recipient_group,
            member_ids=payload.member_ids,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data)


@router.post("/compose", response_model=ApiResponse)
async def compose_sms(
    payload: SmsComposeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.compose_and_send(
            db,
            actor=executive,
            message=payload.message,
            name=payload.name,
            recipient_group=payload.recipient_group,
            member_ids=payload.member_ids,
            schedule_at=payload.schedule_at,
            sandbox=payload.sandbox,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ArkeselError as exc:
        upstream = exc.status_code or 502
        # Auth-style codes from Arkesel must not clear the portal session.
        if upstream in (401, 403):
            status_code = 502
        elif upstream == 422:
            # Arkesel uses 422 for business rules (invalid recipients, etc.)
            status_code = 400
        elif 400 <= upstream < 600:
            status_code = upstream
        else:
            status_code = 502
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="SMS campaign submitted")


@router.get("/campaigns", response_model=ApiResponse)
async def list_campaigns(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = await sms_service.list_campaigns(db, page=page, page_size=page_size)
    return ApiResponse(success=True, data=data)


@router.get("/history", response_model=ApiResponse)
async def sms_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    q: str | None = None,
):
    data = await sms_service.list_history(
        db, page=page, page_size=page_size, status=status, q=q
    )
    return ApiResponse(success=True, data=data)


@router.get("/templates", response_model=ApiResponse)
async def list_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    data = await sms_service.list_templates(db)
    return ApiResponse(success=True, data=data)


@router.post("/templates", response_model=ApiResponse)
async def create_template(
    payload: SmsTemplateCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.create_template(
            db,
            actor=executive,
            name=payload.name,
            body=payload.body,
            category=payload.category,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Template created")
