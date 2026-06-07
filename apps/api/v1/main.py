from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from v1.core.config import settings
from v1.core.database import async_session
from v1.core.init_db import init_database, warm_indexes
from v1.modules.auth.router import router as auth_router
from v1.modules.contributions.router import router as contributions_router
from v1.modules.announcements.router import router as announcements_router
from v1.modules.dashboard.router import router as dashboard_router
from v1.modules.members.router import router as members_router
from v1.modules.notifications.router import router as notifications_router
from v1.modules.push.router import router as push_router
from v1.modules.voting.router import router as voting_router
from v1.modules.welfare.router import router as welfare_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    (Path(settings.uploads_dir) / "avatars").mkdir(parents=True, exist_ok=True)
    await init_database()
    async with async_session() as session:
        await warm_indexes(session)
        await session.commit()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_allow_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = f"/api/{settings.api_version}"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(members_router, prefix=API_PREFIX)
app.include_router(welfare_router, prefix=API_PREFIX)
app.include_router(contributions_router, prefix=API_PREFIX)
app.include_router(voting_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(notifications_router, prefix=API_PREFIX)
app.include_router(announcements_router, prefix=API_PREFIX)
app.include_router(push_router, prefix=API_PREFIX)

uploads_path = Path(settings.uploads_dir)
if uploads_path.exists():
    app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.api_version,
        "database": "sqlite" if settings.database_url.startswith("sqlite") else "postgresql",
        "auth_mode": "supabase" if settings.uses_supabase_auth else "local",
    }
