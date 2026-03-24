from fastapi import APIRouter, HTTPException, Depends, Query

from app.models.schemas import SongSubmitRequest, SongConfirmRequest
from app.routers.auth import get_current_user
from app.services import queue_service, youtube_service
from app.routers.websocket import manager

router = APIRouter(prefix="/api/queue", tags=["queue"])


@router.get("")
async def get_queue(venue: str = Query(...)):
    from app.database import get_db
    db = await get_db()
    rows = await db.execute_fetchall("SELECT id FROM venues WHERE slug = ?", (venue,))
    if not rows:
        raise HTTPException(status_code=404, detail="Bar no encontrado")
    venue_id = rows[0][0]
    return await queue_service.get_queue(venue_id)


@router.post("/songs")
async def submit_song(req: SongSubmitRequest, user: dict = Depends(get_current_user)):
    video_id = youtube_service.extract_video_id(req.youtube_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="URL de YouTube invalida",
                            headers={"X-Error-Code": "INVALID_URL"})

    venue_id = user["venue_id"]
    user_id = user["user_id"]

    # Check rate limit
    rate_info = await queue_service.get_rate_limit_info(user_id, venue_id)
    if rate_info["songs_remaining"] <= 0:
        raise HTTPException(status_code=429, detail="Ya usaste tus canciones, espera un momento",
                            headers={"X-Error-Code": "RATE_LIMIT_EXCEEDED"})

    # Check duplicate
    if await queue_service.check_duplicate(venue_id, video_id):
        raise HTTPException(status_code=409, detail="Esta cancion ya esta en la cola",
                            headers={"X-Error-Code": "ALREADY_IN_QUEUE"})

    # Fetch metadata
    metadata = await youtube_service.fetch_video_metadata(video_id)
    if not metadata:
        raise HTTPException(status_code=400, detail="Video no encontrado o no disponible",
                            headers={"X-Error-Code": "VIDEO_NOT_FOUND"})

    if metadata.get("embeddable") is False:
        raise HTTPException(status_code=400, detail="Este video no permite ser reproducido",
                            headers={"X-Error-Code": "VIDEO_NOT_EMBEDDABLE"})

    # Check duration limit
    max_duration = await queue_service.check_duration_limit(venue_id, metadata["duration_sec"])
    if metadata["duration_sec"] > max_duration:
        raise HTTPException(
            status_code=400,
            detail=f"La cancion supera el limite de {max_duration // 60} minutos",
            headers={"X-Error-Code": "DURATION_EXCEEDED"},
        )

    # Save metadata
    await youtube_service.save_metadata(video_id, metadata)

    # Check recently played by user
    recently, minutes_ago = await queue_service.check_recently_played_by_user(
        user_id, venue_id, video_id
    )

    return {
        "youtube_id": video_id,
        "title": metadata["title"],
        "thumbnail_url": metadata["thumbnail_url"],
        "duration_sec": metadata["duration_sec"],
        "duration_formatted": youtube_service.format_duration(metadata["duration_sec"]),
        "valid": True,
        "recently_played_by_user": recently,
        "recently_played_minutes_ago": minutes_ago,
    }


