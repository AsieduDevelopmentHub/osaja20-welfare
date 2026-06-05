from fastapi import APIRouter

from v1.core.schemas import ApiResponse

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/health", response_model=ApiResponse)
async def auth_health():
    return ApiResponse(
        success=True,
        message="Auth module ready — integrate Supabase Auth for production",
        data={"provider": "supabase", "status": "pending_integration"},
    )
