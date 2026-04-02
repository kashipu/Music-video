import asyncio
import json

from app.database import get_db


async def _commit_with_retry(db, retries: int = 3, delay: float = 0.3):
    """Commit with retries to handle transient 'database is locked' errors."""
    for attempt in range(retries):
        try:
            await db.commit()
            return
        except Exception as e:
            if "locked" in str(e) and attempt < retries - 1:
                await asyncio.sleep(delay * (attempt + 1))
            else:
                raise


async def get_now_playing(venue_id: int) -> dict:
    db = await get_db()

    rows = await db.execute_fetchall(
        "SELECT qs.id, qs.youtube_id, qs.title, qs.duration_sec, qs.user_id "
        "FROM queue_songs qs "
        "WHERE qs.venue_id = ? AND qs.status = 'playing' "
        "ORDER BY qs.position ASC LIMIT 1",
        (venue_id,),
    )

    song = None
    if rows:
        r = rows[0]
        song = {"id": r[0], "youtube_id": r[1], "title": r[2], "duration_sec": r[3]}

    # Next in queue
    next_rows = await db.execute_fetchall(
        "SELECT qs.title, u.display_name "
        "FROM queue_songs qs JOIN users u ON qs.user_id = u.id "
        "WHERE qs.venue_id = ? AND qs.status = 'pending' "
        "ORDER BY qs.position ASC LIMIT 1",
        (venue_id,),
    )
    next_song = None
    if next_rows:
        next_song = {"title": next_rows[0][0], "added_by": next_rows[0][1] or "Anonymous"}

    # Check playback status
    venue_rows = await db.execute_fetchall(
        "SELECT config, name, logo_url FROM venues WHERE id = ?", (venue_id,)
    )
    playback_status = "playing"
    volume = 80
    banner_text = ""
    show_brand = True
    show_qr = False
    fallback_active = song is None
    fallback_mode = "playlist"
    fallback_playlist = []

    if venue_rows and venue_rows[0][0]:
        try:
            config = json.loads(venue_rows[0][0])
            playback_status = config.get("playback_status", "playing")
            volume = config.get("volume", 80)
            banner_text = config.get("banner_text", "")
            show_brand = config.get("show_brand", True)
            show_qr = config.get("show_qr", False)
        except (json.JSONDecodeError, TypeError):
            pass

    if fallback_active:
        from app.services.playlist_service import get_active_fallback_songs
        fallback_playlist = await get_active_fallback_songs(venue_id)

    venue_name = venue_rows[0][1] if venue_rows else ""
    venue_logo = venue_rows[0][2] if venue_rows else None

    result = {
        "song": song,
        "playback_status": playback_status,
        "volume": volume,
        "banner_text": banner_text,
        "show_brand": show_brand,
        "show_qr": show_qr,
        "venue_name": venue_name,
        "venue_logo": venue_logo,
        "fallback_active": fallback_active,
        "next_in_queue": next_song,
    }
    if fallback_active:
        result["fallback_songs"] = fallback_playlist

    return result


async def finish_song(song_id: int, venue_id: int) -> dict:
    db = await get_db()

    # Mark as played
    await db.execute(
        "UPDATE queue_songs SET status = 'played', played_at = CURRENT_TIMESTAMP "
        "WHERE id = ? AND venue_id = ?",
        (song_id, venue_id),
    )

    # Copy to play_history and get finished song's user_id
    finished_user_id = None
    rows = await db.execute_fetchall(
        "SELECT venue_id, user_id, youtube_id, title, duration_sec FROM queue_songs WHERE id = ?",
        (song_id,),
    )
    if rows:
        r = rows[0]
        finished_user_id = r[1]
        await db.execute(
            "INSERT INTO play_history (venue_id, user_id, youtube_id, title, duration_sec) VALUES (?, ?, ?, ?, ?)",
            (r[0], r[1], r[2], r[3], r[4]),
        )

    # Advance to next song
    next_song = await _advance_queue(venue_id)
    await _commit_with_retry(db)

    # Log analytics events
    try:
        from app.services.analytics_service import log_event
        if rows:
            await log_event(venue_id, "song_played", {"youtube_id": rows[0][2], "title": rows[0][3]}, finished_user_id)
        if next_song is None:
            await log_event(venue_id, "fallback_activated")
    except Exception:
        pass

    return {
        "next_song": next_song,
        "fallback_active": next_song is None,
        "finished_user_id": finished_user_id,
    }


async def _advance_queue(venue_id: int) -> dict | None:
    db = await get_db()

    rows = await db.execute_fetchall(
        "SELECT id, youtube_id, title, user_id FROM queue_songs "
        "WHERE venue_id = ? AND status = 'pending' "
        "ORDER BY position ASC LIMIT 1",
        (venue_id,),
    )
    if not rows:
        return None

    r = rows[0]
    await db.execute(
        "UPDATE queue_songs SET status = 'playing', played_at = CURRENT_TIMESTAMP WHERE id = ?",
        (r[0],),
    )

    return {"id": r[0], "youtube_id": r[1], "title": r[2], "user_id": r[3]}


