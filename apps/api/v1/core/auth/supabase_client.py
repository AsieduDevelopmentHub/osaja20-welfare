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

    async def sign_up(self, email: str, password: str, metadata: dict | None = None) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/auth/v1/signup",
                headers=self._headers(),
                json={"email": email, "password": password, "data": metadata or {}},
            )
        if response.status_code >= 400:
            raise SupabaseAuthError(response.json().get("msg", "Signup failed"), response.status_code)
        return response.json()

    async def sign_in(self, email: str, password: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/auth/v1/token?grant_type=password",
                headers=self._headers(),
                json={"email": email, "password": password},
            )
        if response.status_code >= 400:
            raise SupabaseAuthError(response.json().get("error_description", "Login failed"), response.status_code)
        return response.json()

    async def get_user(self, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/auth/v1/user",
                headers={**self._headers(), "Authorization": f"Bearer {access_token}"},
            )
        if response.status_code >= 400:
            raise SupabaseAuthError("Invalid session", response.status_code)
        return response.json()


supabase_auth = SupabaseAuthClient()
