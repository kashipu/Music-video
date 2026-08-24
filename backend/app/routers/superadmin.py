import json
import os
import uuid
from datetime import date, timedelta

import asyncio
import bcrypt
from fastapi import APIRouter, HTTPException, Depends, Header, Query, UploadFile, File
from pydantic import BaseModel, Field, StrictInt

from app.services import analytics_service, auth_service, billing_service
from app.database import get_db

async def get_platform_settings() -> dict:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT trial_days, grace_period_days, monthly_price_cents FROM platform_settings WHERE id = 1"
    )
    if rows:
        return {
            "trial_days": rows[0][0],
            "grace_period_days": rows[0][1],
            "monthly_price_cents": rows[0][2],
        }
    return {"trial_days": 15, "grace_period_days": 5, "monthly_price_cents": 0}


async def compute_payment_status(paid_until: str | None, grace_period_days: int | None = None) -> str:
    if grace_period_days is None:
        grace_period_days = (await get_platform_settings())["grace_period_days"]
    if paid_until is None:
        return "active"
    try:
        paid_date = date.fromisoformat(paid_until)
    except (ValueError, TypeError):
        return "active"
    today = date.today()
    if paid_date >= today:
        return "active"
    if paid_date >= today - timedelta(days=grace_period_days):
        return "overdue"
    return "suspended"

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])


VALID_SUPER_ADMIN_ROLES = {"super_admin", "vendedor", "editor"}


class SuperLoginRequest(BaseModel):
    username: str
    password: str


class CreateSuperAdminRequest(BaseModel):
    username: str
    password: str
    phone: str
    email: str
    role: str = "vendedor"


class UpdateSuperAdminRequest(BaseModel):
    role: str | None = None
    password: str | None = None


class CreateVenueRequest(BaseModel):
    name: str
    slug: str
    admin_username: str
    admin_password: str
    admin_email: str
    admin_phone: str
    admin_address: str
    admin_city: str
    logo_url: str | None = None
    qr_url: str | None = None
    max_duration_sec: int = 600
    max_songs_per_window: int = 3
    window_minutes: int = 20
    trial_days: int = 15


class MarkPaidRequest(BaseModel):
    months: int = 1
    notes: str | None = None
    amount_cents: int | None = None


class ExtendTrialRequest(BaseModel):
    days: int


class UpdateBillingEventRequest(BaseModel):
    notes: str | None


class UpdatePlatformSettingsRequest(BaseModel):
    trial_days: StrictInt | None = Field(default=None, gt=0)
    grace_period_days: StrictInt | None = Field(default=None, gt=0)
    monthly_price_cents: StrictInt | None = Field(default=None, ge=0)


class UpdateVenueRequest(BaseModel):
    name: str | None = None
    logo_url: str | None = ""
    qr_url: str | None = ""
    active: bool | None = None
    max_duration_sec: int | None = None
    max_songs_per_window: int | None = None
    window_minutes: int | None = None
    theme: dict | None = None


