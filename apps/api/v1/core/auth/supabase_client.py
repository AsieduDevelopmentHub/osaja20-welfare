"""Supabase Auth REST client for signup, login, and token refresh."""

import httpx

from v1.core.config import settings


class SupabaseAuthError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


class SupabaseAuthClient:
    def __init__(self) -> None:
        self.base_url = settings.supabase_url.rstrip("/")
        self.anon_key = settings.supabase_anon_key

    @property
    def is_configured(self) -> bool:
        return bool(self.base_url and self.anon_key)

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _parse_error(response: httpx.Response) -> str:
        try:
            body = response.json()
        except Exception:
            return response.text or "Request failed"
        return (
            body.get("msg")
            or body.get("error_description")
            or body.get("message")
            or body.get("error")
            or "Request failed"
        )

    async def sign_up(self, email: str, password: str, metadata: dict | None = None) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/auth/v1/signup",
                headers=self._headers(),
                json={"email": email, "password": password, "data": metadata or {}},
            )
        if response.status_code >= 400:
            raise SupabaseAuthError(self._parse_error(response), response.status_code)
        return response.json()

    async def sign_in(self, email: str, password: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/auth/v1/token?grant_type=password",
                headers=self._headers(),
                json={"email": email, "password": password},
            )
        if response.status_code >= 400:
            raise SupabaseAuthError(self._parse_error(response), response.status_code)
        return response.json()

    async def get_user(self, access_token: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/auth/v1/user",
                headers={**self._headers(), "Authorization": f"Bearer {access_token}"},
            )
        if response.status_code >= 400:
            raise SupabaseAuthError("Invalid session", response.status_code)
        return response.json()

    def _service_headers(self) -> dict[str, str]:
        if not settings.supabase_service_key:
            raise SupabaseAuthError("SUPABASE_SERVICE_KEY is not configured", 500)
        return {
            "apikey": settings.supabase_service_key,
            "Authorization": f"Bearer {settings.supabase_service_key}",
            "Content-Type": "application/json",
        }

    async def reset_password_for_email(self, email: str, redirect_to: str | None = None) -> None:
        payload: dict = {"email": email}
        if redirect_to:
            payload["redirect_to"] = redirect_to
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/auth/v1/recover",
                headers=self._headers(),
                json=payload,
            )
        if response.status_code >= 400:
            raise SupabaseAuthError(self._parse_error(response), response.status_code)

    async def admin_create_user(
        self,
        email: str,
        password: str,
        *,
        metadata: dict | None = None,
        email_confirm: bool = True,
    ) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/auth/v1/admin/users",
                headers=self._service_headers(),
                json={
                    "email": email,
                    "password": password,
                    "email_confirm": email_confirm,
                    "user_metadata": metadata or {},
                },
            )
        if response.status_code >= 400:
            raise SupabaseAuthError(self._parse_error(response), response.status_code)
        return response.json()


supabase_auth = SupabaseAuthClient()
