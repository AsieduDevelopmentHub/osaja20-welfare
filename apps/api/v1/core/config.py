from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "OSAJA'20 Welfare API"
    api_version: str = "v1"
    debug: bool = False

    # SQLite works out of the box for local dev (no Docker). Use PostgreSQL in production.
    database_url: str = "sqlite+aiosqlite:///./osaja_welfare.db"
    redis_url: str = "redis://localhost:6379/0"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    # Use local email/password auth when Supabase is not configured
    use_local_auth: bool = True

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]

    default_batch: int = 2020


settings = Settings()
