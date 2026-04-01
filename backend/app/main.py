from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, close_db
from app.routers import auth, queue, admin, playback, websocket, superadmin


async def cleanup_old_data():
    """Clean up transient data while preserving analytics-critical history."""
    from app.database import get_db
    try:
        db = await get_db()
        # Transient queue data: clean after 30 days (played/removed songs only)
        await db.execute(
            "DELETE FROM queue_songs WHERE status IN ('played', 'removed') "
            "AND added_at < datetime('now', '-30 days')"
        )
        # Rate-limit log: only needed short-term
        await db.execute("DELETE FROM submission_log WHERE submitted_at < datetime('now', '-7 days')")
        # Ended sessions: keep 90 days for user analytics
        await db.execute(
            "DELETE FROM user_sessions WHERE ended_at IS NOT NULL "
            "AND ended_at < datetime('now', '-90 days')"
        )
        # play_history: NEVER auto-delete — this is the core analytics table
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
    title="BarQueue API",
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


@app.get("/api/health")
async def health():
    from app.database import get_db
    try:
        db = await get_db()
        await db.execute("SELECT 1")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return {
        "status": "ok" if db_status == "connected" else "error",
        "version": "1.0.0",
        "database": db_status,
    }
