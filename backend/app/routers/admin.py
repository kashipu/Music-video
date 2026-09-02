from typing import Literal

from fastapi import APIRouter, HTTPException, Depends, Header, Query
from pydantic import BaseModel, Field

from app.models.schemas import AdminSongAddRequest, AdminReorderRequest
from app.services import auth_service, playback_service, analytics_service, youtube_service, queue_service
from app.routers.websocket import manager
from app.database import get_db

router = APIRouter(prefix="/api/admin", tags=["admin"])


class OnboardingRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=7, max_length=30)
    role: Literal["owner", "manager"]
    city: str = Field(min_length=2, max_length=100)
    country: str = Field(min_length=2, max_length=100)
    venue_name: str = Field(min_length=2, max_length=100)
    venue_address: str = Field(min_length=3, max_length=255)
    venue_type: Literal["discoteca", "rock", "musica_popular", "otro"]
    venue_type_other: str | None = Field(default=None, max_length=100)


async def get_current_admin(authorization: str | None = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesion invalida")
    token = authorization[7:]
    try:
        payload = auth_service.decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Sesion expirada, vuelve a iniciar")
    if not payload.get("is_admin"):
        raise HTTPException(status_code=403, detail="Acceso de administrador requerido")
    return payload


@router.post("/onboarding")
async def complete_onboarding(req: OnboardingRequest, admin: dict = Depends(get_current_admin)):
    venue_type_other = (req.venue_type_other or "").strip()
    if req.venue_type == "otro" and not venue_type_other:
        raise HTTPException(status_code=422, detail="Describe la tematica del local")

    db = await get_db()
    await db.execute(
        "UPDATE admins SET full_name = ?, phone = ?, role = ?, city = ?, country = ?, onboarding_completed_at = CURRENT_TIMESTAMP "
        "WHERE id = ? AND venue_id = ?",
        (req.full_name.strip(), req.phone.strip(), req.role, req.city.strip(), req.country.strip(),
         admin["admin_id"], admin["venue_id"]),
    )
    await db.execute(
        "UPDATE venues SET name = ?, address = ?, venue_type = ?, venue_type_other = ? WHERE id = ?",
        (req.venue_name.strip(), req.venue_address.strip(), req.venue_type, venue_type_other or None, admin["venue_id"]),
    )
    await db.commit()
    return {"message": "Onboarding completado"}


@router.get("/queue")
async def get_admin_queue(admin: dict = Depends(get_current_admin)):
    venue_id = admin["venue_id"]
    db = await get_db()

    # Now playing
    now_rows = await db.execute_fetchall(
        "SELECT qs.id, qs.youtube_id, qs.title, u.phone, u.display_name, "
        "us.table_number, qs.added_at, qs.played_at "
        "FROM queue_songs qs "
        "JOIN users u ON qs.user_id = u.id "
        "JOIN user_sessions us ON qs.session_id = us.id "
        "WHERE qs.venue_id = ? AND qs.status = 'playing' LIMIT 1",
        (venue_id,),
    )
    now_playing = None
    if now_rows:
        r = now_rows[0]
        now_playing = {
            "id": r[0], "youtube_id": r[1], "title": r[2],
            "user_phone": r[3], "user_name": r[4] or "Anonymous",
            "table_number": r[5], "added_at": r[6], "playing_since": r[7],
        }

    # Queue
    queue_rows = await db.execute_fetchall(
        "SELECT qs.id, qs.position, qs.youtube_id, qs.title, u.phone, u.display_name, "
        "us.table_number, qs.added_at, qs.duration_sec "
        "FROM queue_songs qs "
        "JOIN users u ON qs.user_id = u.id "
        "JOIN user_sessions us ON qs.session_id = us.id "
        "WHERE qs.venue_id = ? AND qs.status = 'pending' ORDER BY qs.position ASC",
        (venue_id,),
    )
    queue = [{
        "id": r[0], "position": r[1], "youtube_id": r[2], "title": r[3],
        "user_phone": r[4], "user_name": r[5] or "Anonymous",
        "table_number": r[6], "added_at": r[7], "duration_sec": r[8],
    } for r in queue_rows]

    import json
    config_rows = await db.execute_fetchall("SELECT config FROM venues WHERE id = ?", (venue_id,))
    playback_status = "playing"
    if config_rows and config_rows[0][0]:
        try:
            config = json.loads(config_rows[0][0])
            playback_status = config.get("playback_status", "playing")
        except (json.JSONDecodeError, TypeError):
            pass

    fallback_now_playing = None
    if now_playing is None:
        cached = playback_service.get_fallback_now_playing(venue_id)
        if cached:
            fallback_now_playing = {**cached, "is_fallback": True}

    return {
        "now_playing": now_playing,
        "fallback_now_playing": fallback_now_playing,
        "queue": queue,
        "total_in_queue": len(queue),
        "playback_status": playback_status,
    }


@router.get("/played")
async def get_played(admin: dict = Depends(get_current_admin)):
    """Get songs that already played today."""
    venue_id = admin["venue_id"]
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT qs.id, qs.youtube_id, qs.title, u.display_name, us.table_number, qs.played_at "
        "FROM queue_songs qs "
        "JOIN users u ON qs.user_id = u.id "
        "JOIN user_sessions us ON qs.session_id = us.id "
        "WHERE qs.venue_id = ? AND qs.status = 'played' "
        "AND qs.played_at > datetime('now', '-24 hours') "
        "ORDER BY qs.played_at DESC",
        (venue_id,),
    )
    from app.utils import to_colombia_12h
    songs = []
    for r in rows:
        songs.append({
            "id": r[0], "youtube_id": r[1], "title": r[2],
            "user_name": r[3] or "Admin", "table_number": r[4],
            "played_at_label": to_colombia_12h(r[5]),
        })
    return {"songs": songs}


