import asyncio
import json
import random
import uuid
from datetime import datetime, timedelta, timezone, date

import jwt
import bcrypt

from app.config import settings
from app.database import get_db


async def _commit_with_retry(db, retries: int = 3, delay: float = 0.3):
    for attempt in range(retries):
        try:
            await db.commit()
            return
        except Exception as e:
            if "locked" in str(e) and attempt < retries - 1:
                await asyncio.sleep(delay * (attempt + 1))
            else:
                raise


async def hash_password(password: str) -> str:
    return (await asyncio.to_thread(bcrypt.hashpw, password.encode(), bcrypt.gensalt())).decode()


async def register_user(phone: str, table_number: str | None, venue_slug: str,
                        data_consent: bool, display_name: str | None = None) -> dict:
    db = await get_db()

    row = await db.execute_fetchall(
        "SELECT id, name, config, active, paid_until FROM venues WHERE slug = ?", (venue_slug,)
    )
    if not row:
        raise ValueError("VENUE_NOT_FOUND")
    if not row[0][3]:
        raise ValueError("VENUE_INACTIVE")

    # Auto-suspend if payment overdue past grace period
    paid_until = row[0][4]
    if paid_until:
        try:
            paid_date = date.fromisoformat(paid_until)
            if paid_date < date.today() - timedelta(days=5):
                await db.execute("UPDATE venues SET active = FALSE WHERE id = ?", (row[0][0],))
                await _commit_with_retry(db)
                raise ValueError("VENUE_INACTIVE")
        except ValueError as e:
            if str(e) == "VENUE_INACTIVE":
                raise

    venue_id = row[0][0]
    venue_name = row[0][1]
    venue_config = row[0][2]

    # Auto-generate a short unique ID if no table_number provided
    if not table_number:
        table_number = uuid.uuid4().hex[:6].upper()

    existing = await db.execute_fetchall(
        "SELECT id, display_name FROM users WHERE phone = ?", (phone,)
    )

    if existing:
        user_id = existing[0][0]
        if display_name:
            await db.execute(
                "UPDATE users SET display_name = ? WHERE id = ?",
                (display_name, user_id),
            )
    else:
        cursor = await db.execute(
            "INSERT INTO users (phone, display_name, data_consent) VALUES (?, ?, ?)",
            (phone, display_name, data_consent),
        )
        user_id = cursor.lastrowid

    # End previous active sessions for this user in this venue
    await db.execute(
        "UPDATE user_sessions SET ended_at = CURRENT_TIMESTAMP "
        "WHERE user_id = ? AND venue_id = ? AND ended_at IS NULL",
        (user_id, venue_id),
    )

    session_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO user_sessions (id, user_id, venue_id, table_number) VALUES (?, ?, ?, ?)",
        (session_id, user_id, venue_id, table_number),
    )
    await _commit_with_retry(db)

    token = create_token(user_id, phone, venue_id, table_number, session_id)

    # Log analytics event
    try:
        from app.services.analytics_service import log_event
        event_type = "user_returned" if existing else "user_registered"
        await log_event(venue_id, event_type, {"phone": phone}, user_id, session_id)
        await log_event(venue_id, "session_started", {"table_number": table_number}, user_id, session_id)
    except Exception:
        pass

    return {
        "token": token,
        "user": {
            "id": user_id,
            "phone": phone,
            "display_name": display_name,
        },
        "session": {
            "id": session_id,
            "table_number": table_number,
            "venue_slug": venue_slug,
            "venue_name": venue_name,
            "config": venue_config,
        },
    }


def create_token(user_id: int, phone: str, venue_id: int,
                 table_number: str, session_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiration_hours)
    payload = {
        "user_id": user_id,
        "phone": phone,
        "venue_id": venue_id,
        "table_number": table_number,
        "session_id": session_id,
        "exp": exp,
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm="HS256")


def create_admin_token(admin_id: int, username: str, venue_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_admin_expiration_hours)
    payload = {
        "admin_id": admin_id,
        "username": username,
        "venue_id": venue_id,
        "is_admin": True,
        "exp": exp,
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm="HS256")


def create_kiosk_token(venue_id: int) -> str:
    """Credencial de la pantalla del bar, atada a un venue y sin poderes de admin.

    La emite el admin autenticado al abrir el Kiosk; dura semanas porque la
    pantalla queda encendida sin nadie que vuelva a iniciar sesion.
    """
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_kiosk_expiration_hours)
    payload = {
        "venue_id": venue_id,
        "is_kiosk": True,
        "exp": exp,
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm="HS256")


def create_super_admin_token(admin_id: int, username: str, role: str = "super_admin") -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=24)
    payload = {
        "super_admin_id": admin_id,
        "username": username,
        "role": role,
        "is_super_admin": True,
        "exp": exp,
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm="HS256")


async def verify_super_admin(username: str, password: str) -> dict | None:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT id, username, password_hash, role FROM super_admins WHERE username = ?",
        (username,),
    )
    if not rows:
        return None
    admin = rows[0]
    # bcrypt takes 100-300ms of sync CPU — off the event loop so a login
    # never freezes every other request/WebSocket on the single worker
    if not await asyncio.to_thread(bcrypt.checkpw, password.encode(), admin[2].encode()):
        return None
    return {"id": admin[0], "username": admin[1], "role": admin[3] if len(admin) > 3 and admin[3] else "super_admin"}


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.app_secret_key, algorithms=["HS256"])


