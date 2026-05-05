import bcrypt
from fastapi import APIRouter, HTTPException
from app.database import get_db
from app.config import settings

router = APIRouter(prefix="/api/test", tags=["test"])

@router.post("/reset")
async def reset_db():
    if settings.app_env != "test":
        raise HTTPException(status_code=403, detail="Only allowed in test environment")
    
    db = await get_db()
    
    # Disable FKs to allow clearing tables in any order
    await db.execute("PRAGMA foreign_keys = OFF")
    
    # Tables to clear
    tables = [
        "queue_songs", "user_sessions", "users", "submission_log", 
        "admins", "fallback_songs", "play_history", "venue_daily_pins",
        "analytics_events", "blocked_videos", "venues"
    ]
    
    for table in tables:
        try:
            await db.execute(f"DELETE FROM {table}")
        except Exception as e:
            print(f"Error clearing table {table}: {e}")
            pass
    
    # Reset sequences
    try:
        await db.execute("DELETE FROM sqlite_sequence")
    except Exception:
        pass

    # Re-enable FKs
    await db.execute("PRAGMA foreign_keys = ON")

    # Seed baseline data
    # 1. Venue
    await db.execute(
        "INSERT INTO venues (id, name, slug, active) VALUES (1, 'E2E Venue', 'e2e-test', 1)"
    )
    
    # 2. Admin (password: admin123)
    pwd_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
    await db.execute(
        "INSERT INTO admins (venue_id, username, password_hash) VALUES (1, 'admin', ?)",
        (pwd_hash,)
    )
    
    # 3. Fallback songs
    fallback_songs = [
        ("fb1_vid_id1", "Fallback Track One"),
        ("fb2_vid_id2", "Fallback Track Two"),
        ("fb3_vid_id3", "Fallback Track Three"),
    ]
    for i, (yt_id, title) in enumerate(fallback_songs):
        await db.execute(
            "INSERT INTO fallback_songs (venue_id, youtube_id, title, position) VALUES (1, ?, ?, ?)",
            (yt_id, title, i + 1)
        )
    
    await db.commit()
    
    # Clear in-memory caches if any (playback_service uses some)
    from app.services import playback_service
    if hasattr(playback_service, "_fallback_now_playing"):
        playback_service._fallback_now_playing.clear()
    if hasattr(playback_service, "_playback_status"):
        playback_service._playback_status.clear()

    return {"message": "Database reset and seeded for E2E tests"}
