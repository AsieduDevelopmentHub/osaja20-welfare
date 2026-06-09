import re
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.dependencies import require_executive
from v1.core.config import settings
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.platform_settings import get_payment_settings, save_payment_settings
from v1.core.schemas import ApiResponse, PaymentSettingsUpdate

router = APIRouter(prefix="/settings", tags=["Settings"])


def _parse_whatsapp_numbers(raw: str) -> list[str]:
    if not raw.strip():
        return []
    return [
        re.sub(r"\D", "", part)
        for part in re.split(r"[/,|]+", raw)
        if re.sub(r"\D", "", part)
    ]


@router.get("/contact", response_model=ApiResponse)
async def get_contact_config():
    """Public welfare contact details for member portal floating help button."""
    numbers = _parse_whatsapp_numbers(settings.whatsapp_number)
    phone = numbers[0] if len(numbers) == 1 else ""
    return ApiResponse(
        success=True,
        data={
            "title": "Contact us",
            "note": "Reach the welfare executives for dues, claims, or account help.",
            "email": settings.vapid_contact_email,
            "phone": phone,
            "whatsapp_numbers": numbers,
            "whatsapp_message": "Hello, I need assistance with OSAJA'20 Welfare.",
        },
    )


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
