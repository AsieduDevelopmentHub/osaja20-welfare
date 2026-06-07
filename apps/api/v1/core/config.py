from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "OSAJA'20 Welfare API"
    api_version: str = "v1"
    debug: bool = False

    database_url: str = "sqlite+aiosqlite:///./osaja_welfare.db"
    redis_url: str = "redis://localhost:6379/0"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    use_local_auth: bool = True

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]
    # Matches any Cloudflare quick-tunnel host when the browser calls the API directly
    cors_allow_origin_regex: str = r"https://.*\.trycloudflare\.com"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    default_batch: int = 2020
    uploads_dir: str = "uploads"
    max_avatar_bytes: int = 2 * 1024 * 1024

    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_contact_email: str = "admin@osaja.com"

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            value = value.replace("postgres://", "postgresql+asyncpg://", 1)
        elif value.startswith("postgresql://") and "+asyncpg" not in value:
            value = value.replace("postgresql://", "postgresql+asyncpg://", 1)

        # Transaction pooler (6543) breaks asyncpg/SQLAlchemy — use session pooler (5432)
        if "pooler.supabase.com:6543" in value:
            value = value.replace("pooler.supabase.com:6543", "pooler.supabase.com:5432")

        if "pooler.supabase.com" in value and "prepared_statement_cache_size" not in value:
            value = f"{value}?prepared_statement_cache_size=0"

        return value

    @property
    def uses_supabase_auth(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key and not self.use_local_auth)

    @property
    def database_requires_ssl(self) -> bool:
        if self.database_url.startswith("sqlite"):
            return False
        return "localhost" not in self.database_url and "127.0.0.1" not in self.database_url

    @property
    def database_uses_pgbouncer(self) -> bool:
        """Supabase pooler host — needs asyncpg statement cache disabled."""
        if self.database_url.startswith("sqlite"):
            return False
        return "pooler.supabase.com" in self.database_url


settings = Settings()