@router.post("/songs/confirm", status_code=201)
async def confirm_song(req: SongConfirmRequest, user: dict = Depends(get_current_user)):
    venue_id = user["venue_id"]
    user_id = user["user_id"]
    session_id = user["session_id"]

    # Re-check rate limit
    rate_info = await queue_service.get_rate_limit_info(user_id, venue_id)
    if rate_info["songs_remaining"] <= 0:
        raise HTTPException(status_code=429, detail="Ya usaste tus canciones, espera un momento",
                            headers={"X-Error-Code": "RATE_LIMIT_EXCEEDED"})

    # Re-check duplicate
    if await queue_service.check_duplicate(venue_id, req.youtube_id):
        raise HTTPException(status_code=409, detail="Esta cancion ya esta en la cola",
                            headers={"X-Error-Code": "ALREADY_IN_QUEUE"})

    # Get metadata from cache
    from app.database import get_db
    db = await get_db()
    meta_rows = await db.execute_fetchall(
        "SELECT title, duration_sec FROM song_metadata WHERE youtube_id = ?",
        (req.youtube_id,),
    )
    if not meta_rows:
        raise HTTPException(status_code=400, detail="Primero envia la cancion para validarla")

    title = meta_rows[0][0]
    duration_sec = meta_rows[0][1]
    thumbnail_url = f"https://i.ytimg.com/vi/{req.youtube_id}/mqdefault.jpg"

    result = await queue_service.add_song(
        venue_id=venue_id,
        user_id=user_id,
        session_id=session_id,
        youtube_id=req.youtube_id,
        title=title,
        thumbnail_url=thumbnail_url,
        duration_sec=duration_sec,
    )

    # Broadcast to all clients
    await manager.broadcast(venue_id, {
        "event": "song_added",
        "data": {
            "id": result["id"],
            "youtube_id": req.youtube_id,
            "title": title,
            "position": result["position"],
            "added_by": user.get("phone", "Anonymous"),
        },
    })

    # If this is the first song and nothing is playing, start it
    playing = await db.execute_fetchall(
        "SELECT id FROM queue_songs WHERE venue_id = ? AND status = 'playing'",
        (venue_id,),
    )
    if not playing:
        await db.execute(
            "UPDATE queue_songs SET status = 'playing', played_at = CURRENT_TIMESTAMP WHERE id = ?",
            (result["id"],),
        )
        await db.commit()
        await manager.broadcast(venue_id, {
            "event": "now_playing_changed",
            "data": {"song": {"id": result["id"], "youtube_id": req.youtube_id, "title": title}},
        })
        await manager.send_to_user(venue_id, user_id, {
            "event": "your_song_playing",
            "data": {
                "song": {"id": result["id"], "youtube_id": req.youtube_id, "title": title},
                "message": "Tu cancion esta sonando ahora",
            },
        })

    return result


@router.get("/my-songs")
async def get_my_songs(user: dict = Depends(get_current_user)):
    songs = await queue_service.get_user_songs(user["user_id"], user["venue_id"])
    rate_info = await queue_service.get_rate_limit_info(user["user_id"], user["venue_id"])
    return {
        "songs": songs,
        "rate_limit": {
            "songs_remaining": rate_info["songs_remaining"],
            "window_resets_at": rate_info["window_resets_at"],
        },
    }


@router.get("/recent-history")
async def get_recent_history(user: dict = Depends(get_current_user)):
    songs = await queue_service.get_recent_history(user["user_id"], user["venue_id"])
    return {"recent_songs": songs, "window_hours": 2}


@router.get("/remaining-slots")
async def get_remaining_slots(user: dict = Depends(get_current_user)):
    return await queue_service.get_rate_limit_info(user["user_id"], user["venue_id"])


@router.delete("/my-songs/{song_id}")
async def cancel_my_song(song_id: int, user: dict = Depends(get_current_user)):
    """User cancels their own pending song."""
    from app.database import get_db
    db = await get_db()

    # Verify the song belongs to this user and is pending
    rows = await db.execute_fetchall(
        "SELECT id FROM queue_songs WHERE id = ? AND user_id = ? AND venue_id = ? AND status = 'pending'",
        (song_id, user["user_id"], user["venue_id"]),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Cancion no encontrada o no se puede cancelar")

    await db.execute(
        "UPDATE queue_songs SET status = 'removed' WHERE id = ?",
        (song_id,),
    )
    await db.commit()

    await manager.broadcast(user["venue_id"], {
        "event": "song_removed",
        "data": {"id": song_id, "removed_by": "user"},
    })

    return {"message": "Song cancelled", "song_id": song_id}
