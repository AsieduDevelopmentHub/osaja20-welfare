from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.auth.jwt import extract_member_id, extract_role, safe_decode
from v1.core.database import get_db
from v1.core.models import Member, UserRole

security = HTTPBearer(auto_error=False)


async def get_current_member(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Member:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = safe_decode(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    member_id = extract_member_id(payload)
    if member_id:
        result = await db.execute(select(Member).where(Member.id == member_id))
        member = result.scalar_one_or_none()
        if member:
            return member

    auth_user_id = payload.get("sub")
    if auth_user_id:
        result = await db.execute(
            select(Member).where(Member.auth_user_id == UUID(str(auth_user_id)))
        )
        member = result.scalar_one_or_none()
        if member:
            return member

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Member profile not found")


def require_roles(*roles: UserRole):
    allowed = {r.value for r in roles}

    async def checker(member: Annotated[Member, Depends(get_current_member)]) -> Member:
        if member.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(sorted(allowed))}",
            )
        return member

    return checker


require_admin = require_roles(UserRole.ADMINISTRATOR)
require_executive = require_roles(UserRole.ADMINISTRATOR, UserRole.EXECUTIVE)
require_member = require_roles(UserRole.ADMINISTRATOR, UserRole.EXECUTIVE, UserRole.MEMBER)