async def get_current_super_admin(authorization: str | None = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesion invalida")
    token = authorization[7:]
    try:
        payload = auth_service.decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Sesion expirada")
    if not payload.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Acceso de super administrador requerido")
    return payload


def require_role(*roles: str):
    async def dependency(admin: dict = Depends(get_current_super_admin)) -> dict:
        if (admin.get("role") or "super_admin") not in roles:
            raise HTTPException(status_code=403, detail="No tenes permiso para esta accion")
        return admin
    return dependency


@router.post("/login")
async def super_admin_login(req: SuperLoginRequest):
    admin = await auth_service.verify_super_admin(req.username, req.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Usuario o contrasena incorrectos")
    db = await get_db()
    await db.execute("UPDATE super_admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", (admin["id"],))
    await db.commit()
    token = auth_service.create_super_admin_token(admin["id"], admin["username"], role=admin.get("role", "super_admin"))
    return {"token": token, "admin": admin}


@router.get("/settings")
async def get_settings(admin: dict = Depends(get_current_super_admin)):
    return await get_platform_settings()


@router.patch("/settings")
async def update_settings(req: UpdatePlatformSettingsRequest,
                          admin: dict = Depends(require_role("super_admin"))):
    if req.trial_days is None and req.grace_period_days is None and req.monthly_price_cents is None:
        raise HTTPException(status_code=422, detail="Indica al menos un valor")

    current = await get_platform_settings()
    settings = {
        "trial_days": req.trial_days if req.trial_days is not None else current["trial_days"],
        "grace_period_days": req.grace_period_days if req.grace_period_days is not None else current["grace_period_days"],
        "monthly_price_cents": (
            req.monthly_price_cents
            if req.monthly_price_cents is not None
            else current["monthly_price_cents"]
        ),
    }
    db = await get_db()
    await db.execute(
        "INSERT INTO platform_settings (id, trial_days, grace_period_days, monthly_price_cents) "
        "VALUES (1, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET trial_days = excluded.trial_days, "
        "grace_period_days = excluded.grace_period_days, "
        "monthly_price_cents = excluded.monthly_price_cents",
        (settings["trial_days"], settings["grace_period_days"], settings["monthly_price_cents"]),
    )
    await db.commit()
    return settings


@router.get("/venues")
async def list_venues(admin: dict = Depends(get_current_super_admin)):
    db = await get_db()
    kpi_rows = await db.execute_fetchall(
        "WITH periods(period, window_start, window_days) AS ("
        "VALUES ('today', datetime('now', 'start of day'), 0), "
        "('week', datetime('now', '-7 days'), 7), "
        "('month', datetime('now', '-30 days'), 30)) "
        "SELECT period, "
        "(SELECT COUNT(*) FROM super_admins WHERE last_login_at BETWEEN window_start AND CURRENT_TIMESTAMP), "
        "(SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE started_at BETWEEN window_start AND CURRENT_TIMESTAMP), "
        "(SELECT COUNT(*) FROM queue_songs WHERE added_at BETWEEN window_start AND CURRENT_TIMESTAMP), "
        "(SELECT COUNT(DISTINCT venue_id) FROM play_history WHERE played_at BETWEEN window_start AND CURRENT_TIMESTAMP), "
        "(SELECT COUNT(*) FROM venues WHERE date(paid_until) BETWEEN date('now') AND date('now', '+' || window_days || ' days')) "
        "FROM periods"
    )
    kpis = {
        r[0]: {
            "admins_online": r[1], "users_online": r[2], "queued_songs": r[3],
            "active_venues": r[4], "expiring": r[5],
        }
        for r in kpi_rows
    }
    rows = await db.execute_fetchall(
        "SELECT v.id, v.name, v.slug, v.active, v.config, v.created_at, v.logo_url, v.qr_url, "
        "(SELECT COUNT(*) FROM admins a WHERE a.venue_id = v.id) as admin_count, "
        "(SELECT COUNT(*) FROM queue_songs qs WHERE qs.venue_id = v.id AND qs.status IN ('pending','playing')) as queue_count, "
        "(SELECT COUNT(*) FROM user_sessions us WHERE us.venue_id = v.id AND us.ended_at IS NULL) as active_sessions, "
        "v.paid_until, v.payment_notes, "
        "(SELECT MAX(ph.played_at) FROM play_history ph WHERE ph.venue_id = v.id) as last_used_at, "
        "(SELECT MAX(a.last_login_at) FROM admins a WHERE a.venue_id = v.id) as last_admin_login, "
        # paid_until ya no distingue trial de pago: el signup tambien lo setea.
        # El estado real es el kind del ultimo movimiento no anulado.
        "(SELECT e.kind FROM venue_billing_events e WHERE e.venue_id = v.id AND e.status != 'voided' "
        " ORDER BY e.created_at DESC, e.id DESC LIMIT 1) as last_billing_kind "
        "FROM venues v ORDER BY last_used_at DESC"
    )
    grace_period_days = (await get_platform_settings())["grace_period_days"]
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
            "paid_until": r[11], "payment_notes": r[12],
            "last_used_at": r[13],
            "last_admin_login": r[14],
            "on_trial": r[15] in ("trial", None),
            "payment_status": await compute_payment_status(r[11], grace_period_days),
        })
    return {"venues": venues, "kpis": kpis}


