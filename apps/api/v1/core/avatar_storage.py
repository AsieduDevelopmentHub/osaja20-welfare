"""Avatar storage — Supabase Storage in production, local disk for dev."""

from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile

from v1.core.config import settings
from v1.core.supabase_storage import SupabaseStorageError, supabase_storage

ALLOWED_AVATAR_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

_MAGIC_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"RIFF", "image/webp"),
]


def _detect_image_type(data: bytes) -> str | None:
    if len(data) < 12:
        return None
    for magic, mime in _MAGIC_SIGNATURES:
        if mime == "image/webp":
            if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
                return mime
        elif data.startswith(magic):
            return mime
    return None


def avatars_dir() -> Path:
    base = Path(settings.uploads_dir) / "avatars"
    base.mkdir(parents=True, exist_ok=True)
    return base


def avatar_object_name(member_id: UUID, ext: str) -> str:
    return f"{member_id}{ext}"


def avatar_public_path(member_id: UUID, ext: str) -> str:
    return f"/uploads/avatars/{member_id}{ext}"


def _delete_local_avatars(member_id: UUID) -> None:
    folder = avatars_dir()
    for ext in ALLOWED_AVATAR_TYPES.values():
        path = folder / avatar_object_name(member_id, ext)
        if path.exists():
            path.unlink(missing_ok=True)


async def _delete_supabase_avatars(member_id: UUID) -> None:
    if not supabase_storage.is_configured:
        return
    bucket = settings.supabase_storage_bucket
    for ext in ALLOWED_AVATAR_TYPES.values():
        try:
            await supabase_storage.remove(bucket, avatar_object_name(member_id, ext))
        except SupabaseStorageError:
            pass


async def delete_member_avatar_files(member_id: UUID) -> None:
    await _delete_supabase_avatars(member_id)
    _delete_local_avatars(member_id)


async def _save_avatar_supabase(
    member_id: UUID,
    data: bytes,
    content_type: str,
    ext: str,
) -> str:
    bucket = settings.supabase_storage_bucket
    object_name = avatar_object_name(member_id, ext)
    try:
        await supabase_storage.upload(bucket, object_name, data, content_type=content_type)
    except SupabaseStorageError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not save avatar to storage: {exc}",
        ) from exc
    return supabase_storage.public_url(bucket, object_name)


def _save_avatar_local(member_id: UUID, data: bytes, ext: str) -> str:
    dest = avatars_dir() / avatar_object_name(member_id, ext)
    dest.write_bytes(data)
    return avatar_public_path(member_id, ext)


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

    detected = _detect_image_type(data)
    if not detected or detected != content_type:
        raise HTTPException(
            status_code=400,
            detail="File content does not match declared image type",
        )

    ext = ALLOWED_AVATAR_TYPES[content_type]
    await delete_member_avatar_files(member_id)

    if settings.uses_supabase_storage:
        return await _save_avatar_supabase(member_id, data, content_type, ext)
    return _save_avatar_local(member_id, data, ext)
