from fastapi import APIRouter, HTTPException, Query, Header

from app.models.schemas import PlaybackFinishedRequest, PlaybackErrorRequest
from app.services import playback_service, auth_service
from app.routers.websocket import manager
from app.database import get_db

router = APIRouter(prefix="/api/playback", tags=["playback"])


@router.get("/now-playing")
async def now_playing(venue: str = Query(...)):
    db = await get_db()
    rows = await db.execute_fetchall("SELECT id FROM venues WHERE slug = ?", (venue,))
    if not rows:
        raise HTTPException(status_code=404, detail="Bar no encontrado")

    venue_id = rows[0][0]
    return await playback_service.get_now_playing(venue_id)


@router.post("/finished")
async def finished(req: PlaybackFinishedRequest, authorization: str = Header(default="")):
    # Allow both authenticated admin and unauthenticated kiosk (for backward compat)
    venue_id = None

    # Try admin auth first
    if authorization.startswith("Bearer "):
        try:
            payload = auth_service.decode_token(authorization[7:])
            if payload.get("venue_id"):
                venue_id = payload["venue_id"]
        except Exception:
            pass

    # Fallback: look up by slug
    if venue_id is None:
        db = await get_db()
        rows = await db.execute_fetchall("SELECT id FROM venues WHERE slug = ?", (req.venue_slug,))
        if not rows:
            raise HTTPException(status_code=404, detail="Bar no encontrado")
        venue_id = rows[0][0]

    result = await playback_service.finish_song(req.song_id, venue_id)

    # Notify the user whose song just finished — their rate limit slot freed up
    if result.get("finished_user_id"):
        await manager.send_to_user(venue_id, result["finished_user_id"], {
            "event": "rate_limit_reset",
            "data": {"message": "Tu cancion termino, puedes pedir otra"},
        })

    if result["next_song"]:
        await manager.broadcast(venue_id, {
            "event": "now_playing_changed",
            "data": {"song": result["next_song"]},
        })
        if result["next_song"].get("user_id"):
            await manager.send_to_user(venue_id, result["next_song"]["user_id"], {
                "event": "your_song_playing",
                "data": {
                    "song": result["next_song"],
                    "message": "Tu cancion esta sonando ahora",
                },
            })
    else:
        from app.services.playlist_service import get_active_fallback_songs
        fallback_songs = await get_active_fallback_songs(venue_id)
        await manager.broadcast(venue_id, {
            "event": "now_playing_changed",
            "data": {"song": None, "fallback_active": True, "fallback_songs": fallback_songs},
        })

    return result


@router.post("/error")
async def playback_error(req: PlaybackErrorRequest, authorization: str = Header(default="")):
    """Handle YouTube player errors (blocked/removed videos).

    This endpoint MUST NOT return 500 — the Kiosk depends on a 200 to stop
    retrying, and the user needs a WebSocket notification regardless of DB state.
    """
    import logging
    log = logging.getLogger(__name__)

    # --- Resolve venue_id ---
    venue_id = None
    if authorization.startswith("Bearer "):
        try:
            payload = auth_service.decode_token(authorization[7:])
            if payload.get("venue_id"):
                venue_id = payload["venue_id"]
        except Exception:
            pass

    if venue_id is None:
        try:
            db = await get_db()
            rows = await db.execute_fetchall("SELECT id FROM venues WHERE slug = ?", (req.venue_slug,))
            if rows:
                venue_id = rows[0][0]
        except Exception:
            pass

    if venue_id is None:
        # Can't resolve venue — return 200 so Kiosk stops retrying
        return {"next_song": None, "fallback_active": True, "finished_user_id": None}

    # --- Read song info (best-effort) ---
    finished_user_id = None
    error_youtube_id = None
    error_title = ""
    try:
        db = await get_db()
        song_rows = await db.execute_fetchall(
            "SELECT user_id, youtube_id, title FROM queue_songs WHERE id = ?",
            (req.song_id,),
        )
        if song_rows:
            finished_user_id = song_rows[0][0]
            error_youtube_id = song_rows[0][1]
            error_title = song_rows[0][2]
    except Exception as e:
        log.warning(f"playback_error: could not read song {req.song_id}: {e}")

    # --- Try DB writes (mark played, advance queue, save blocked video) ---
    result = {"next_song": None, "fallback_active": True}
    try:
        result = await playback_service.error_song(req.song_id, venue_id, req.error_code)
        # Use values from error_song if available
        finished_user_id = result.get("finished_user_id") or finished_user_id
        error_title = result.get("error_title") or error_title
        error_youtube_id = result.get("error_youtube_id") or error_youtube_id
    except Exception as e:
        log.warning(f"playback_error: error_song failed for {req.song_id}: {e}")

    # --- Always notify (even if DB writes failed) ---
    try:
        await manager.broadcast(venue_id, {
            "event": "song_error",
            "data": {
                "song_id": req.song_id,
                "error_code": req.error_code,
                "title": error_title,
                "message": f"Video error (code {req.error_code})",
            },
        })
    except Exception:
        pass

    if finished_user_id:
        try:
            await manager.send_to_user(venue_id, finished_user_id, {
                "event": "song_error_notification",
                "data": {
                    "title": error_title,
                    "youtube_id": error_youtube_id or "",
                    "error_code": req.error_code,
                    "message": f"\"{error_title or 'tu cancion'}\" no pudo ser reproducida por restricciones del video. Busca otra version o cancion diferente.",
                },
            })
            await manager.send_to_user(venue_id, finished_user_id, {
                "event": "rate_limit_reset",
                "data": {"message": "Slot liberado por error de video"},
            })
        except Exception:
            pass

    if result.get("next_song"):
        try:
            await manager.broadcast(venue_id, {
                "event": "now_playing_changed",
                "data": {"song": result["next_song"]},
            })
            if result["next_song"].get("user_id"):
                await manager.send_to_user(venue_id, result["next_song"]["user_id"], {
                    "event": "your_song_playing",
                    "data": {
                        "song": result["next_song"],
                        "message": "Tu cancion esta sonando ahora",
                    },
                })
        except Exception:
            pass
    else:
        try:
            from app.services.playlist_service import get_active_fallback_songs
            fallback_songs = await get_active_fallback_songs(venue_id)
            await manager.broadcast(venue_id, {
                "event": "now_playing_changed",
                "data": {"song": None, "fallback_active": True, "fallback_songs": fallback_songs},
            })
        except Exception:
            pass

    return result
