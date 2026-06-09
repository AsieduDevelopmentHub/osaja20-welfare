import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import get_current_member
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.paystack_client import verify_webhook_signature
from v1.core.payment_service import complete_payment_if_successful, handle_paystack_webhook, initialize_dues_payment
from v1.core.schemas import ApiResponse, PaymentInitialize

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/initialize", response_model=ApiResponse)
async def initialize_payment(
    payload: PaymentInitialize,
    db: Annotated[AsyncSession, Depends(get_db)],
    member: Annotated[Member, Depends(get_current_member)],
):
    periods = [p.model_dump() for p in payload.periods]
    try:
        data = await initialize_dues_payment(db, member, periods)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    return ApiResponse(success=True, data=data, message="Redirect to Paystack to complete payment")


@router.get("/verify/{reference}", response_model=ApiResponse)
async def verify_payment(
    reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    member: Annotated[Member, Depends(get_current_member)],
):
    from sqlalchemy import select

    from v1.core.models import PaymentTransaction

    existing = await db.execute(
        select(PaymentTransaction).where(PaymentTransaction.reference == reference)
    )
    tx = existing.scalar_one_or_none()
    if not tx or tx.member_id != member.id:
        raise HTTPException(status_code=404, detail="Payment not found")

    try:
        data = await complete_payment_if_successful(db, reference, actor_id=member.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if data.get("status") != "success":
        raise HTTPException(status_code=400, detail="Payment not completed")

    await db.commit()
    return ApiResponse(success=True, data=data, message="Payment verified and dues recorded")


@router.post("/webhook", response_model=ApiResponse)
async def paystack_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    body = await request.body()
    signature = request.headers.get("x-paystack-signature")
    if not verify_webhook_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    event = str(payload.get("event", ""))
    data = payload.get("data") or {}
    result = await handle_paystack_webhook(db, event, data)
    await db.commit()

    if result:
        logger.info("Webhook recorded payment %s", result.get("reference"))
    return ApiResponse(success=True, message="Webhook processed")
