import asyncio
import json
from typing import Optional

from app.database import get_db

# In-memory: which fallback song is currently playing per venue (cleared when a real song starts)
_fallback_now_playing: dict = {}

# Serializes mutations of queue_songs.status (skip / finish / error). Without this,
# concurrent admin double-clicks or admin-skip + kiosk-finished arriving in the same
# tick can both read 'playing' and both advance the queue, ending with two songs in
# 'playing' state or a song silently lost. Pairs with the lock in queue_service.py.
_playback_lock = asyncio.Lock()


def set_fallback_now_playing(venue_id: int, song: Optional[dict]) -> None:
    _fallback_now_playing[venue_id] = song


def get_fallback_now_playing(venue_id: int) -> Optional[dict]:
    return _fallback_now_playing.get(venue_id)


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
    """Atomic finish: serialized with skip/error so the kiosk's 'song ended' and
    an admin click on Siguiente at the same instant cannot both advance the queue
    and skip a user song silently.
    """
    db = await get_db()

    async with _playback_lock:
        # Idempotency: only mark as played if it's still 'playing'. If admin already
        # skipped it, this is a no-op and we still advance to whatever is current.
        rows = await db.execute_fetchall(
            "SELECT venue_id, user_id, youtube_id, title, duration_sec, status FROM queue_songs WHERE id = ?",
            (song_id,),
        )
        finished_user_id = None
        already_finalized = False
        if rows:
            r = rows[0]
            finished_user_id = r[1]
            already_finalized = r[5] != 'playing'
            if not already_finalized:
                await db.execute(
                    "UPDATE queue_songs SET status = 'played', played_at = CURRENT_TIMESTAMP "
                    "WHERE id = ? AND venue_id = ? AND status = 'playing'",
                    (song_id, venue_id),
                )
                await db.execute(
                    "INSERT INTO play_history (venue_id, user_id, youtube_id, title, duration_sec) VALUES (?, ?, ?, ?, ?)",
                    (r[0], r[1], r[2], r[3], r[4]),
                )

        # Free the rate limit slot only if we actually finalized the song here
        if finished_user_id and not already_finalized:
            await db.execute(
                "DELETE FROM submission_log WHERE id = ("
                "  SELECT id FROM submission_log "
                "  WHERE user_id = ? AND venue_id = ? "
                "  ORDER BY submitted_at DESC LIMIT 1"
                ")",
                (finished_user_id, venue_id),
            )

        # Advance to next song. If already_finalized, _advance_queue is still safe:
        # it only promotes a 'pending' song if nothing is currently 'playing'.
        next_song = await _advance_queue_safe(venue_id)
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


async def _advance_queue(venue_id: int) -> Optional[dict]:
    """Promote the next pending song to 'playing'. Caller must hold _playback_lock."""
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
    # Conditional UPDATE: prevents a race promoting two songs to 'playing'.
    await db.execute(
        "UPDATE queue_songs SET status = 'playing', played_at = CURRENT_TIMESTAMP "
        "WHERE id = ? AND status = 'pending'",
        (r[0],),
    )

    # Real song starting — clear any cached fallback now-playing for this venue
    set_fallback_now_playing(venue_id, None)

    return {"id": r[0], "youtube_id": r[1], "title": r[2], "user_id": r[3]}


async def _advance_queue_safe(venue_id: int) -> Optional[dict]:
    """Advance only if nothing is currently playing. Returns the now-playing song
    (or None if there's nothing pending). Used by finish_song so a finish that
    arrives after a skip (which already advanced) doesn't double-promote."""
    db = await get_db()
    playing = await db.execute_fetchall(
        "SELECT id, youtube_id, title, user_id FROM queue_songs "
        "WHERE venue_id = ? AND status = 'playing' LIMIT 1",
        (venue_id,),
    )
    if playing:
        r = playing[0]
        return {"id": r[0], "youtube_id": r[1], "title": r[2], "user_id": r[3]}
    return await _advance_queue(venue_id)

    return {"id": r[0], "youtube_id": r[1], "title": r[2], "user_id": r[3]}


async def skip_song(venue_id: int) -> dict:
    """Atomic skip: marks current playing song as 'played' and advances queue.

    Idempotent: if no song is playing (e.g. another concurrent skip already advanced
    or we are in fallback), returns cleanly without phantom 'played' writes.
    """
    db = await get_db()

    async with _playback_lock:
        # Re-check current playing INSIDE the lock — a sibling call may have just
        # advanced the queue between our handler entry and the lock acquisition.
        current = await db.execute_fetchall(
            "SELECT id, title, user_id FROM queue_songs WHERE venue_id = ? AND status = 'playing' LIMIT 1",
            (venue_id,),
        )
        skipped = None
        if current:
            skipped = {"id": current[0][0], "title": current[0][1], "user_id": current[0][2]}
            # Conditional UPDATE: only flip if still 'playing'. Guards against a
            # double execute path where another coroutine already set 'played'.
            await db.execute(
                "UPDATE queue_songs SET status = 'played', played_at = CURRENT_TIMESTAMP "
                "WHERE id = ? AND status = 'playing'",
                (current[0][0],),
            )

        next_song = await _advance_queue(venue_id)
        await _commit_with_retry(db)

    # Log skip event (outside the lock — analytics shouldn't block playback)
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

    async with _playback_lock:
        # Get song info; only finalize if it's still in a non-terminal state
        rows = await db.execute_fetchall(
            "SELECT venue_id, user_id, youtube_id, title, duration_sec, status FROM queue_songs WHERE id = ?",
            (song_id,),
        )
        finished_user_id = None
        error_title = ""
        already_finalized = True
        if rows:
            finished_user_id = rows[0][1]
            error_title = rows[0][3]
            already_finalized = rows[0][5] in ('played', 'removed')

        if not already_finalized:
            await db.execute(
                "UPDATE queue_songs SET status = 'played', played_at = CURRENT_TIMESTAMP "
                "WHERE id = ? AND venue_id = ? AND status IN ('playing', 'pending')",
                (song_id, venue_id),
            )
            # Free the rate limit slot only when we actually finalized
            if finished_user_id:
                await db.execute(
                    "DELETE FROM submission_log WHERE id = ("
                    "  SELECT id FROM submission_log "
                    "  WHERE user_id = ? AND venue_id = ? "
                    "  ORDER BY submitted_at DESC LIMIT 1"
                    ")",
                    (finished_user_id, venue_id),
                )

        next_song = await _advance_queue_safe(venue_id)
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
