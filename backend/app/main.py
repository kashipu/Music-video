import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.database import init_db, close_db, get_db
from app.routers import auth, queue, admin, admin_auth, playback, websocket, superadmin, billing, test
from app.services import email_service

logger = logging.getLogger(__name__)
_db_size_alerted = False


def get_logos_dir():
    d = os.path.join(os.path.dirname(os.path.abspath(settings.database_path)), "logos")
    os.makedirs(d, exist_ok=True)
    return d


async def cleanup_old_data():
    """Delete data older than 7 days to keep DB small, and expire stale sessions."""
    from app.database import get_db
    try:
        db = await get_db()
        await db.execute("DELETE FROM queue_songs WHERE added_at < datetime('now', '-7 days')")
        await db.execute("DELETE FROM submission_log WHERE submitted_at < datetime('now', '-7 days')")
        # play_history is now preserved for long-term analytics
        await db.execute("DELETE FROM user_sessions WHERE ended_at IS NOT NULL AND ended_at < datetime('now', '-7 days')")
        # analytics_events otherwise grows unbounded; 180 days covers every
        # dashboard the panel offers (max query range is 30 days)
        await db.execute("DELETE FROM analytics_events WHERE created_at < datetime('now', '-180 days')")
        await db.commit()
    except Exception:
        pass

    # Expire sessions that exceed inactivity or max duration limits
    try:
        from app.services.auth_service import expire_stale_sessions
        expired = await expire_stale_sessions()
        if expired:
            import logging
            logging.getLogger(__name__).info(f"Expired {expired} stale sessions")
    except Exception:
        pass


async def check_database_size() -> bool:
    """Alert once while the SQLite database remains above its configured limit."""
    global _db_size_alerted
    try:
        size_bytes = os.path.getsize(settings.database_path)
    except OSError:
        logger.warning("Could not read database size for %s", settings.database_path)
        return False

    if size_bytes <= settings.db_size_alert_threshold_bytes:
        _db_size_alerted = False
        return False
    if _db_size_alerted:
        return True

    db = await get_db()
    recipients = await db.execute_fetchall(
        "SELECT email FROM super_admins "
        "WHERE COALESCE(role, 'super_admin') = 'super_admin' AND email IS NOT NULL AND email != ''"
    )
    size_mb = size_bytes / 1024 / 1024
    threshold_mb = settings.db_size_alert_threshold_bytes / 1024 / 1024
    for row in recipients:
        await email_service.send_email(
            row[0],
            "Alerta: la base de datos de Repitela crece",
            f"<p>La base de datos ocupa {size_mb:.1f} MiB y superó el umbral de {threshold_mb:.0f} MiB.</p>",
        )
    logger.warning("Database size alert: %.1f MiB exceeds %.0f MiB", size_mb, threshold_mb)
    _db_size_alerted = True
    return True


async def _hourly_cleanup_loop():
    # The container runs for weeks (restart: unless-stopped), so a
    # startup-only cleanup never fires again; this loop keeps it periodic.
    import asyncio
    while True:
        await asyncio.sleep(3600)
        await cleanup_old_data()
        await check_database_size()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    await init_db()
    await cleanup_old_data()
    await check_database_size()
    cleanup_task = asyncio.create_task(_hourly_cleanup_loop())
    yield
    cleanup_task.cancel()
    await close_db()


app = FastAPI(
    title="Repitela API",
    description="Music queue system for bars",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
# allow_origins=["*"] junto a allow_credentials=True es una combinacion que el estandar
# prohibe y que Starlette resuelve reflejando el Origin del atacante. La app autentica
# con Bearer en header (no cookies), asi que apagar credentials con wildcard no rompe nada.
origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials="*" not in origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(queue.router)
app.include_router(admin.router)
app.include_router(admin_auth.router)
app.include_router(playback.router)
app.include_router(websocket.router)
app.include_router(superadmin.router)
app.include_router(billing.router)
app.include_router(billing.webhook_router)
if settings.app_env == "test":
    app.include_router(test.router)


@app.get("/api/uploads/{filename}")
async def serve_upload(filename: str):
    """Serve uploaded files (logos)."""
    filepath = os.path.join(get_logos_dir(), filename)
    if not os.path.isfile(filepath):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")
    # Determine media type
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    media_types = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "svg": "image/svg+xml"}
    media_type = media_types.get(ext, "application/octet-stream")
    return FileResponse(filepath, media_type=media_type, headers={"Cache-Control": "public, max-age=604800"})


@app.get("/api/health")
async def health():
    from app.database import get_db
    try:
        db = await get_db()
        await db.execute("SELECT 1")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    # No filesystem paths / file listings here: /api/health is public
    return {
        "status": "ok" if db_status == "connected" else "error",
        "version": "1.0.2",
        "database": db_status,
    }


@app.get("/api/config")
async def public_config():
    return JSONResponse(
        {"google_signup": settings.google_signup, "pagos": settings.pagos},
        headers={"Cache-Control": "public, max-age=60"},
    )
