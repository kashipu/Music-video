import json
import os
import uuid

import bcrypt
from fastapi import APIRouter, HTTPException, Depends, Header, Query, UploadFile, File
from pydantic import BaseModel

from app.services import auth_service
from app.database import get_db

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])


class SuperLoginRequest(BaseModel):
    username: str
    password: str


class CreateVenueRequest(BaseModel):
    name: str
    slug: str
    admin_username: str
    admin_password: str
    logo_url: str | None = None
    qr_url: str | None = None
    max_duration_sec: int = 600
    max_songs_per_window: int = 5
    window_minutes: int = 30


class UpdateVenueRequest(BaseModel):
    name: str | None = None
    logo_url: str | None = ""
    qr_url: str | None = ""
    active: bool | None = None
    max_duration_sec: int | None = None
    max_songs_per_window: int | None = None
    window_minutes: int | None = None
    theme: dict | None = None


async def get_current_super_admin(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesion invalida")
    token = authorization[7:]
    try:
        payload = auth_service.decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Sesion expirada")
    if not payload.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Acceso de super administrador requerido")
    return payload


@router.post("/login")
async def super_admin_login(req: SuperLoginRequest):
    admin = await auth_service.verify_super_admin(req.username, req.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Usuario o contrasena incorrectos")
    token = auth_service.create_super_admin_token(admin["id"], admin["username"])
    return {"token": token, "admin": admin}


@router.get("/venues")
async def list_venues(admin: dict = Depends(get_current_super_admin)):
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT v.id, v.name, v.slug, v.active, v.config, v.created_at, v.logo_url, v.qr_url, "
        "(SELECT COUNT(*) FROM admins a WHERE a.venue_id = v.id) as admin_count, "
        "(SELECT COUNT(*) FROM queue_songs qs WHERE qs.venue_id = v.id AND qs.status IN ('pending','playing')) as queue_count, "
        "(SELECT COUNT(*) FROM user_sessions us WHERE us.venue_id = v.id AND us.ended_at IS NULL) as active_sessions "
        "FROM venues v ORDER BY v.created_at DESC"
    )
    venues = []
    for r in rows:
        config = {}
        try:
            config = json.loads(r[4] or "{}")
        except (json.JSONDecodeError, TypeError):
            pass
        venues.append({
            "id": r[0], "name": r[1], "slug": r[2],
            "active": bool(r[3]), "config": config,
            "created_at": r[5], "logo_url": r[6], "qr_url": r[7],
            "admin_count": r[8], "queue_count": r[9], "active_sessions": r[10],
        })
    return {"venues": venues}


@router.post("/venues")
async def create_venue(req: CreateVenueRequest, admin: dict = Depends(get_current_super_admin)):
    db = await get_db()

    # Check slug unique
    existing = await db.execute_fetchall("SELECT id FROM venues WHERE slug = ?", (req.slug,))
    if existing:
        raise HTTPException(status_code=409, detail="Este slug ya existe, elige otro")

    # Check admin username unique
    existing_admin = await db.execute_fetchall("SELECT id FROM admins WHERE username = ?", (req.admin_username,))
    if existing_admin:
        raise HTTPException(status_code=409, detail=f"El usuario '{req.admin_username}' ya existe, elige otro nombre")

    config = json.dumps({
        "max_duration_sec": req.max_duration_sec,
        "max_songs_per_window": req.max_songs_per_window,
        "window_minutes": req.window_minutes,
    })

    cursor = await db.execute(
        "INSERT INTO venues (name, slug, fallback_mode, config, active, logo_url, qr_url) VALUES (?, ?, 'playlist', ?, TRUE, ?, ?)",
        (req.name, req.slug, config, req.logo_url, req.qr_url),
    )
    venue_id = cursor.lastrowid

    # Create admin for this venue
    password_hash = bcrypt.hashpw(req.admin_password.encode(), bcrypt.gensalt()).decode()
    await db.execute(
        "INSERT INTO admins (venue_id, username, password_hash) VALUES (?, ?, ?)",
        (venue_id, req.admin_username, password_hash),
    )

    await db.commit()

    return {
        "message": "Venue created",
        "venue": {
            "id": venue_id, "name": req.name, "slug": req.slug,
            "admin_username": req.admin_username,
        },
        "urls": {
            "usuario": f"/{req.slug}/usuario",
            "admin": f"/{req.slug}/admin",
            "video": f"/{req.slug}/video",
        },
    }


@router.patch("/venues/{venue_id}")
async def update_venue(venue_id: int, req: UpdateVenueRequest,
                       admin: dict = Depends(get_current_super_admin)):
    db = await get_db()

    rows = await db.execute_fetchall("SELECT config FROM venues WHERE id = ?", (venue_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Bar no encontrado")

    config = {}
    try:
        config = json.loads(rows[0][0] or "{}")
    except (json.JSONDecodeError, TypeError):
        pass

    if req.name is not None:
        await db.execute("UPDATE venues SET name = ? WHERE id = ?", (req.name, venue_id))
    if req.logo_url != "":
        await db.execute("UPDATE venues SET logo_url = ? WHERE id = ?", (req.logo_url, venue_id))
    if req.qr_url != "":
        await db.execute("UPDATE venues SET qr_url = ? WHERE id = ?", (req.qr_url, venue_id))
    if req.active is not None:
        await db.execute("UPDATE venues SET active = ? WHERE id = ?", (req.active, venue_id))
    if req.max_duration_sec is not None:
        config["max_duration_sec"] = req.max_duration_sec
    if req.max_songs_per_window is not None:
        config["max_songs_per_window"] = req.max_songs_per_window
    if req.window_minutes is not None:
        config["window_minutes"] = req.window_minutes
    if req.theme is not None:
        config["theme"] = req.theme

    await db.execute("UPDATE venues SET config = ? WHERE id = ?", (json.dumps(config), venue_id))
    await db.commit()

    return {"message": "Venue updated"}


@router.delete("/venues/{venue_id}")
async def delete_venue(venue_id: int, admin: dict = Depends(get_current_super_admin)):
    db = await get_db()

    # Delete all related data
    await db.execute("DELETE FROM submission_log WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM play_history WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM queue_songs WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM user_sessions WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM admins WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM venues WHERE id = ?", (venue_id,))
    await db.commit()

    return {"message": "Venue deleted permanently"}


@router.get("/venues/{venue_id}/stats")
async def venue_stats(venue_id: int, admin: dict = Depends(get_current_super_admin)):
    db = await get_db()

    rows = await db.execute_fetchall("SELECT name, slug, active, created_at, logo_url, qr_url, config FROM venues WHERE id = ?", (venue_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Bar no encontrado")

    v = rows[0]

    stats = await db.execute_fetchall(
        "SELECT "
        "(SELECT COUNT(*) FROM play_history WHERE venue_id = ?) as total_played, "
        "(SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE venue_id = ?) as total_users, "
        "(SELECT COUNT(*) FROM user_sessions WHERE venue_id = ? AND ended_at IS NULL) as active_now, "
        "(SELECT COUNT(*) FROM queue_songs WHERE venue_id = ? AND status IN ('pending','playing')) as in_queue",
        (venue_id, venue_id, venue_id, venue_id),
    )
    s = stats[0]

    admins = await db.execute_fetchall(
        "SELECT id, username, created_at FROM admins WHERE venue_id = ?", (venue_id,)
    )

    return {
        "venue": {"id": venue_id, "name": v[0], "slug": v[1], "active": bool(v[2]), "created_at": v[3], "logo_url": v[4], "qr_url": v[5], "config": v[6]},
        "stats": {
            "total_songs_played": s[0], "total_users": s[1],
            "active_sessions": s[2], "songs_in_queue": s[3],
        },
        "admins": [{"id": a[0], "username": a[1], "created_at": a[2]} for a in admins],
    }


@router.get("/venues/{venue_id}/users")
async def get_venue_users(venue_id: int, admin: dict = Depends(get_current_super_admin)):
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT u.id, u.phone, u.display_name, u.created_at, "
        "us.table_number, "
        "(SELECT COUNT(*) FROM queue_songs qs WHERE qs.user_id = u.id AND qs.venue_id = ?) as songs_count "
        "FROM users u "
        "JOIN user_sessions us ON us.user_id = u.id AND us.venue_id = ? "
        "WHERE u.phone != 'admin' "
        "GROUP BY u.id "
        "ORDER BY u.created_at DESC",
        (venue_id, venue_id),
    )
    return {
        "users": [
            {
                "id": r[0], "phone": r[1],
                "display_name": r[2], "created_at": r[3],
                "table_number": r[4], "songs_count": r[5],
            }
            for r in rows
        ]
    }


class AddAdminRequest(BaseModel):
    username: str
    password: str


@router.post("/venues/{venue_id}/admins")
async def add_venue_admin(venue_id: int, req: AddAdminRequest,
                          admin: dict = Depends(get_current_super_admin)):
    db = await get_db()

    existing = await db.execute_fetchall("SELECT id FROM admins WHERE username = ?", (req.username,))
    if existing:
        raise HTTPException(status_code=409, detail="Este nombre de usuario ya existe")

    password_hash = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    await db.execute(
        "INSERT INTO admins (venue_id, username, password_hash) VALUES (?, ?, ?)",
        (venue_id, req.username, password_hash),
    )
    await db.commit()
    return {"message": f"Admin '{req.username}' added to venue"}


@router.delete("/venues/{venue_id}/admins/{admin_id}")
async def remove_venue_admin(venue_id: int, admin_id: int,
                             admin: dict = Depends(get_current_super_admin)):
    db = await get_db()
    await db.execute("DELETE FROM admins WHERE id = ? AND venue_id = ?", (admin_id, venue_id))
    await db.commit()
    return {"message": "Admin removed"}


# ===== PLAYLIST / FALLBACK SONGS =====

class ImportPlaylistRequest(BaseModel):
    playlist_url: str


class AddFallbackSongRequest(BaseModel):
    youtube_url: str


@router.get("/venues/{venue_id}/playlist")
async def get_venue_playlist(venue_id: int, admin: dict = Depends(get_current_super_admin)):
    from app.services.playlist_service import get_fallback_songs
    songs = await get_fallback_songs(venue_id)
    return {"songs": songs}


@router.post("/venues/{venue_id}/playlist/import")
async def import_playlist(venue_id: int, req: ImportPlaylistRequest,
                          admin: dict = Depends(get_current_super_admin)):
    from app.services.playlist_service import import_playlist as do_import
    try:
        imported = await do_import(venue_id, req.playlist_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": f"{len(imported)} canciones importadas", "imported": imported}


@router.post("/venues/{venue_id}/playlist/add")
async def add_fallback_song(venue_id: int, req: AddFallbackSongRequest,
                            admin: dict = Depends(get_current_super_admin)):
    from app.services.youtube_service import extract_video_id, fetch_video_metadata, save_metadata

    video_id = extract_video_id(req.youtube_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="URL de YouTube invalida")

    metadata = await fetch_video_metadata(video_id)
    if not metadata:
        raise HTTPException(status_code=400, detail="Video no encontrado")

    await save_metadata(video_id, metadata)

    db = await get_db()
    existing = await db.execute_fetchall(
        "SELECT id FROM fallback_songs WHERE venue_id = ? AND youtube_id = ?",
        (venue_id, video_id),
    )
    if existing:
        raise HTTPException(status_code=409, detail="Esta cancion ya esta en la playlist")

    rows = await db.execute_fetchall(
        "SELECT COALESCE(MAX(position), 0) FROM fallback_songs WHERE venue_id = ?", (venue_id,)
    )
    position = rows[0][0] + 1

    await db.execute(
        "INSERT INTO fallback_songs (venue_id, youtube_id, title, thumbnail_url, duration_sec, position) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (venue_id, video_id, metadata["title"], metadata["thumbnail_url"],
         metadata.get("duration_sec", 0), position),
    )
    await db.commit()

    return {"message": "Cancion agregada", "title": metadata["title"], "position": position}


@router.delete("/venues/{venue_id}/playlist/{song_id}")
async def remove_fallback_song(venue_id: int, song_id: int,
                               admin: dict = Depends(get_current_super_admin)):
    db = await get_db()
    await db.execute("DELETE FROM fallback_songs WHERE id = ? AND venue_id = ?", (song_id, venue_id))
    await db.commit()
    return {"message": "Cancion removida de la playlist"}


@router.patch("/venues/{venue_id}/playlist/{song_id}/toggle")
async def toggle_fallback_song(venue_id: int, song_id: int,
                               admin: dict = Depends(get_current_super_admin)):
    db = await get_db()
    await db.execute(
        "UPDATE fallback_songs SET active = NOT active WHERE id = ? AND venue_id = ?",
        (song_id, venue_id),
    )
    await db.commit()
    return {"message": "Estado actualizado"}


@router.delete("/venues/{venue_id}/playlist")
async def clear_venue_playlist(venue_id: int, admin: dict = Depends(get_current_super_admin)):
    db = await get_db()
    await db.execute("DELETE FROM fallback_songs WHERE venue_id = ?", (venue_id,))
    await db.commit()
    return {"message": "Playlist limpiada"}


@router.post("/venues/{venue_id}/logo")
async def upload_venue_logo(
    venue_id: int,
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_super_admin),
):
    """Upload a logo image (PNG, JPG, SVG) for a venue."""
    # Validate file type
    allowed = {"image/png", "image/jpeg", "image/jpg", "image/svg+xml"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PNG, JPG o SVG")

    # Validate file size (max 2MB)
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo no puede superar 2MB")

    # Generate filename
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "png"
    if ext not in ("png", "jpg", "jpeg", "svg"):
        ext = "png"
    filename = f"{venue_id}_{uuid.uuid4().hex[:8]}.{ext}"

    # Save file
    from app.config import settings
    logos_dir = os.path.join(os.path.dirname(settings.database_path), "logos")
    os.makedirs(logos_dir, exist_ok=True)

    # Delete old logo files for this venue
    for f in os.listdir(logos_dir):
        if f.startswith(f"{venue_id}_"):
            os.remove(os.path.join(logos_dir, f))

    filepath = os.path.join(logos_dir, filename)
    with open(filepath, "wb") as f:
        f.write(content)

    # Update venue logo_url in DB
    logo_url = f"/api/uploads/{filename}"
    db = await get_db()
    await db.execute("UPDATE venues SET logo_url = ? WHERE id = ?", (logo_url, venue_id))
    await db.commit()

    return {"logo_url": logo_url}