@router.post("/venues")
async def create_venue(req: CreateVenueRequest, admin: dict = Depends(require_role("vendedor", "super_admin"))):
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
        "INSERT INTO venues (name, slug, fallback_mode, config, active, logo_url, qr_url) "
        "VALUES (?, ?, 'playlist', ?, TRUE, ?, ?)",
        (req.name, req.slug, config, req.logo_url, req.qr_url),
    )
    venue_id = cursor.lastrowid
    await billing_service.record_event(
        venue_id,
        "trial",
        req.trial_days,
        source="manual",
        created_by_id=admin["super_admin_id"],
        created_by_username=admin["username"],
    )

    # Create admin for this venue
    password_hash = (await asyncio.to_thread(bcrypt.hashpw, req.admin_password.encode(), bcrypt.gensalt())).decode()
    await db.execute(
        # El superadmin ya capturo los datos a mano: mandarlo al wizard de onboarding
        # solo le bloquea el panel al bar recien dado de alta.
        "INSERT INTO admins (venue_id, username, password_hash, email, phone, address, city, "
        "onboarding_completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
        (venue_id, req.admin_username, password_hash, req.admin_email,
         req.admin_phone, req.admin_address, req.admin_city),
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
                       admin: dict = Depends(require_role("editor", "super_admin"))):
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
async def delete_venue(venue_id: int, admin: dict = Depends(require_role("super_admin"))):
    db = await get_db()

    # Delete all related data. All of these have a NOT-NULL (or nullable, for
    # blocked_videos) FK to venues without ON DELETE CASCADE, so with
    # foreign_keys=ON the final DELETE FROM venues 500s unless every child
    # table is cleared first.
    await db.execute("DELETE FROM submission_log WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM play_history WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM queue_songs WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM user_sessions WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM admins WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM fallback_songs WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM venue_daily_pins WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM analytics_events WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM blocked_videos WHERE venue_id = ?", (venue_id,))
    await db.execute("DELETE FROM venues WHERE id = ?", (venue_id,))
    await db.commit()

    return {"message": "Venue deleted permanently"}


@router.get("/venues/{venue_id}/stats")
async def venue_stats(venue_id: int, admin: dict = Depends(get_current_super_admin)):
    db = await get_db()

    rows = await db.execute_fetchall("SELECT name, slug, active, created_at, logo_url, qr_url, config, paid_until, payment_notes FROM venues WHERE id = ?", (venue_id,))
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

    billing_rows = await db.execute_fetchall(
        "SELECT id, kind, source, amount_cents, days, period_start, period_end, "
        "created_by_username, notes, created_at, provider_ref, status "
        "FROM venue_billing_events WHERE venue_id = ? "
        "ORDER BY created_at DESC, id DESC LIMIT 12",
        (venue_id,),
    )
    current_billing = next((event for event in billing_rows if event[11] != "voided"), None)
    period_start = current_billing[5] if current_billing else None
    period_end = current_billing[6] if current_billing else v[7]
    days_remaining = None
    if period_end:
        try:
            days_remaining = (date.fromisoformat(period_end) - date.today()).days
        except (TypeError, ValueError):
            pass
    payment_status = await compute_payment_status(v[7])

    return {
        "venue": {"id": venue_id, "name": v[0], "slug": v[1], "active": bool(v[2]), "created_at": v[3], "logo_url": v[4], "qr_url": v[5], "config": v[6], "paid_until": v[7], "payment_notes": v[8], "payment_status": payment_status},
        "stats": {
            "total_songs_played": s[0], "total_users": s[1],
            "active_sessions": s[2], "songs_in_queue": s[3],
        },
        "admins": [{"id": a[0], "username": a[1], "created_at": a[2]} for a in admins],
        "billing": {
            "status": payment_status,
            "period_start": period_start,
            "period_end": period_end,
            "days_remaining": days_remaining,
            "history": [
                {
                    "id": event[0], "kind": event[1], "source": event[2],
                    "amount_cents": event[3], "days": event[4],
                    "period_start": event[5], "period_end": event[6],
                    "created_by_username": event[7], "notes": event[8],
                    "created_at": event[9], "provider_ref": event[10],
                    "status": event[11],
                }
                for event in billing_rows
            ],
        },
    }