async def skip_song(venue_id: int) -> dict:
    db = await get_db()

    # Get current playing song
    current = await db.execute_fetchall(
        "SELECT id, title, user_id FROM queue_songs WHERE venue_id = ? AND status = 'playing' LIMIT 1",
        (venue_id,),
    )
    skipped = None
    if current:
        skipped = {"id": current[0][0], "title": current[0][1], "user_id": current[0][2]}
        await db.execute(
            "UPDATE queue_songs SET status = 'played', played_at = CURRENT_TIMESTAMP WHERE id = ?",
            (current[0][0],),
        )

    next_song = await _advance_queue(venue_id)
    await _commit_with_retry(db)

    # Log skip event
    try:
        from app.services.analytics_service import log_event
        if skipped:
            await log_event(venue_id, "song_skipped", {"title": skipped["title"]}, skipped.get("user_id"))
    except Exception:
        pass

    return {
        "skipped": skipped,
        "now_playing": next_song,
    }


async def error_song(song_id: int, venue_id: int, error_code: int) -> dict:
    db = await get_db()

    # Get song info before marking as error
    rows = await db.execute_fetchall(
        "SELECT venue_id, user_id, youtube_id, title, duration_sec FROM queue_songs WHERE id = ?",
        (song_id,),
    )
    finished_user_id = None
    error_title = ""
    if rows:
        finished_user_id = rows[0][1]
        error_title = rows[0][3]

    # Mark as played (error songs count as played)
    await db.execute(
        "UPDATE queue_songs SET status = 'played', played_at = CURRENT_TIMESTAMP "
        "WHERE id = ? AND venue_id = ?",
        (song_id, venue_id),
    )

    # Free the rate limit slot — delete the most recent submission_log entry
    # so the user can request another song
    if finished_user_id:
        await db.execute(
            "DELETE FROM submission_log WHERE id = ("
            "  SELECT id FROM submission_log "
            "  WHERE user_id = ? AND venue_id = ? "
            "  ORDER BY submitted_at DESC LIMIT 1"
            ")",
            (finished_user_id, venue_id),
        )

    next_song = await _advance_queue(venue_id)
    await _commit_with_retry(db)

    # Save to blocked_videos so it's filtered from future searches
    error_youtube_id = rows[0][2] if rows else None
    if error_youtube_id:
        try:
            await db.execute(
                "INSERT OR IGNORE INTO blocked_videos (youtube_id, venue_id, error_code, title) "
                "VALUES (?, ?, ?, ?)",
                (error_youtube_id, venue_id, error_code, error_title),
            )
            await _commit_with_retry(db)
        except Exception:
            pass

    # Log error event
    try:
        from app.services.analytics_service import log_event
        await log_event(venue_id, "song_error", {"error_code": error_code, "title": error_title}, finished_user_id)
    except Exception:
        pass

    return {
        "next_song": next_song,
        "fallback_active": next_song is None,
        "finished_user_id": finished_user_id,
        "error_title": error_title,
        "error_youtube_id": error_youtube_id,
    }


async def set_playback_status(venue_id: int, status: str) -> None:
    db = await get_db()
    rows = await db.execute_fetchall("SELECT config FROM venues WHERE id = ?", (venue_id,))
    config = {}
    if rows and rows[0][0]:
        try:
            config = json.loads(rows[0][0])
        except (json.JSONDecodeError, TypeError):
            pass
    config["playback_status"] = status
    await db.execute(
        "UPDATE venues SET config = ? WHERE id = ?",
        (json.dumps(config), venue_id),
    )
    await _commit_with_retry(db)


async def remove_song(song_id: int, venue_id: int) -> None:
    db = await get_db()
    await db.execute(
        "UPDATE queue_songs SET status = 'removed' WHERE id = ? AND venue_id = ?",
        (song_id, venue_id),
    )
    await _commit_with_retry(db)


async def reorder_song(song_id: int, venue_id: int, new_position: int) -> None:
    db = await get_db()

    # Get current position
    rows = await db.execute_fetchall(
        "SELECT position FROM queue_songs WHERE id = ? AND venue_id = ? AND status = 'pending'",
        (song_id, venue_id),
    )
    if not rows:
        return

    old_position = rows[0][0]

    if new_position > old_position:
        await db.execute(
            "UPDATE queue_songs SET position = position - 1 "
            "WHERE venue_id = ? AND status = 'pending' AND position > ? AND position <= ?",
            (venue_id, old_position, new_position),
        )
    elif new_position < old_position:
        await db.execute(
            "UPDATE queue_songs SET position = position + 1 "
            "WHERE venue_id = ? AND status = 'pending' AND position >= ? AND position < ?",
            (venue_id, new_position, old_position),
        )

    await db.execute(
        "UPDATE queue_songs SET position = ? WHERE id = ?",
        (new_position, song_id),
    )
    await _commit_with_retry(db)