async def verify_admin(username: str, password: str) -> dict | None:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT a.id, a.username, a.password_hash, a.venue_id, v.name, v.slug, v.logo_url, v.logo_url_light, v.logo_url_dark, v.qr_url, v.config, a.onboarding_completed_at, "
        # El signup ya pidio estos datos; los devolvemos para precargar el onboarding.
        "a.phone, a.address, a.city, a.country, v.address "
        "FROM admins a JOIN venues v ON a.venue_id = v.id "
        "WHERE a.username = ?",
        (username,),
    )
    if not rows:
        return None

    admin = rows[0]
    # bcrypt takes 100-300ms of sync CPU — off the event loop so a login
    # never freezes every other request/WebSocket on the single worker
    if not await asyncio.to_thread(bcrypt.checkpw, password.encode(), admin[2].encode()):
        return None

    return {
        "id": admin[0],
        "username": admin[1],
        "venue_id": admin[3],
        "venue_name": admin[4],
        "venue_slug": admin[5],
        "logo_url": admin[6],
        "logo_url_light": admin[7],
        "logo_url_dark": admin[8],
        "qr_url": admin[9],
        "config": admin[10],
        "onboarding_completed_at": admin[11],
        "phone": admin[12],
        "city": admin[14],
        "country": admin[15],
        "venue_address": admin[16] or admin[13],
    }


async def get_or_create_daily_pin(venue_id: int) -> str:
    """Get today's PIN for a venue, or create one if it doesn't exist."""
    db = await get_db()
    today = date.today().isoformat()

    rows = await db.execute_fetchall(
        "SELECT pin FROM venue_daily_pins WHERE venue_id = ? AND valid_date = ?",
        (venue_id, today),
    )
    if rows:
        return rows[0][0]

    pin = ''.join(random.choices('0123456789', k=4))
    await db.execute(
        "INSERT OR IGNORE INTO venue_daily_pins (venue_id, pin, valid_date) VALUES (?, ?, ?)",
        (venue_id, pin, today),
    )
    await _commit_with_retry(db)

    # A concurrent request may have won the INSERT with a different PIN — read back
    # whichever one actually landed instead of trusting the one generated here.
    rows = await db.execute_fetchall(
        "SELECT pin FROM venue_daily_pins WHERE venue_id = ? AND valid_date = ?",
        (venue_id, today),
    )
    return rows[0][0]


async def verify_daily_pin(venue_id: int, pin: str) -> bool:
    """Verify a PIN matches today's PIN for the venue."""
    db = await get_db()
    today = date.today().isoformat()

    rows = await db.execute_fetchall(
        "SELECT id FROM venue_daily_pins WHERE venue_id = ? AND pin = ? AND valid_date = ?",
        (venue_id, pin, today),
    )
    return len(rows) > 0


async def is_pin_required(venue_id: int) -> bool:
    """Check if PIN verification is required for this venue."""
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT config FROM venues WHERE id = ?", (venue_id,),
    )
    if rows and rows[0][0]:
        try:
            config = json.loads(rows[0][0])
            return config.get("require_pin", False)
        except (json.JSONDecodeError, TypeError):
            pass
    return False


async def update_session_activity(session_id: str) -> None:
    """Update last_activity_at for the session (heartbeat)."""
    db = await get_db()
    await db.execute(
        "UPDATE user_sessions SET last_activity_at = CURRENT_TIMESTAMP "
        "WHERE id = ? AND ended_at IS NULL",
        (session_id,),
    )


async def is_session_expired(session_id: str) -> bool:
    """Check if session should be expired (inactivity or max duration)."""
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT started_at, last_activity_at, ended_at FROM user_sessions WHERE id = ?",
        (session_id,),
    )
    if not rows:
        return True
    started_at, last_activity, ended_at = rows[0][0], rows[0][1], rows[0][2]
    if ended_at:
        return True

    now = datetime.now(timezone.utc)

    # Hard max duration (default 24h)
    if started_at:
        try:
            started = datetime.fromisoformat(str(started_at))
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            if (now - started).total_seconds() > settings.session_max_hours * 3600:
                return True
        except (ValueError, TypeError):
            pass

    # Inactivity timeout (default 2h)
    activity_ts = last_activity or started_at
    if activity_ts:
        try:
            last = datetime.fromisoformat(str(activity_ts))
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if (now - last).total_seconds() > settings.session_inactivity_minutes * 60:
                return True
        except (ValueError, TypeError):
            pass

    return False


async def expire_session(session_id: str) -> None:
    """Mark a session as ended."""
    db = await get_db()
    await db.execute(
        "UPDATE user_sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ? AND ended_at IS NULL",
        (session_id,),
    )
    await _commit_with_retry(db)


async def expire_stale_sessions() -> int:
    """Expire all sessions that exceed max duration or inactivity timeout. Returns count expired."""
    db = await get_db()
    inactivity_minutes = settings.session_inactivity_minutes
    max_hours = settings.session_max_hours

    result = await db.execute(
        "UPDATE user_sessions SET ended_at = CURRENT_TIMESTAMP "
        "WHERE ended_at IS NULL AND ("
        "  started_at < datetime('now', ? || ' hours') OR "
        "  COALESCE(last_activity_at, started_at) < datetime('now', ? || ' minutes')"
        ")",
        (f"-{max_hours}", f"-{inactivity_minutes}"),
    )
    await _commit_with_retry(db)
    return result.rowcount


async def get_session_info(user_id: int, venue_id: int) -> dict | None:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT us.id, us.table_number, us.started_at, v.slug "
        "FROM user_sessions us JOIN venues v ON us.venue_id = v.id "
        "WHERE us.user_id = ? AND us.venue_id = ? AND us.ended_at IS NULL "
        "ORDER BY us.started_at DESC LIMIT 1",
        (user_id, venue_id),
    )
    if not rows:
        return None
    row = rows[0]
    return {
        "id": row[0],
        "table_number": row[1],
        "started_at": row[2],
        "venue_slug": row[3],
    }