@router.get("/venues/{venue_id}/analytics")
async def venue_analytics(venue_id: int, period: str = Query("week", pattern="^(day|week|month|all)$"),
                          admin: dict = Depends(get_current_super_admin)):
    return await analytics_service.get_daily_analytics(venue_id, period)


@router.get("/venues/{venue_id}/users")
async def get_venue_users(venue_id: int, admin: dict = Depends(get_current_super_admin)):
    db = await get_db()
    # ponytail: data_consent hoy siempre da true porque es requisito obligatorio en el registro
    # de usuarios (auth.py), no representa un opt-in real de marketing/contacto.
    # Si se requiere opt-in voluntario, requiere feature y migración aparte.
    query = """
        WITH user_stats AS (
            SELECT
                user_id,
                MIN(started_at) as first_seen_at_venue,
                MAX(started_at) as last_connection,
                COUNT(DISTINCT date(started_at)) as distinct_days
            FROM user_sessions
            WHERE venue_id = ?
            GROUP BY user_id
        ),
        latest_session AS (
            SELECT
                user_id,
                table_number,
                ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY started_at DESC, id DESC) as rn
            FROM user_sessions
            WHERE venue_id = ?
        )
        SELECT
            u.id,
            u.phone,
            u.display_name,
            u.created_at,
            u.data_consent,
            ust.first_seen_at_venue,
            ust.last_connection,
            ls.table_number,
            ust.distinct_days > 1 as is_recurring,
            (SELECT COUNT(*) FROM queue_songs qs WHERE qs.user_id = u.id AND qs.venue_id = ?) as songs_count
        FROM users u
        JOIN user_stats ust ON ust.user_id = u.id
        JOIN latest_session ls ON ls.user_id = u.id AND ls.rn = 1
        WHERE u.phone != 'admin'
        ORDER BY ust.last_connection DESC
    """
    rows = await db.execute_fetchall(query, (venue_id, venue_id, venue_id))
    return {
        "users": [
            {
                "id": r[0],
                "phone": r[1],
                "display_name": r[2],
                "created_at": r[3],
                "data_consent": bool(r[4]),
                "first_seen_at_venue": r[5],
                "last_connection": r[6],
                "table_number": r[7],
                "is_recurring": bool(r[8]),
                "songs_count": r[9],
            }
            for r in rows
        ]
    }


class AddAdminRequest(BaseModel):
    username: str
    password: str


@router.post("/venues/{venue_id}/admins")
async def add_venue_admin(venue_id: int, req: AddAdminRequest,
                          admin: dict = Depends(require_role("super_admin"))):
    db = await get_db()

    if not await db.execute_fetchall("SELECT id FROM venues WHERE id = ?", (venue_id,)):
        raise HTTPException(status_code=404, detail="Bar no encontrado")

    existing = await db.execute_fetchall("SELECT id FROM admins WHERE username = ?", (req.username,))
    if existing:
        raise HTTPException(status_code=409, detail="Este nombre de usuario ya existe")

    password_hash = (await asyncio.to_thread(bcrypt.hashpw, req.password.encode(), bcrypt.gensalt())).decode()
    await db.execute(
        # Alta manual: el superadmin ya hizo el onboarding, no lo repite el admin.
        "INSERT INTO admins (venue_id, username, password_hash, onboarding_completed_at) "
        "VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        (venue_id, req.username, password_hash),
    )
    await db.commit()
    return {"message": f"Admin '{req.username}' added to venue"}


@router.delete("/venues/{venue_id}/admins/{admin_id}")
async def remove_venue_admin(venue_id: int, admin_id: int,
                             admin: dict = Depends(require_role("super_admin"))):
    db = await get_db()
    # Borrar el ultimo admin deja el bar sin nadie que pueda entrar al panel.
    remaining = await db.execute_fetchall(
        "SELECT COUNT(*) FROM admins WHERE venue_id = ? AND id != ?", (venue_id, admin_id))
    if not remaining[0][0]:
        raise HTTPException(status_code=409, detail="Es el unico admin del bar. Crea otro antes de borrarlo.")
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
    from app.main import get_logos_dir
    logos_dir = get_logos_dir()

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


