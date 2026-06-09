"""Supabase Storage REST client (service role uploads)."""

import logging

import httpx

from v1.core.config import settings

logger = logging.getLogger(__name__)


class SupabaseStorageError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


class SupabaseStorageClient:
    @property
    def base_url(self) -> str:
        return settings.supabase_url.rstrip("/")

    @property
    def is_configured(self) -> bool:
        return bool(self.base_url and settings.supabase_service_key.strip())

    def _service_headers(self, *, content_type: str | None = None, upsert: bool = False) -> dict[str, str]:
        if not settings.supabase_service_key:
            raise SupabaseStorageError("SUPABASE_SERVICE_KEY is not configured", 500)
        headers = {
            "apikey": settings.supabase_service_key,
            "Authorization": f"Bearer {settings.supabase_service_key}",
        }
        if content_type:
            headers["Content-Type"] = content_type
        if upsert:
            headers["x-upsert"] = "true"
        return headers

    @staticmethod
    def _parse_error(response: httpx.Response) -> str:
        try:
            body = response.json()
        except Exception:
            return response.text or "Storage request failed"
        if isinstance(body, dict):
            return str(body.get("message") or body.get("error") or "Storage request failed")
        return "Storage request failed"

    async def upload(
        self,
        bucket: str,
        path: str,
        data: bytes,
        *,
        content_type: str,
        upsert: bool = True,
    ) -> None:
        object_path = path.lstrip("/")
        url = f"{self.base_url}/storage/v1/object/{bucket}/{object_path}"
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url,
                headers=self._service_headers(content_type=content_type, upsert=upsert),
                content=data,
            )
        if response.status_code >= 400:
            raise SupabaseStorageError(self._parse_error(response), response.status_code)

    async def remove(self, bucket: str, path: str) -> None:
        object_path = path.lstrip("/")
        url = f"{self.base_url}/storage/v1/object/{bucket}/{object_path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(url, headers=self._service_headers())
        if response.status_code in (200, 204, 404):
            return
        raise SupabaseStorageError(self._parse_error(response), response.status_code)

    def public_url(self, bucket: str, path: str) -> str:
        object_path = path.lstrip("/")
        return f"{self.base_url}/storage/v1/object/public/{bucket}/{object_path}"


supabase_storage = SupabaseStorageClient()
