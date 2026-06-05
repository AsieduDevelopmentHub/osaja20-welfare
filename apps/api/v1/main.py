from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from v1.core.config import settings
from v1.modules.auth.router import router as auth_router
from v1.modules.contributions.router import router as contributions_router
from v1.modules.dashboard.router import router as dashboard_router
from v1.modules.members.router import router as members_router
from v1.modules.voting.router import router as voting_router
from v1.modules.welfare.router import router as welfare_router

app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
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


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.api_version,
    }