@router.post("/venues/{venue_id}/mark-paid")
async def mark_venue_paid(venue_id: int, req: MarkPaidRequest,
                          admin: dict = Depends(require_role("super_admin"))):
    """Mark a venue as paid, extending paid_until by N months."""
    settings = await get_platform_settings()
    amount_cents = req.amount_cents if req.amount_cents is not None else settings["monthly_price_cents"]
    try:
        new_paid_until = await billing_service.record_event(
            venue_id,
            "payment",
            days=30 * req.months,
            amount_cents=amount_cents,
            source="manual",
            created_by_id=admin["super_admin_id"],
            created_by_username=admin["username"],
            notes=req.notes,
        )
    except ValueError as exc:
        if str(exc) == "VENUE_NOT_FOUND":
            raise HTTPException(status_code=404, detail="Bar no encontrado") from exc
        raise

    return {
        "message": f"Pago registrado. Pagado hasta {new_paid_until}",
        "paid_until": new_paid_until,
        "payment_status": "active",
    }


@router.post("/venues/{venue_id}/extend-trial")
async def extend_venue_trial(
    venue_id: int,
    req: ExtendTrialRequest,
    admin: dict = Depends(require_role("super_admin")),
):
    if req.days not in {7, 15, 30}:
        raise HTTPException(status_code=400, detail="Los días deben ser 7, 15 o 30")

    try:
        new_paid_until = await billing_service.record_event(
            venue_id,
            "trial",
            days=req.days,
            source="manual",
            created_by_id=admin["super_admin_id"],
            created_by_username=admin["username"],
        )
    except ValueError as exc:
        if str(exc) == "VENUE_NOT_FOUND":
            raise HTTPException(status_code=404, detail="Bar no encontrado") from exc
        raise
    return {"paid_until": new_paid_until}


@router.post("/venues/{venue_id}/billing/events/{event_id}/void")
async def void_billing_event(
    venue_id: int,
    event_id: int,
    admin: dict = Depends(require_role("super_admin")),
):
    try:
        return await billing_service.void_event(venue_id, event_id)
    except ValueError as exc:
        if str(exc) == "BILLING_EVENT_NOT_FOUND":
            raise HTTPException(status_code=404, detail="Movimiento no encontrado") from exc
        if str(exc) == "BILLING_EVENT_ALREADY_VOIDED":
            raise HTTPException(status_code=400, detail="Este movimiento ya esta anulado") from exc
        raise


@router.patch("/venues/{venue_id}/billing/events/{event_id}")
async def update_billing_event(
    venue_id: int,
    event_id: int,
    req: UpdateBillingEventRequest,
    admin: dict = Depends(require_role("super_admin")),
):
    try:
        event = await billing_service.update_event_notes(venue_id, event_id, req.notes)
    except ValueError as exc:
        if str(exc) == "BILLING_EVENT_NOT_FOUND":
            raise HTTPException(status_code=404, detail="Movimiento no encontrado") from exc
        raise
    return {"event": event}


# ===== SUPER ADMIN USERS (CRUD) =====

@router.get("/admins")
async def list_super_admins(admin: dict = Depends(require_role("super_admin"))):
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT id, username, role, created_at, phone, email FROM super_admins ORDER BY id ASC"
    )
    return {
        "admins": [
            {
                "id": r[0],
                "username": r[1],
                "role": r[2] or "super_admin",
                "created_at": r[3],
                "phone": r[4],
                "email": r[5],
            }
            for r in rows
        ]
    }


