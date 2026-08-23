import asyncio
import hashlib
import logging
import re
import secrets
import unicodedata
from datetime import datetime, timedelta, timezone

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import settings
from app.database import get_db
from app.services import auth_service

logger = logging.getLogger(__name__)
TOKEN_HOURS = {"verify": 24, "reset": 1}


def _slugify(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", normalized)).strip("-") or "bar"


async def _unique_slug(name: str) -> str:
    db = await get_db()
    base = _slugify(name)
    slug = base
    suffix = 2
    while await db.execute_fetchall("SELECT id FROM venues WHERE slug = ?", (slug,)):
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug


async def _platform_trial_days() -> int:
    db = await get_db()
    rows = await db.execute_fetchall("SELECT trial_days FROM platform_settings WHERE id = 1")
    return rows[0][0] if rows else 15


async def create_admin_with_trial(venue_name: str, email: str, password: str,
                                  terms_version: str, google_sub: str | None = None,
                                  email_verified: bool = False) -> dict:
    db = await get_db()
    venue_name = venue_name.strip()
    email = email.strip().lower()
    if not venue_name or "@" not in email:
        raise ValueError("INVALID_SIGNUP")
    existing = await db.execute_fetchall("SELECT id FROM admins WHERE email = ? OR username = ?", (email, email))
    if existing:
        raise ValueError("EMAIL_EXISTS")

    slug = await _unique_slug(venue_name)
    paid_until = (datetime.now(timezone.utc).date() + timedelta(days=await _platform_trial_days())).isoformat()
    password_hash = await auth_service.hash_password(password)
    try:
        await db.execute("BEGIN")
        venue = await db.execute(
            "INSERT INTO venues (name, slug, fallback_mode, active, paid_until) VALUES (?, ?, 'playlist', TRUE, ?)",
            (venue_name, slug, paid_until),
        )
        admin = await db.execute(
            "INSERT INTO admins (venue_id, username, password_hash, email, email_verified, google_sub, "
            "terms_accepted_at, terms_version, privacy_accepted_at) "
            "VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)",
            (venue.lastrowid, email, password_hash, email, email_verified, google_sub, terms_version),
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return {"id": admin.lastrowid, "username": email, "venue_id": venue.lastrowid,
            "venue_name": venue_name, "venue_slug": slug, "paid_until": paid_until}


async def create_email_token(admin_id: int, purpose: str) -> str:
    if purpose not in TOKEN_HOURS:
        raise ValueError("INVALID_TOKEN_PURPOSE")
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS[purpose])).isoformat()
    db = await get_db()
    await db.execute(
        "INSERT INTO email_tokens (admin_id, token_hash, purpose, expires_at) VALUES (?, ?, ?, ?)",
        (admin_id, token_hash, purpose, expires_at),
    )
    await db.commit()
    return token


async def consume_email_token(token: str, purpose: str) -> int:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT id, admin_id, expires_at FROM email_tokens "
        "WHERE token_hash = ? AND purpose = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1",
        (token_hash, purpose),
    )
    if not rows:
        raise ValueError("INVALID_TOKEN")
    row = rows[0]
    expires_at = datetime.fromisoformat(str(row[2]).replace("Z", "+00:00"))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        raise ValueError("INVALID_TOKEN")
    result = await db.execute("UPDATE email_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL", (row[0],))
    if result.rowcount != 1:
        raise ValueError("INVALID_TOKEN")
    await db.commit()
    return row[1]


async def verify_email(token: str) -> None:
    admin_id = await consume_email_token(token, "verify")
    db = await get_db()
    await db.execute("UPDATE admins SET email_verified = TRUE WHERE id = ?", (admin_id,))
    await db.commit()


async def request_password_reset(email: str) -> str | None:
    db = await get_db()
    rows = await db.execute_fetchall("SELECT id FROM admins WHERE email = ?", (email.strip().lower(),))
    return await create_email_token(rows[0][0], "reset") if rows else None


async def reset_password(token: str, password: str) -> None:
    admin_id = await consume_email_token(token, "reset")
    db = await get_db()
    await db.execute("UPDATE admins SET password_hash = ? WHERE id = ?", (await auth_service.hash_password(password), admin_id))
    await db.commit()


async def verify_google_token(token: str) -> dict:
    client_id = settings.google_client_id
    if not client_id:
        raise ValueError("GOOGLE_NOT_CONFIGURED")
    try:
        info = await asyncio.to_thread(id_token.verify_oauth2_token, token, google_requests.Request(), client_id)
    except Exception as exc:
        raise ValueError("INVALID_GOOGLE_TOKEN") from exc
    if info.get("iss") not in {"accounts.google.com", "https://accounts.google.com"} or not info.get("sub") or not info.get("email"):
        raise ValueError("INVALID_GOOGLE_TOKEN")
    return info


async def google_signup(token: str, venue_name: str | None, terms_version: str) -> dict:
    info = await verify_google_token(token)
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT a.id, a.username, a.venue_id, v.name, v.slug, v.logo_url, v.qr_url, v.config "
        "FROM admins a JOIN venues v ON a.venue_id = v.id "
        "WHERE a.google_sub = ? OR a.email = ? OR a.username = ? LIMIT 1",
        (info["sub"], info["email"].lower(), info["email"].lower()),
    )
    if rows:
        admin = rows[0]
        await db.execute("UPDATE admins SET google_sub = ?, email_verified = TRUE WHERE id = ?", (info["sub"], admin[0]))
        await db.commit()
        return {"token": auth_service.create_admin_token(admin[0], admin[1], admin[2]), "admin": {
            "id": admin[0], "username": admin[1], "venue_id": admin[2], "venue_name": admin[3],
            "venue_slug": admin[4], "logo_url": admin[5], "qr_url": admin[6], "config": admin[7],
        }}
    if not venue_name:
        raise ValueError("VENUE_NAME_REQUIRED")
    admin = await create_admin_with_trial(venue_name, info["email"], secrets.token_urlsafe(32), terms_version, info["sub"], True)
    return {"token": auth_service.create_admin_token(admin["id"], admin["username"], admin["venue_id"]), "admin": admin}


def log_email_link(purpose: str, email: str, token: str) -> None:
    path = "verify-email" if purpose == "verify" else "reset-password"
    logger.warning("TODO email %s for %s: /%s?token=%s", purpose, email, path, token)
