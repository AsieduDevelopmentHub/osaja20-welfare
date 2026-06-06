"""Avatar file storage on local disk."""

from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile

from v1.core.config import settings

ALLOWED_AVATAR_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def avatars_dir() -> Path:
    base = Path(settings.uploads_dir) / "avatars"
    base.mkdir(parents=True, exist_ok=True)
    return base


def avatar_public_path(member_id: UUID, ext: str) -> str:
    return f"/uploads/avatars/{member_id}{ext}"


def delete_member_avatar_files(member_id: UUID) -> None:
    folder = avatars_dir()
    for ext in ALLOWED_AVATAR_TYPES.values():
        path = folder / f"{member_id}{ext}"
        if path.exists():
            path.unlink(missing_ok=True)


async def save_avatar(member_id: UUID, file: UploadFile) -> str:
    content_type = file.content_type or ""
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Avatar must be JPEG, PNG, or WebP",
        )

    data = await file.read()
    if len(data) > settings.max_avatar_bytes:
        raise HTTPException(status_code=400, detail="Avatar must be under 2 MB")
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="Invalid image file")

    ext = ALLOWED_AVATAR_TYPES[content_type]
    delete_member_avatar_files(member_id)
    dest = avatars_dir() / f"{member_id}{ext}"
    dest.write_bytes(data)
    return avatar_public_path(member_id, ext)
