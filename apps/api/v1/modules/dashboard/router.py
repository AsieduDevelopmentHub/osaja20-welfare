from datetime import date

from fastapi import APIRouter

from v1.core.schemas import ApiResponse
from v1.core.services import services

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=ApiResponse)
async def dashboard_stats():
    members = list(services._members.values())
    active = [m for m in members if m.get("status") == "active"]
    pending_welfare = [
        c for c in services._welfare_cases.values()
        if c.get("status") not in ("resolved", "archived")
    ]
    active_votes = [v for v in services._votes.values() if v.get("status") == "open"]
    today = date.today()
    birthdays_today = services.birthday_index.get_birthdays_for_date(today.month, today.day)

    return ApiResponse(
        success=True,
        data={
            "total_members": len(members),
            "active_members": len(active),
            "pending_welfare_cases": len(pending_welfare),
            "total_contributions": services.ledger.get_total_contributions(),
            "upcoming_birthdays_today": len(birthdays_today),
            "active_votes": len(active_votes),
        },
    )


@router.get("/birthdays", response_model=ApiResponse)
async def monthly_birthdays(month: int | None = None):
    target_month = month or date.today().month
    birthdays = services.birthday_index.get_birthdays_for_month(target_month)
    return ApiResponse(
        success=True,
        data=[{"member_id": b.member_id, "full_name": b.full_name, "day": b.day} for b in birthdays],
    )
