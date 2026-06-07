"""Controlled file serving — avatars only, with path traversal protection."""

import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from v1.core.avatar_storage import ALLOWED_AVATAR_TYPES, avatars_dir

router = APIRouter(prefix="/uploads", tags=["Uploads"])

_AVATAR_FILENAME = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    r"(\.jpg|\.png|\.webp)$",
    re.IGNORECASE,
)

_EXT_TO_MEDIA = {ext: mime for mime, ext in ALLOWED_AVATAR_TYPES.items()}


@router.get("/avatars/{filename}")
async def serve_avatar(filename: str):
    if not _AVATAR_FILENAME.match(filename):
        raise HTTPException(status_code=404, detail="Not found")

    path = (avatars_dir() / filename).resolve()
    avatars_root = avatars_dir().resolve()
    if not str(path).startswith(str(avatars_root)) or not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")

    ext = Path(filename).suffix.lower()
    media_type = _EXT_TO_MEDIA.get(ext, "application/octet-stream")
    return FileResponse(path, media_type=media_type)
