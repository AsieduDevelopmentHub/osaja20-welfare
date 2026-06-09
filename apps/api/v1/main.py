import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from v1.core.config import settings
from v1.core.database import async_session
from v1.core.init_db import init_database, warm_indexes
from v1.core.schemas import ApiResponse
from v1.core.jobs.worker import run_job_worker
from v1.core.startup import validate_settings
from v1.modules.auth.router import router as auth_router
from v1.modules.birthdays.router import router as birthdays_router
from v1.modules.contributions.router import router as contributions_router
from v1.modules.announcements.router import router as announcements_router
from v1.modules.activity.router import router as activity_router
from v1.modules.dashboard.router import router as dashboard_router
from v1.modules.members.router import router as members_router
from v1.modules.notifications.router import router as notifications_router
from v1.modules.payments.router import router as payments_router
from v1.modules.push.router import router as push_router
from v1.modules.settings.router import router as settings_router
from v1.modules.support.router import router as support_router
from v1.modules.uploads.router import router as uploads_router
from v1.modules.voting.router import router as voting_router
from v1.modules.welfare.router import router as welfare_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_settings()
    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    (Path(settings.uploads_dir) / "avatars").mkdir(parents=True, exist_ok=True)
    await init_database()
    async with async_session() as session:
        await warm_indexes(session)
        await session.commit()

    stop_worker = asyncio.Event()
    worker_task = asyncio.create_task(run_job_worker(stop_worker))

    yield

    stop_worker.set()
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        raise exc
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content=ApiResponse(success=False, message="An internal error occurred").model_dump(),
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = f"/api/{settings.api_version}"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(members_router, prefix=API_PREFIX)
app.include_router(welfare_router, prefix=API_PREFIX)
app.include_router(contributions_router, prefix=API_PREFIX)
app.include_router(payments_router, prefix=API_PREFIX)
app.include_router(voting_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(birthdays_router, prefix=API_PREFIX)
app.include_router(notifications_router, prefix=API_PREFIX)
app.include_router(announcements_router, prefix=API_PREFIX)
app.include_router(activity_router, prefix=API_PREFIX)
app.include_router(push_router, prefix=API_PREFIX)
app.include_router(settings_router, prefix=API_PREFIX)
app.include_router(support_router, prefix=API_PREFIX)
app.include_router(uploads_router)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.api_version,
        "database": "sqlite" if settings.database_url.startswith("sqlite") else "postgresql",
        "auth_mode": "supabase" if settings.uses_supabase_auth else "local",
    }
