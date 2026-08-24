import time
from collections import defaultdict

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_db
from app.models.schemas import AdminLoginRequest
from app.services import admin_signup_service, auth_service

router = APIRouter(prefix="/api/admin", tags=["admin-auth"])
_attempts = defaultdict(list)


async def limit_auth_attempts(request: Request):
    # ponytail: in-memory limit is per single worker; use shared storage if workers scale.
    key = (request.client.host if request.client else "unknown", request.url.path)
    now = time.monotonic()
    attempts = [attempt for attempt in _attempts[key] if now - attempt < 60]
    if len(attempts) >= 5:
        raise HTTPException(status_code=429, detail="Demasiados intentos. Intenta de nuevo en un minuto")
    attempts.append(now)
    _attempts[key] = attempts


async def valid_turnstile(token: str | None) -> bool:
    # ponytail: local development has no secret; production must configure one to accept signups.
    if not settings.turnstile_secret_key:
        return True
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", data={
                "secret": settings.turnstile_secret_key, "response": token,
            })
        return response.is_success and response.json().get("success") is True
    except (httpx.HTTPError, ValueError):
        return False


class AdminSignupRequest(BaseModel):
    venue_name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    phone: str
    address: str
    city: str
    country: str
    terms_version: str = Field(min_length=1, max_length=50)
    terms_accepted: bool
    privacy_accepted: bool
    turnstile_token: str | None = None


class TokenRequest(BaseModel):
    token: str = Field(min_length=1)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class ResetPasswordRequest(TokenRequest):
    password: str = Field(min_length=8, max_length=128)


class GoogleSignupRequest(BaseModel):
    token: str = Field(min_length=1)
    venue_name: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    terms_version: str = Field(min_length=1, max_length=50)
    terms_accepted: bool
    privacy_accepted: bool
    turnstile_token: str | None = None


@router.post("/login")
async def admin_login(req: AdminLoginRequest, _: None = Depends(limit_auth_attempts)):
    admin = await auth_service.verify_admin(req.username, req.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Usuario o contrasena incorrectos")

    db = await get_db()
    venue_check = await db.execute_fetchall("SELECT id, slug, active FROM venues WHERE id = ?", (admin["venue_id"],))
    if venue_check and not venue_check[0][2]:
        raise HTTPException(status_code=403, detail="Este bar esta inactivo. Contacta al administrador.")
    if req.venue_slug:
        venue_rows = await db.execute_fetchall("SELECT id, slug FROM venues WHERE slug = ?", (req.venue_slug,))
        if not venue_rows:
            raise HTTPException(status_code=404, detail="Bar no encontrado")
        if admin["venue_id"] != venue_rows[0][0]:
            raise HTTPException(status_code=403, detail="Este usuario no pertenece a este bar")
    await db.execute("UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", (admin["id"],))
    return {"token": auth_service.create_admin_token(admin["id"], admin["username"], admin["venue_id"]), "admin": admin}


@router.post("/signup", status_code=201)
async def signup(req: AdminSignupRequest, _: None = Depends(limit_auth_attempts)):
    if not req.terms_accepted or not req.privacy_accepted:
        raise HTTPException(status_code=400, detail="Debes aceptar los terminos y el tratamiento de datos")
    if not await valid_turnstile(req.turnstile_token):
        raise HTTPException(status_code=400, detail="Verificacion anti-bot invalida")
    try:
        admin = await admin_signup_service.create_admin_with_trial(
            req.venue_name, req.email, req.password, req.terms_version,
            req.phone, req.address, req.city, req.country,
        )
    except ValueError as exc:
        if str(exc) == "EMAIL_EXISTS":
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con este correo")
        if str(exc) == "INVALID_SIGNUP":
            raise HTTPException(status_code=422, detail="Datos de registro invalidos")
        raise
    token = await admin_signup_service.create_email_token(admin["id"], "verify")
    await admin_signup_service.send_verification_email(req.email, token)
    return {"message": "Cuenta creada. Revisa tu correo para verificarla.", "venue_slug": admin["venue_slug"]}


@router.post("/verify-email")
async def verify_email(req: TokenRequest, _: None = Depends(limit_auth_attempts)):
    try:
        await admin_signup_service.verify_email(req.token)
    except ValueError:
        raise HTTPException(status_code=400, detail="Token invalido o vencido")
    return {"message": "Correo verificado"}


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, _: None = Depends(limit_auth_attempts)):
    await admin_signup_service.request_password_reset(req.email)
    return {"message": "Si el correo existe, te enviamos instrucciones"}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, _: None = Depends(limit_auth_attempts)):
    try:
        await admin_signup_service.reset_password(req.token, req.password)
    except ValueError:
        raise HTTPException(status_code=400, detail="Token invalido o vencido")
    return {"message": "Contrasena actualizada"}


@router.post("/google-signup", status_code=201)
async def google_signup(req: GoogleSignupRequest, _: None = Depends(limit_auth_attempts)):
    if not req.terms_accepted or not req.privacy_accepted:
        raise HTTPException(status_code=400, detail="Debes aceptar los terminos y el tratamiento de datos")
    if not await valid_turnstile(req.turnstile_token):
        raise HTTPException(status_code=400, detail="Verificacion anti-bot invalida")
    try:
        return await admin_signup_service.google_signup(
            req.token, req.venue_name, req.terms_version,
            req.phone, req.address, req.city, req.country,
        )
    except ValueError as exc:
        messages = {
            "GOOGLE_NOT_CONFIGURED": (503, "Google Sign-In no esta configurado"),
        }
        status, detail = messages.get(str(exc), (401, "Token de Google invalido"))
        raise HTTPException(status_code=status, detail=detail)


@router.get("/trial-info")
async def trial_info():
    db = await get_db()
    rows = await db.execute_fetchall("SELECT trial_days FROM platform_settings WHERE id = 1")
    return {"trial_days": rows[0][0] if rows else 15}