@router.delete("/queue/songs/{song_id}")
async def remove_song(song_id: int, admin: dict = Depends(get_current_admin)):
    venue_id = admin["venue_id"]
    await playback_service.remove_song(song_id, venue_id)
    await manager.broadcast(venue_id, {
        "event": "song_removed",
        "data": {"id": song_id, "removed_by": "admin"},
    })
    try:
        from app.services.analytics_service import log_event
        await log_event(venue_id, "song_removed", {"song_id": song_id})
    except Exception:
        pass
    return {"message": "Song removed", "song_id": song_id}


@router.post("/queue/songs/{song_id}/play-now")
async def play_now(song_id: int, admin: dict = Depends(get_current_admin)):
    """Skip current song and play this one immediately."""
    venue_id = admin["venue_id"]

    result = await playback_service.play_specific_song(venue_id, song_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Cancion no encontrada")

    song = result["song"]
    now_playing = {"id": song["id"], "youtube_id": song["youtube_id"], "title": song["title"]}

    # Notify previous song's owner
    if result["previous_user_id"]:
        await manager.send_to_user(venue_id, result["previous_user_id"], {
            "event": "rate_limit_reset",
            "data": {"message": "Tu cancion termino"},
        })

    await manager.broadcast(venue_id, {
        "event": "now_playing_changed",
        "data": {"song": now_playing},
    })
    if song["user_id"]:
        await manager.send_to_user(venue_id, song["user_id"], {
            "event": "your_song_playing",
            "data": {"song": now_playing, "message": "Tu cancion esta sonando ahora"},
        })
    if result["was_fallback"]:
        # Kiosk stored it as pendingUserSong — trigger immediate switch
        await manager.broadcast(venue_id, {"event": "fallback_skip", "data": {}})

    return {"message": "Playing now", "now_playing": now_playing}


@router.patch("/queue/songs/{song_id}")
async def reorder_song(song_id: int, req: AdminReorderRequest,
                       admin: dict = Depends(get_current_admin)):
    venue_id = admin["venue_id"]
    await playback_service.reorder_song(song_id, venue_id, req.position)

    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT id, position FROM queue_songs WHERE venue_id = ? AND status = 'pending' ORDER BY position",
        (venue_id,),
    )
    queue_order = [{"id": r[0], "position": r[1]} for r in rows]
    await manager.broadcast(venue_id, {
        "event": "queue_reordered",
        "data": {"queue": queue_order},
    })

    return {"message": "Song reordered", "song_id": song_id, "new_position": req.position}


