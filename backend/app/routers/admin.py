from fastapi import APIRouter, HTTPException, Depends, Header, Query

from app.models.schemas import (
    AdminLoginRequest, AdminSongAddRequest, AdminReorderRequest,
)
from app.services import auth_service, playback_service, analytics_service, youtube_service, queue_service
from app.routers.websocket import manager
from app.database import get_db

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def get_current_admin(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesion invalida")
    token = authorization[7:]
    try:
        payload = auth_service.decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Sesion expirada, vuelve a iniciar")
    if not payload.get("is_admin"):
        raise HTTPException(status_code=403, detail="Acceso de administrador requerido")
    return payload


@router.post("/login")
async def admin_login(req: AdminLoginRequest):
    admin = await auth_service.verify_admin(req.username, req.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Usuario o contrasena incorrectos")

    # Check venue is active
    db = await get_db()
    venue_check = await db.execute_fetchall(
        "SELECT id, slug, active FROM venues WHERE id = ?", (admin["venue_id"],)
    )
    if venue_check and not venue_check[0][2]:
        raise HTTPException(status_code=403, detail="Este bar esta inactivo. Contacta al administrador.")

    # If venue_slug provided, verify admin belongs to that venue
    if req.venue_slug:
        venue_rows = await db.execute_fetchall(
            "SELECT id, slug FROM venues WHERE slug = ?", (req.venue_slug,)
        )
        if not venue_rows:
            raise HTTPException(status_code=404, detail="Bar no encontrado")
        if admin["venue_id"] != venue_rows[0][0]:
            raise HTTPException(status_code=403, detail="Este usuario no pertenece a este bar")

    token = auth_service.create_admin_token(admin["id"], admin["username"], admin["venue_id"])
    return {"token": token, "admin": admin}


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

    return {
        "now_playing": now_playing,
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
    return {"message": "Song removed", "song_id": song_id}


@router.post("/queue/songs/{song_id}/play-now")
async def play_now(song_id: int, admin: dict = Depends(get_current_admin)):
    """Skip current song and play this one immediately."""
    venue_id = admin["venue_id"]
    db = await get_db()

    # Verify song exists and is pending
    rows = await db.execute_fetchall(
        "SELECT id, youtube_id, title, user_id FROM queue_songs "
        "WHERE id = ? AND venue_id = ? AND status = 'pending'",
        (song_id, venue_id),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Cancion no encontrada")

    song = rows[0]

    # Get current playing song's owner before marking as played
    current_playing = await db.execute_fetchall(
        "SELECT user_id FROM queue_songs WHERE venue_id = ? AND status = 'playing' LIMIT 1",
        (venue_id,),
    )

    # Mark current playing song as played
    await db.execute(
        "UPDATE queue_songs SET status = 'played', played_at = CURRENT_TIMESTAMP "
        "WHERE venue_id = ? AND status = 'playing'",
        (venue_id,),
    )

    # Notify previous song's owner
    if current_playing and current_playing[0][0]:
        await manager.send_to_user(venue_id, current_playing[0][0], {
            "event": "rate_limit_reset",
            "data": {"message": "Tu cancion termino"},
        })

    # Move this song to position 1 (before all others)
    await db.execute(
        "UPDATE queue_songs SET position = position + 1 "
        "WHERE venue_id = ? AND status = 'pending'",
        (venue_id,),
    )
    await db.execute(
        "UPDATE queue_songs SET status = 'playing', position = 0, played_at = CURRENT_TIMESTAMP "
        "WHERE id = ?",
        (song_id,),
    )
    await db.commit()

    now_playing = {"id": song[0], "youtube_id": song[1], "title": song[2]}
    await manager.broadcast(venue_id, {
        "event": "now_playing_changed",
        "data": {"song": now_playing},
    })
    if song[3]:
        await manager.send_to_user(venue_id, song[3], {
            "event": "your_song_playing",
            "data": {"song": now_playing, "message": "Tu cancion esta sonando ahora"},
        })

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
            "INSERT INTO users (phone, display_name, data_consent) VALUES ('admin', 'Admin', 1)"
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

    # If nothing is playing, auto-start this song
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

    # Single broadcast for skip — includes next song info
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

    if not result["now_playing"]:
        # Queue empty after skip — activate fallback
        from app.services.playlist_service import get_active_fallback_songs
        fallback_songs = await get_active_fallback_songs(venue_id)
        await manager.broadcast(venue_id, {
            "event": "now_playing_changed",
            "data": {"song": None, "fallback_active": True, "fallback_songs": fallback_songs},
        })

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

    # Check if something is already playing
    playing = await db.execute_fetchall(
        "SELECT id FROM queue_songs WHERE venue_id = ? AND status = 'playing'",
        (venue_id,),
    )
    if playing:
        return {"message": "Already playing"}

    # Get first pending song
    pending = await db.execute_fetchall(
        "SELECT id, youtube_id, title, user_id FROM queue_songs "
        "WHERE venue_id = ? AND status = 'pending' ORDER BY position ASC LIMIT 1",
        (venue_id,),
    )
    if not pending:
        return {"message": "No songs in queue"}

    song = pending[0]
    await db.execute(
        "UPDATE queue_songs SET status = 'playing', played_at = CURRENT_TIMESTAMP WHERE id = ?",
        (song[0],),
    )
    await playback_service.set_playback_status(venue_id, "playing")
    await db.commit()

    now_playing = {"id": song[0], "youtube_id": song[1], "title": song[2]}
    await manager.broadcast(venue_id, {
        "event": "now_playing_changed",
        "data": {"song": now_playing},
    })
    # Notify song owner
    if song[3]:
        await manager.send_to_user(venue_id, song[3], {
            "event": "your_song_playing",
            "data": {"song": now_playing, "message": "Tu cancion esta sonando ahora"},
        })

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
