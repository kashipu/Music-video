import json
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.database import get_db


async def get_rate_limit_info(user_id: int, venue_id: int) -> dict:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT COUNT(*) FROM submission_log "
        "WHERE user_id = ? AND venue_id = ? AND submitted_at > datetime('now', ?)",
        (user_id, venue_id, f"-{settings.window_minutes} minutes"),
    )
    recent = rows[0][0] if rows else 0
    remaining = max(0, settings.max_songs_per_window - recent)

    # Get oldest submission time for reset calculation
    oldest_rows = await db.execute_fetchall(
        "SELECT MIN(submitted_at) FROM submission_log "
        "WHERE user_id = ? AND venue_id = ? AND submitted_at > datetime('now', ?)",
        (user_id, venue_id, f"-{settings.window_minutes} minutes"),
    )

    now = datetime.now(timezone.utc)
    if oldest_rows and oldest_rows[0][0]:
        try:
            oldest_dt = datetime.fromisoformat(oldest_rows[0][0])
            # SQLite datetime('now') stores UTC without timezone info
            if oldest_dt.tzinfo is None:
                oldest_dt = oldest_dt.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            oldest_dt = now
        resets_at = oldest_dt + timedelta(minutes=settings.window_minutes)
    else:
        resets_at = now + timedelta(minutes=settings.window_minutes)

    return {
        "songs_remaining": remaining,
        "max_songs": settings.max_songs_per_window,
        "window_minutes": settings.window_minutes,
        "window_resets_at": resets_at.isoformat(),
        "recent_submissions": recent,
    }


async def check_duplicate(venue_id: int, youtube_id: str) -> bool:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT id FROM queue_songs WHERE venue_id = ? AND youtube_id = ? AND status IN ('pending', 'playing')",
        (venue_id, youtube_id),
    )
    return len(rows) > 0


async def check_duration_limit(venue_id: int, duration_sec: int) -> int:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT config FROM venues WHERE id = ?", (venue_id,)
    )
    max_duration = 600  # 10 minutes default
    if rows and rows[0][0]:
        try:
            config = json.loads(rows[0][0])
            max_duration = config.get("max_duration_sec", 600)
        except (json.JSONDecodeError, TypeError):
            pass
    return max_duration


async def add_song(venue_id: int, user_id: int, session_id: str,
                   youtube_id: str, title: str, thumbnail_url: str,
                   duration_sec: int) -> dict:
    db = await get_db()

    rows = await db.execute_fetchall(
        "SELECT COALESCE(MAX(position), 0) FROM queue_songs WHERE venue_id = ? AND status IN ('pending', 'playing')",
        (venue_id,),
    )
    next_position = rows[0][0] + 1

    cursor = await db.execute(
        "INSERT INTO queue_songs (venue_id, user_id, session_id, youtube_id, title, thumbnail_url, duration_sec, position, status) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
        (venue_id, user_id, session_id, youtube_id, title, thumbnail_url, duration_sec, next_position),
    )
    song_id = cursor.lastrowid

    await db.execute(
        "INSERT INTO submission_log (user_id, venue_id) VALUES (?, ?)",
        (user_id, venue_id),
    )
    await db.commit()

    # Calculate estimated wait
    wait_rows = await db.execute_fetchall(
        "SELECT COALESCE(SUM(duration_sec), 0) FROM queue_songs "
        "WHERE venue_id = ? AND status IN ('pending', 'playing') AND position < ?",
        (venue_id, next_position),
    )
    estimated_wait = wait_rows[0][0] if wait_rows else 0

    rate_info = await get_rate_limit_info(user_id, venue_id)

    return {
        "id": song_id,
        "youtube_id": youtube_id,
        "title": title,
        "position": next_position,
        "estimated_wait_sec": estimated_wait,
        "songs_remaining": rate_info["songs_remaining"],
        "window_resets_at": rate_info["window_resets_at"],
    }


