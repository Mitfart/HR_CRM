from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    applications,
    deals,
    candidates,
    matches,
    bot,
    auth,
    ws,
    admin,
    crm_notifications,
    crm_audit_log,
    crm_health,
    hr_time,
    deletions,
    history,
    client_portal,
    office_operations,
)
from app.routers import calendar, contracts


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core API
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(applications.router, prefix="/api/applications", tags=["applications"])
app.include_router(deals.router, prefix="/api/deals", tags=["deals"])
app.include_router(candidates.router, prefix="/api/candidates", tags=["candidates"])
app.include_router(matches.router, prefix="/api/matches", tags=["matches"])
app.include_router(bot.router, prefix="/api/bot", tags=["bot"])
app.include_router(ws.router, prefix="/ws", tags=["websocket"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

# Calendar & video meetings
app.include_router(calendar.router, prefix="/api/calendar", tags=["calendar"])

# Contract generation
app.include_router(contracts.router, prefix="/api/contracts", tags=["contracts"])

# System
app.include_router(crm_notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(crm_audit_log.router, prefix="/api/audit-log", tags=["audit-log"])
app.include_router(crm_health.router, prefix="/api/health", tags=["health"])
app.include_router(hr_time.router, prefix="/api/hr-time", tags=["hr-time"])
app.include_router(deletions.router, prefix="/api/deletions", tags=["deletions"])
app.include_router(history.router, prefix="/api/history", tags=["history"])
app.include_router(client_portal.router, prefix="/api/client", tags=["client-portal"])
app.include_router(office_operations.router, prefix="/api/office-operations", tags=["office-operations"])


@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok", "service": settings.app_name}