@router.post("/admins")
async def create_super_admin(req: CreateSuperAdminRequest, admin: dict = Depends(require_role("super_admin"))):
    username = req.username.strip()
    phone = req.phone.strip()
    email = req.email.strip()
    if not username:
        raise HTTPException(status_code=400, detail="El nombre de usuario es requerido")
    if not req.password:
        raise HTTPException(status_code=400, detail="La contraseña es requerida")
    if not phone:
        raise HTTPException(status_code=400, detail="El teléfono es requerido")
    if not email:
        raise HTTPException(status_code=400, detail="El correo electrónico es requerido")
    if req.role not in VALID_SUPER_ADMIN_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Rol inválido '{req.role}'. Debe ser 'super_admin', 'vendedor' o 'editor'",
        )

    db = await get_db()
    existing = await db.execute_fetchall("SELECT id FROM super_admins WHERE username = ?", (username,))
    if existing:
        raise HTTPException(status_code=409, detail=f"El usuario '{username}' ya existe")

    password_hash = (await asyncio.to_thread(bcrypt.hashpw, req.password.encode(), bcrypt.gensalt())).decode()
    cursor = await db.execute(
        "INSERT INTO super_admins (username, password_hash, role, phone, email) VALUES (?, ?, ?, ?, ?)",
        (username, password_hash, req.role, phone, email),
    )
    await db.commit()
    admin_id = cursor.lastrowid

    row = await db.execute_fetchall("SELECT created_at FROM super_admins WHERE id = ?", (admin_id,))
    created_at = row[0][0] if row else None

    return {
        "message": "Administrador creado exitosamente",
        "admin": {
            "id": admin_id,
            "username": username,
            "role": req.role,
            "phone": phone,
            "email": email,
            "created_at": created_at,
        },
    }


@router.patch("/admins/{admin_id}")
async def update_super_admin(
    admin_id: int,
    req: UpdateSuperAdminRequest,
    admin: dict = Depends(require_role("super_admin")),
):
    if req.role is None and req.password is None:
        raise HTTPException(status_code=422, detail="Indica al menos un campo a actualizar")

    db = await get_db()
    rows = await db.execute_fetchall("SELECT id, username, role FROM super_admins WHERE id = ?", (admin_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")

    current_target_role = rows[0][2] or "super_admin"

    if req.role is not None:
        if req.role not in VALID_SUPER_ADMIN_ROLES:
            raise HTTPException(
                status_code=400,
                detail=f"Rol inválido '{req.role}'. Debe ser 'super_admin', 'vendedor' o 'editor'",
            )
        if current_target_role == "super_admin" and req.role != "super_admin":
            sa_counts = await db.execute_fetchall("SELECT COUNT(*) FROM super_admins WHERE COALESCE(role, 'super_admin') = 'super_admin'")
            if sa_counts and sa_counts[0][0] <= 1:
                raise HTTPException(status_code=400, detail="No se puede cambiar el rol del último super admin restante")
        await db.execute("UPDATE super_admins SET role = ? WHERE id = ?", (req.role, admin_id))

    if req.password is not None:
        if not req.password:
            raise HTTPException(status_code=400, detail="La contraseña no puede estar vacía")
        password_hash = (await asyncio.to_thread(bcrypt.hashpw, req.password.encode(), bcrypt.gensalt())).decode()
        await db.execute("UPDATE super_admins SET password_hash = ? WHERE id = ?", (password_hash, admin_id))

    await db.commit()
    return {"message": "Administrador actualizado exitosamente"}


@router.delete("/admins/{admin_id}")
async def delete_super_admin(
    admin_id: int,
    admin: dict = Depends(require_role("super_admin")),
):
    db = await get_db()
    rows = await db.execute_fetchall("SELECT id, username, role FROM super_admins WHERE id = ?", (admin_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")

    target_id = rows[0][0]
    target_username = rows[0][1]
    target_role = rows[0][2] or "super_admin"

    current_admin_id = admin.get("super_admin_id")
    if current_admin_id == target_id or admin.get("username") == target_username:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")

    if target_role == "super_admin":
        sa_counts = await db.execute_fetchall("SELECT COUNT(*) FROM super_admins WHERE COALESCE(role, 'super_admin') = 'super_admin'")
        if sa_counts and sa_counts[0][0] <= 1:
            raise HTTPException(status_code=400, detail="No se puede eliminar el último super admin restante")

    await db.execute("DELETE FROM super_admins WHERE id = ?", (admin_id,))
    await db.commit()
    return {"message": "Administrador eliminado exitosamente"}