@router.post("/queue/songs")
async def admin_add_song(req: AdminSongAddRequest, admin: dict = Depends(get_current_admin)):
    video_id = youtube_service.extract_video_id(req.youtube_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="URL de YouTube invalida")

    metadata = await youtube_service.fetch_video_metadata(video_id)
    if not metadata:
        raise HTTPException(status_code=400, detail="Video no encontrado")

    await youtube_service.save_metadata(video_id, metadata)

    venue_id = admin["venue_id"]
    db = await get_db()

    # Get or create admin user entry for tracking
    admin_user = await db.execute_fetchall("SELECT id FROM users WHERE phone = 'admin'")
    if not admin_user:
        cursor = await db.execute(
            "INSERT INTO users (phone, display_name, data_consent, is_system) VALUES ('admin', 'Admin', 1, 1)"
        )
        admin_user_id = cursor.lastrowid
        # Create a session for admin
        import uuid
        session_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO user_sessions (id, user_id, venue_id, table_number) VALUES (?, ?, ?, 'admin')",
            (session_id, admin_user_id, venue_id),
        )
        await db.commit()
    else:
        admin_user_id = admin_user[0][0]
        sessions = await db.execute_fetchall(
            "SELECT id FROM user_sessions WHERE user_id = ? AND venue_id = ? AND ended_at IS NULL LIMIT 1",
            (admin_user_id, venue_id),
        )
        if sessions:
            session_id = sessions[0][0]
        else:
            import uuid
            session_id = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO user_sessions (id, user_id, venue_id, table_number) VALUES (?, ?, ?, 'admin')",
                (session_id, admin_user_id, venue_id),
            )
            await db.commit()

    # Check if already in queue
    if await queue_service.check_duplicate(venue_id, video_id):
        raise HTTPException(status_code=409, detail="Esta cancion ya esta en la cola")

    try:
        result = await queue_service.add_song(
            venue_id=venue_id,
            user_id=admin_user_id,
            session_id=session_id,
            youtube_id=video_id,
            title=metadata["title"],
            thumbnail_url=metadata["thumbnail_url"],
            duration_sec=metadata["duration_sec"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al agregar cancion: {str(e)}")

    await manager.broadcast(venue_id, {
        "event": "song_added",
        "data": {
            "id": result["id"],
            "youtube_id": video_id,
            "title": metadata["title"],
            "position": result["position"],
            "added_by": "admin",
        },
    })

    # If nothing is playing, auto-start this song. try_start_song() re-checks
    # atomically under _playback_lock, so this can't race a concurrent
    # confirm/skip/finish into two songs marked 'playing'.
    started = await playback_service.try_start_song(venue_id, result["id"])
    if started:
        now_playing = {"id": result["id"], "youtube_id": video_id, "title": metadata["title"]}
        await manager.broadcast(venue_id, {
            "event": "now_playing_changed",
            "data": {"song": now_playing},
        })

    return {
        "id": result["id"],
        "youtube_id": video_id,
        "title": metadata["title"],
        "position": result["position"],
        "added_by": "admin",
    }


@router.post("/queue/skip")
async def skip_song(admin: dict = Depends(get_current_admin)):
    venue_id = admin["venue_id"]
    result = await playback_service.skip_song(venue_id)

    # Notify skipped song's owner — their rate limit slot freed up
    if result["skipped"] and result["skipped"].get("user_id"):
        await manager.send_to_user(venue_id, result["skipped"]["user_id"], {
            "event": "rate_limit_reset",
            "data": {"message": "Tu cancion termino"},
        })

    was_in_fallback = result["skipped"] is None  # no real song was playing → fallback mode

    await manager.broadcast(venue_id, {
        "event": "now_playing_changed",
        "data": {
            "song": result["now_playing"],
            "skipped_id": result["skipped"]["id"] if result["skipped"] else None,
        },
    })

    if result["now_playing"] and result["now_playing"].get("user_id"):
        await manager.send_to_user(venue_id, result["now_playing"]["user_id"], {
            "event": "your_song_playing",
            "data": {
                "song": result["now_playing"],
                "message": "Tu cancion esta sonando ahora",
            },
        })

    if result["now_playing"] and was_in_fallback:
        # Was in fallback mode — now_playing_changed queues it as pendingUserSong on the Kiosk.
        # Send fallback_skip so the Kiosk switches immediately instead of waiting for track to end.
        await manager.broadcast(venue_id, {"event": "fallback_skip", "data": {}})

    if not result["now_playing"]:
        # Queue empty after skip — activate/continue fallback
        from app.services.playlist_service import get_active_fallback_songs
        fallback_songs = await get_active_fallback_songs(venue_id)
        await manager.broadcast(venue_id, {
            "event": "now_playing_changed",
            "data": {"song": None, "fallback_active": True, "fallback_songs": fallback_songs},
        })
        if was_in_fallback:
            # Already in fallback and still no next song — tell Kiosk to play next fallback track
            await manager.broadcast(venue_id, {"event": "fallback_skip", "data": {}})

    return {
        "message": "Song skipped",
        "skipped": result["skipped"],
        "now_playing": result["now_playing"],
    }


@router.post("/playback/start")
async def start_playback(admin: dict = Depends(get_current_admin)):
    """Start playing the first pending song (when nothing is playing)."""
    venue_id = admin["venue_id"]
    db = await get_db()

    # Get first pending song
    pending = await db.execute_fetchall(
        "SELECT id FROM queue_songs "
        "WHERE venue_id = ? AND status = 'pending' ORDER BY position ASC LIMIT 1",
        (venue_id,),
    )
    if not pending:
        return {"message": "No songs in queue"}

    # try_start_song() atomically checks "nothing already playing" under
    # _playback_lock and does the transition; covers the former separate
    # "Already playing" pre-check too.
    started = await playback_service.try_start_song(venue_id, pending[0][0])
    if not started:
        return {"message": "Already playing"}

    await playback_service.set_playback_status(venue_id, "playing")

    await manager.broadcast(venue_id, {
        "event": "playback_status_changed",
        "data": {"status": "playing"},
    })

    now_playing = {"id": started["id"], "youtube_id": started["youtube_id"], "title": started["title"]}
    await manager.broadcast(venue_id, {
        "event": "now_playing_changed",
        "data": {"song": now_playing},
    })
    if started["user_id"]:
        await manager.send_to_user(venue_id, started["user_id"], {
            "event": "your_song_playing",
            "data": {"song": now_playing, "message": "Tu cancion esta sonando ahora"},
        })
    if started["was_fallback"]:
        await manager.broadcast(venue_id, {"event": "fallback_skip", "data": {}})

    return {"message": "Playback started", "now_playing": now_playing}


@router.get("/playlist")
async def get_admin_playlist(admin: dict = Depends(get_current_admin)):
    from app.services.playlist_service import get_fallback_songs
    songs = await get_fallback_songs(admin["venue_id"])
    return {"songs": songs}


@router.post("/fallback-status")
async def set_fallback_status(paused: bool = Query(False),
                              admin: dict = Depends(get_current_admin)):
    venue_id = admin["venue_id"]
    if paused:
        # Clear cached fallback song so dashboards show nothing while paused
        from app.services.playback_service import set_fallback_now_playing
        set_fallback_now_playing(venue_id, None)
    await manager.broadcast(venue_id, {
        "event": "fallback_status_changed",
        "data": {"paused": paused},
    })
    return {"fallback_paused": paused}


@router.post("/fallback-play")
async def play_fallback_now(admin: dict = Depends(get_current_admin)):
    """Tell the kiosk to start playing the fallback playlist immediately."""
    venue_id = admin["venue_id"]
    from app.services.playlist_service import get_active_fallback_songs
    songs = await get_active_fallback_songs(venue_id)
    if not songs:
        raise HTTPException(status_code=400, detail="No hay canciones en la playlist de respaldo")
    await manager.broadcast(venue_id, {
        "event": "fallback_play_now",
        "data": {"fallback_songs": songs},
    })
    return {"message": "Playlist de respaldo iniciada"}


@router.post("/fallback-skip")
async def skip_fallback_song(admin: dict = Depends(get_current_admin)):
    """Skip the current fallback song. If queue has pending songs, switch to the first one immediately."""
    venue_id = admin["venue_id"]
    db = await get_db()

    # Check for pending queue songs first
    pending = await db.execute_fetchall(
        "SELECT id FROM queue_songs "
        "WHERE venue_id = ? AND status = 'pending' ORDER BY position ASC LIMIT 1",
        (venue_id,),
    )

    if pending:
        started = await playback_service.try_start_song(venue_id, pending[0][0])
        if started:
            next_song = {
                "id": started["id"], "youtube_id": started["youtube_id"],
                "title": started["title"], "user_id": started["user_id"],
            }
            # 1. now_playing_changed → Kiosk stores as pendingUserSong (fallback still playing)
            await manager.broadcast(venue_id, {
                "event": "now_playing_changed",
                "data": {"song": next_song},
            })
            if next_song["user_id"]:
                await manager.send_to_user(venue_id, next_song["user_id"], {
                    "event": "your_song_playing",
                    "data": {"song": next_song, "message": "Tu cancion esta sonando ahora"},
                })
            # 2. fallback_skip → Kiosk calls handleFallbackSkip → finds pendingUserSong → switches immediately
            await manager.broadcast(venue_id, {"event": "fallback_skip", "data": {}})
            return {"message": "Cambiado a cancion de la cola", "now_playing": next_song}

    # No queue songs — tell kiosk to play next fallback song
    await manager.broadcast(venue_id, {"event": "fallback_skip", "data": {}})
    return {"message": "Cancion de playlist saltada"}


@router.post("/fallback/add")
async def add_song_to_fallback(youtube_id: str = Query(...), admin: dict = Depends(get_current_admin)):
    """Add a single song to the fallback playlist by youtube_id."""
    venue_id = admin["venue_id"]
    db = await get_db()

    existing = await db.execute_fetchall(
        "SELECT id FROM fallback_songs WHERE venue_id = ? AND youtube_id = ?",
        (venue_id, youtube_id),
    )
    if existing:
        raise HTTPException(status_code=400, detail="La cancion ya esta en la playlist de respaldo")

    metadata = await youtube_service.fetch_video_metadata(youtube_id)
    if not metadata:
        raise HTTPException(status_code=400, detail="No se pudo obtener informacion del video")

    from app.services.youtube_service import save_metadata
    await save_metadata(youtube_id, metadata)

    rows = await db.execute_fetchall(
        "SELECT COALESCE(MAX(position), 0) FROM fallback_songs WHERE venue_id = ?", (venue_id,)
    )
    position = rows[0][0] + 1

    cursor = await db.execute(
        "INSERT INTO fallback_songs (venue_id, youtube_id, title, thumbnail_url, duration_sec, position) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (venue_id, youtube_id, metadata["title"], metadata.get("thumbnail_url", ""),
         metadata.get("duration_sec", 0), position),
    )
    await db.commit()
    return {
        "message": "Cancion agregada a la playlist de respaldo",
        "song": {"id": cursor.lastrowid, "youtube_id": youtube_id, "title": metadata["title"], "position": position},
    }


@router.delete("/fallback/{song_id}")
async def remove_song_from_fallback(song_id: int, admin: dict = Depends(get_current_admin)):
    """Remove a song from the fallback playlist."""
    venue_id = admin["venue_id"]
    db = await get_db()

    rows = await db.execute_fetchall(
        "SELECT id FROM fallback_songs WHERE id = ? AND venue_id = ?", (song_id, venue_id)
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Cancion no encontrada")

    await db.execute("DELETE FROM fallback_songs WHERE id = ?", (song_id,))
    await db.commit()
    return {"message": "Cancion eliminada de la playlist de respaldo"}


@router.post("/playback/pause")
async def pause_playback(admin: dict = Depends(get_current_admin)):
    venue_id = admin["venue_id"]
    await playback_service.set_playback_status(venue_id, "paused")
    await manager.broadcast(venue_id, {
        "event": "playback_status_changed",
        "data": {"status": "paused"},
    })
    return {"playback_status": "paused"}


@router.post("/playback/resume")
async def resume_playback(admin: dict = Depends(get_current_admin)):
    venue_id = admin["venue_id"]
    await playback_service.set_playback_status(venue_id, "playing")
    await manager.broadcast(venue_id, {
        "event": "playback_status_changed",
        "data": {"status": "playing"},
    })
    return {"playback_status": "playing"}


@router.get("/history")
async def get_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    admin: dict = Depends(get_current_admin),
):
    return await analytics_service.get_history(
        admin["venue_id"], page, per_page, date_from, date_to
    )


@router.get("/analytics")
async def get_analytics(
    period: str = Query("week"),
    admin: dict = Depends(get_current_admin),
):
    return await analytics_service.get_analytics(admin["venue_id"], period)


@router.get("/library")
async def get_library(
    search: str = Query(""),
    admin: dict = Depends(get_current_admin),
):
    """Get previously played songs from the database."""
    venue_id = admin["venue_id"]
    db = await get_db()

    if search:
        rows = await db.execute_fetchall(
            "SELECT DISTINCT sm.youtube_id, sm.title, sm.artist, sm.duration_sec "
            "FROM song_metadata sm "
            "WHERE sm.title LIKE ? OR sm.artist LIKE ? "
            "ORDER BY sm.first_seen_at DESC LIMIT 50",
            (f"%{search}%", f"%{search}%"),
        )
    else:
        rows = await db.execute_fetchall(
            "SELECT DISTINCT sm.youtube_id, sm.title, sm.artist, sm.duration_sec "
            "FROM song_metadata sm "
            "ORDER BY sm.first_seen_at DESC LIMIT 50",
        )

    return {
        "songs": [
            {
                "youtube_id": r[0],
                "title": r[1],
                "artist": r[2] or "",
                "duration_sec": r[3] or 0,
                "thumbnail_url": f"https://i.ytimg.com/vi/{r[0]}/mqdefault.jpg",
            }
            for r in rows
        ]
    }


@router.post("/volume")
async def set_volume(
    admin: dict = Depends(get_current_admin),
    volume: int = Query(..., ge=0, le=100),
):
    """Set volume, persist in config, and broadcast to kiosk."""
    venue_id = admin["venue_id"]
    db = await get_db()
    import json
    rows = await db.execute_fetchall("SELECT config FROM venues WHERE id = ?", (venue_id,))
    config = {}
    if rows and rows[0][0]:
        try: config = json.loads(rows[0][0])
        except: pass
    config["volume"] = volume
    await db.execute("UPDATE venues SET config = ? WHERE id = ?", (json.dumps(config), venue_id))
    await db.commit()
    await manager.broadcast(venue_id, {
        "event": "volume_changed",
        "data": {"volume": volume},
    })
    return {"volume": volume}


@router.post("/banner")
async def set_banner(
    admin: dict = Depends(get_current_admin),
    text: str = Query("", max_length=500),
    show_brand: bool | None = Query(None),
):
    """Set banner text and/or brand visibility, persist in config, broadcast to kiosk."""
    venue_id = admin["venue_id"]
    db = await get_db()
    import json
    rows = await db.execute_fetchall("SELECT config FROM venues WHERE id = ?", (venue_id,))
    config = {}
    if rows and rows[0][0]:
        try: config = json.loads(rows[0][0])
        except: pass
    config["banner_text"] = text
    if show_brand is not None:
        config["show_brand"] = show_brand
    await db.execute("UPDATE venues SET config = ? WHERE id = ?", (json.dumps(config), venue_id))
    await db.commit()
    broadcast_data = {"banner_text": text}
    if show_brand is not None:
        broadcast_data["show_brand"] = show_brand
    await manager.broadcast(venue_id, {
        "event": "banner_changed",
        "data": broadcast_data,
    })
    return {"banner_text": text}


QR_SIZES = {"S", "M", "L"}


@router.post("/show-qr")
async def toggle_show_qr(
    show: bool = Query(None),
    size: str = Query(None),
    admin: dict = Depends(get_current_admin),
):
    """Toggle QR visibility and/or size on kiosk screen."""
    if size is not None and size not in QR_SIZES:
        raise HTTPException(status_code=400, detail="Talla de QR invalida, usar S, M o L")
    venue_id = admin["venue_id"]
    db = await get_db()
    import json
    rows = await db.execute_fetchall("SELECT config FROM venues WHERE id = ?", (venue_id,))
    config = {}
    if rows and rows[0][0]:
        try: config = json.loads(rows[0][0])
        except: pass
    if show is not None:
        config["show_qr"] = show
    if size is not None:
        config["qr_size"] = size
    await db.execute("UPDATE venues SET config = ? WHERE id = ?", (json.dumps(config), venue_id))
    await db.commit()
    result = {"show_qr": config.get("show_qr", False), "qr_size": config.get("qr_size", "M")}
    await manager.broadcast(venue_id, {
        "event": "qr_visibility_changed",
        "data": result,
    })
    return result


@router.get("/tables")
async def get_tables(admin: dict = Depends(get_current_admin)):
    """Get all active tables with their song history for today."""
    venue_id = admin["venue_id"]
    db = await get_db()

    rows = await db.execute_fetchall(
        "SELECT us.table_number, u.display_name, u.phone, "
        "qs.title, qs.status, qs.added_at "
        "FROM user_sessions us "
        "JOIN users u ON us.user_id = u.id "
        "LEFT JOIN queue_songs qs ON qs.session_id = us.id "
        "AND qs.status IN ('pending', 'playing', 'played') "
        "WHERE us.venue_id = ? AND us.ended_at IS NULL "
        "AND us.table_number != 'admin' "
        "ORDER BY us.table_number, qs.added_at DESC",
        (venue_id,),
    )

    from app.utils import to_colombia_12h
    tables: dict = {}
    for r in rows:
        table_num = r[0]
        if table_num not in tables:
            tables[table_num] = {
                "table_number": table_num,
                "user_name": r[1] or "Anonymous",
                "user_phone": r[2],
                "songs": [],
                "songs_pending": 0,
                "songs_playing": 0,
                "songs_played": 0,
            }
        if r[3]:  # has a song
            tables[table_num]["songs"].append({
                "title": r[3],
                "status": r[4],
                "added_at": to_colombia_12h(r[5]),
            })
            if r[4] == "pending":
                tables[table_num]["songs_pending"] += 1
            elif r[4] == "playing":
                tables[table_num]["songs_playing"] += 1
            elif r[4] == "played":
                tables[table_num]["songs_played"] += 1

    return {"tables": list(tables.values())}


@router.post("/tables/{table_number}/kick")
async def kick_table(table_number: str, admin: dict = Depends(get_current_admin)):
    """Kick a table: end their session and remove their pending songs."""
    venue_id = admin["venue_id"]
    db = await get_db()

    # Find sessions for this table
    sessions = await db.execute_fetchall(
        "SELECT id, user_id FROM user_sessions "
        "WHERE venue_id = ? AND table_number = ? AND ended_at IS NULL",
        (venue_id, table_number),
    )

    for session in sessions:
        session_id = session[0]
        # Remove pending songs from this session
        await db.execute(
            "UPDATE queue_songs SET status = 'removed' "
            "WHERE session_id = ? AND status = 'pending'",
            (session_id,),
        )
        # End the session
        await db.execute(
            "UPDATE user_sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ?",
            (session_id,),
        )

    await db.commit()

    # Notify kicked users to log out
    for session in sessions:
        user_id = session[1]
        await manager.send_to_user(venue_id, user_id, {
            "event": "session_kicked",
            "data": {"message": "Tu sesion fue cerrada por el administrador"},
        })

    # Broadcast queue update
    await manager.broadcast(venue_id, {
        "event": "song_removed",
        "data": {"id": None, "removed_by": "admin"},
    })

    # Log analytics events
    try:
        from app.services.analytics_service import log_event
        for session in sessions:
            await log_event(venue_id, "session_kicked", {"table_number": table_number}, session[1], session[0])
    except Exception:
        pass

    return {"message": f"Mesa {table_number} expulsada"}


@router.post("/tables/{table_number}/reset-limit")
async def reset_table_limit(table_number: str, admin: dict = Depends(get_current_admin)):
    """Reset the rate limit for a table's user."""
    venue_id = admin["venue_id"]
    db = await get_db()

    # Find the user for this table
    sessions = await db.execute_fetchall(
        "SELECT user_id FROM user_sessions "
        "WHERE venue_id = ? AND table_number = ? AND ended_at IS NULL",
        (venue_id, table_number),
    )

    for session in sessions:
        user_id = session[0]
        # Delete their submission log entries to reset the rate limit
        await db.execute(
            "DELETE FROM submission_log WHERE user_id = ? AND venue_id = ?",
            (user_id, venue_id),
        )

    await db.commit()

    # Notify affected users so their UI updates immediately
    for session in sessions:
        user_id = session[0]
        await manager.send_to_user(venue_id, user_id, {
            "event": "rate_limit_reset",
            "data": {"message": "Tu limite fue reseteado"},
        })

    return {"message": f"Limite de {table_number} reseteado"}


# ===== DAILY PIN =====

@router.get("/daily-pin")
async def get_daily_pin(admin: dict = Depends(get_current_admin)):
    """Get today's PIN for this venue (creates one if it doesn't exist)."""
    pin = await auth_service.get_or_create_daily_pin(admin["venue_id"])
    pin_required = await auth_service.is_pin_required(admin["venue_id"])
    return {"pin": pin, "require_pin": pin_required}


@router.post("/daily-pin/regenerate")
async def regenerate_daily_pin(admin: dict = Depends(get_current_admin)):
    """Delete today's PIN and generate a new one."""
    from datetime import date
    venue_id = admin["venue_id"]
    db = await get_db()
    today = date.today().isoformat()
    await db.execute(
        "DELETE FROM venue_daily_pins WHERE venue_id = ? AND valid_date = ?",
        (venue_id, today),
    )
    await db.commit()
    pin = await auth_service.get_or_create_daily_pin(venue_id)
    return {"pin": pin}


@router.post("/settings/pin")
async def toggle_pin_requirement(
    require: bool = Query(...),
    admin: dict = Depends(get_current_admin),
):
    """Enable or disable PIN requirement for this venue."""
    import json
    venue_id = admin["venue_id"]
    db = await get_db()
    rows = await db.execute_fetchall("SELECT config FROM venues WHERE id = ?", (venue_id,))
    config = {}
    if rows and rows[0][0]:
        try:
            config = json.loads(rows[0][0])
        except (json.JSONDecodeError, TypeError):
            pass
    config["require_pin"] = require
    await db.execute("UPDATE venues SET config = ? WHERE id = ?", (json.dumps(config), venue_id))
    await db.commit()
    return {"require_pin": require}
