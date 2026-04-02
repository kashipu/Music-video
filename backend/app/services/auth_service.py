import json
import random
import uuid
from datetime import datetime, timedelta, timezone, date

import jwt
import bcrypt

from app.config import settings
from app.database import get_db


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
                await db.commit()
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
    await db.commit()

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


def create_super_admin_token(admin_id: int, username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=24)
    payload = {
        "super_admin_id": admin_id,
        "username": username,
        "is_super_admin": True,
        "exp": exp,
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm="HS256")


async def verify_super_admin(username: str, password: str) -> dict | None:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT id, username, password_hash FROM super_admins WHERE username = ?",
        (username,),
    )
    if not rows:
        return None
    admin = rows[0]
    if not bcrypt.checkpw(password.encode(), admin[2].encode()):
        return None
    return {"id": admin[0], "username": admin[1]}


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.app_secret_key, algorithms=["HS256"])


async def verify_admin(username: str, password: str) -> dict | None:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT a.id, a.username, a.password_hash, a.venue_id, v.name, v.slug, v.logo_url, v.qr_url, v.config "
        "FROM admins a JOIN venues v ON a.venue_id = v.id "
        "WHERE a.username = ?",
        (username,),
    )
    if not rows:
        return None

    admin = rows[0]
    if not bcrypt.checkpw(password.encode(), admin[2].encode()):
        return None

    return {
        "id": admin[0],
        "username": admin[1],
        "venue_id": admin[3],
        "venue_name": admin[4],
        "venue_slug": admin[5],
        "logo_url": admin[6],
        "qr_url": admin[7],
        "config": admin[8],
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
        "INSERT INTO venue_daily_pins (venue_id, pin, valid_date) VALUES (?, ?, ?)",
        (venue_id, pin, today),
    )
    await db.commit()
    return pin


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
