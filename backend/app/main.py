import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import settings
from app.database import init_db, close_db
from app.routers import auth, queue, admin, playback, websocket, superadmin


def get_logos_dir():
    d = os.path.join(os.path.dirname(os.path.abspath(settings.database_path)), "logos")
    os.makedirs(d, exist_ok=True)
    return d


async def cleanup_old_data():
    """Delete data older than 7 days to keep DB small."""
    from app.database import get_db
    try:
        db = await get_db()
        await db.execute("DELETE FROM queue_songs WHERE added_at < datetime('now', '-7 days')")
        await db.execute("DELETE FROM submission_log WHERE submitted_at < datetime('now', '-7 days')")
        # play_history is now preserved for long-term analytics
        await db.execute("DELETE FROM user_sessions WHERE ended_at IS NOT NULL AND ended_at < datetime('now', '-7 days')")
        await db.commit()
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await cleanup_old_data()
    yield
    await close_db()


app = FastAPI(
    title="Repitela API",
    description="Music queue system for bars",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(queue.router)
app.include_router(admin.router)
app.include_router(playback.router)
app.include_router(websocket.router)
app.include_router(superadmin.router)


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

    logos_dir = get_logos_dir()
    logo_files = os.listdir(logos_dir) if os.path.isdir(logos_dir) else []

    return {
        "status": "ok" if db_status == "connected" else "error",
        "version": "1.0.2",
        "database": db_status,
        "logos_dir": os.path.abspath(logos_dir),
        "logo_files": logo_files,
    }
