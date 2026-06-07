from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import require_executive
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.platform_settings import get_payment_settings, save_payment_settings
from v1.core.schemas import ApiResponse, PaymentSettingsUpdate

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/payment", response_model=ApiResponse)
async def get_payment_config(db: Annotated[AsyncSession, Depends(get_db)]):
    """Public payment instructions for member app (MoMo, bank, dues amount)."""
    data = await get_payment_settings(db)
    return ApiResponse(success=True, data=data)


@router.put("/payment", response_model=ApiResponse)
async def update_payment_config(
    payload: PaymentSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    data = await save_payment_settings(db, payload.model_dump(exclude_none=True))
    return ApiResponse(success=True, data=data, message="Payment settings updated")