async def get_queue(venue_id: int) -> dict:
    db = await get_db()

    # Get now playing
    now_playing = None
    rows = await db.execute_fetchall(
        "SELECT qs.id, qs.youtube_id, qs.title, qs.thumbnail_url, qs.duration_sec, "
        "qs.played_at, u.display_name, us.table_number "
        "FROM queue_songs qs "
        "JOIN users u ON qs.user_id = u.id "
        "JOIN user_sessions us ON qs.session_id = us.id "
        "WHERE qs.venue_id = ? AND qs.status = 'playing' "
        "ORDER BY qs.position ASC LIMIT 1",
        (venue_id,),
    )
    if rows:
        r = rows[0]
        now_playing = {
            "id": r[0], "youtube_id": r[1], "title": r[2],
            "thumbnail_url": r[3], "duration_sec": r[4],
            "playing_since": r[5],
            "added_by": r[6] or "Anonymous",
            "table_number": r[7],
        }

    # Get pending queue
    pending = await db.execute_fetchall(
        "SELECT qs.id, qs.position, qs.youtube_id, qs.title, qs.thumbnail_url, "
        "qs.duration_sec, u.display_name, us.table_number, qs.added_at "
        "FROM queue_songs qs "
        "JOIN users u ON qs.user_id = u.id "
        "JOIN user_sessions us ON qs.session_id = us.id "
        "WHERE qs.venue_id = ? AND qs.status = 'pending' "
        "ORDER BY qs.position ASC",
        (venue_id,),
    )

    cumulative_wait = 0
    if now_playing and now_playing["duration_sec"]:
        cumulative_wait = now_playing["duration_sec"]  # approximate remaining

    queue = []
    for r in pending:
        queue.append({
            "id": r[0], "position": r[1], "youtube_id": r[2],
            "title": r[3], "thumbnail_url": r[4], "duration_sec": r[5],
            "added_by": r[6] or "Anonymous", "table_number": r[7],
            "added_at": r[8], "estimated_wait_sec": cumulative_wait,
        })
        cumulative_wait += r[5] or 0

    # Check fallback
    venue_rows = await db.execute_fetchall(
        "SELECT fallback_mode, fallback_playlist FROM venues WHERE id = ?", (venue_id,)
    )
    fallback_active = now_playing is None and len(queue) == 0

    return {
        "now_playing": now_playing,
        "queue": queue,
        "total_in_queue": len(queue),
        "fallback_active": fallback_active,
    }


async def get_user_songs(user_id: int, venue_id: int) -> list:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT id, youtube_id, title, position, status, added_at "
        "FROM queue_songs WHERE user_id = ? AND venue_id = ? AND status IN ('pending', 'playing') "
        "ORDER BY position ASC",
        (user_id, venue_id),
    )
    return [
        {"id": r[0], "youtube_id": r[1], "title": r[2],
         "position": r[3], "status": r[4], "added_at": r[5]}
        for r in rows
    ]


async def get_recent_history(user_id: int, venue_id: int, hours: int = 2) -> list:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT qs.youtube_id, qs.title, qs.thumbnail_url, qs.status, qs.added_at "
        "FROM queue_songs qs "
        "WHERE qs.user_id = ? AND qs.venue_id = ? AND qs.added_at > datetime('now', ?) "
        "ORDER BY qs.added_at DESC",
        (user_id, venue_id, f"-{hours} hours"),
    )
    result = []
    for r in rows:
        added_at = r[4]
        minutes_ago = 0
        try:
            dt = datetime.fromisoformat(added_at)
            minutes_ago = int((datetime.now() - dt).total_seconds() / 60)
        except (ValueError, TypeError):
            pass
        result.append({
            "youtube_id": r[0], "title": r[1], "thumbnail_url": r[2],
            "status": r[3], "added_at": added_at, "minutes_ago": minutes_ago,
        })
    return result


async def check_recently_played_by_user(user_id: int, venue_id: int, youtube_id: str, hours: int = 2) -> tuple[bool, int | None]:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT added_at FROM queue_songs "
        "WHERE user_id = ? AND venue_id = ? AND youtube_id = ? AND added_at > datetime('now', ?) "
        "ORDER BY added_at DESC LIMIT 1",
        (user_id, venue_id, youtube_id, f"-{hours} hours"),
    )
    if not rows:
        return False, None
    try:
        dt = datetime.fromisoformat(rows[0][0])
        minutes_ago = int((datetime.now() - dt).total_seconds() / 60)
        return True, minutes_ago
    except (ValueError, TypeError):
        return True, None
