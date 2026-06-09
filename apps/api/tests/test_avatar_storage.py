"""Avatar storage — local disk and Supabase URL helpers."""

import io
from uuid import uuid4

import pytest
from fastapi import UploadFile

from v1.core.avatar_storage import (
    avatar_object_name,
    avatar_public_path,
    delete_member_avatar_files,
    save_avatar,
)
from v1.core.config import settings


def _upload_file(content: bytes, content_type: str) -> UploadFile:
    return UploadFile(filename="avatar.jpg", file=io.BytesIO(content), headers={"content-type": content_type})


_JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 120


@pytest.mark.asyncio
async def test_save_avatar_local_returns_api_path(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "supabase_url", "")
    monkeypatch.setattr(settings, "supabase_service_key", "")
    monkeypatch.setattr(settings, "uploads_dir", str(tmp_path))

    member_id = uuid4()
    url = await save_avatar(member_id, _upload_file(_JPEG, "image/jpeg"))

    assert url == avatar_public_path(member_id, ".jpg")
    assert (tmp_path / "avatars" / avatar_object_name(member_id, ".jpg")).is_file()

    await delete_member_avatar_files(member_id)
    assert not (tmp_path / "avatars" / avatar_object_name(member_id, ".jpg")).exists()


@pytest.mark.asyncio
async def test_save_avatar_supabase_returns_public_url(monkeypatch):
    member_id = uuid4()
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co", raising=False)
    monkeypatch.setattr(settings, "supabase_service_key", "service-key", raising=False)
    monkeypatch.setattr(settings, "supabase_storage_bucket", "avatars", raising=False)

    uploaded: dict[str, bytes] = {}

    async def fake_upload(bucket, path, data, *, content_type, upsert=True):
        uploaded[f"{bucket}/{path}"] = data

    async def fake_remove(bucket, path):
        uploaded.pop(f"{bucket}/{path}", None)

    monkeypatch.setattr("v1.core.avatar_storage.supabase_storage.upload", fake_upload)
    monkeypatch.setattr("v1.core.avatar_storage.supabase_storage.remove", fake_remove)
    monkeypatch.setattr("v1.core.avatar_storage._delete_local_avatars", lambda _id: None)

    url = await save_avatar(member_id, _upload_file(_JPEG, "image/jpeg"))

    assert url == f"https://example.supabase.co/storage/v1/object/public/avatars/{member_id}.jpg"
    assert uploaded
