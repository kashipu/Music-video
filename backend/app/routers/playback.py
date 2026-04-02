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
    """Handle YouTube player errors (blocked/removed videos)."""
    venue_id = None

    if authorization.startswith("Bearer "):
        try:
            payload = auth_service.decode_token(authorization[7:])
            if payload.get("venue_id"):
                venue_id = payload["venue_id"]
        except Exception:
            pass

    if venue_id is None:
        db = await get_db()
        rows = await db.execute_fetchall("SELECT id FROM venues WHERE slug = ?", (req.venue_slug,))
        if not rows:
            raise HTTPException(status_code=404, detail="Bar no encontrado")
        venue_id = rows[0][0]

    result = await playback_service.error_song(req.song_id, venue_id, req.error_code)

    # Notify admin about the error
    await manager.broadcast(venue_id, {
        "event": "song_error",
        "data": {
            "song_id": req.song_id,
            "error_code": req.error_code,
            "title": result.get("error_title", ""),
            "message": f"Video error (code {req.error_code})",
        },
    })

    # Notify the user whose song errored
    if result.get("finished_user_id"):
        await manager.send_to_user(venue_id, result["finished_user_id"], {
            "event": "song_error_notification",
            "data": {
                "title": result.get("error_title", ""),
                "message": f"No pudimos reproducir \"{result.get('error_title', 'tu cancion')}\" porque el video no esta disponible. Puedes pedir otra.",
            },
        })
        await manager.send_to_user(venue_id, result["finished_user_id"], {
            "event": "rate_limit_reset",
            "data": {"message": "Slot liberado por error de video"},
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
