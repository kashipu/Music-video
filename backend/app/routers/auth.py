from fastapi import APIRouter, HTTPException, Depends, Header, Query

from app.models.schemas import RegisterRequest, ProfileUpdateRequest
from app.services import auth_service, queue_service
from app.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesion invalida")
    token = authorization[7:]
    try:
        payload = auth_service.decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Sesion expirada, vuelve a iniciar")

    # Check session not expired by inactivity or max duration
    session_id = payload.get("session_id")
    if session_id:
        try:
            if await auth_service.is_session_expired(session_id):
                await auth_service.expire_session(session_id)
                raise HTTPException(status_code=401, detail="Sesion expirada por inactividad, vuelve a registrarte")
        except HTTPException:
            raise
        except Exception:
            pass  # Column may not exist yet if migration 009 hasn't run

    return payload


@router.post("/register", status_code=201)
async def register(req: RegisterRequest):
    if not req.data_consent:
        raise HTTPException(status_code=400, detail="Debes aceptar el uso de datos", headers={"X-Error-Code": "CONSENT_REQUIRED"})

    phone = req.phone.strip()
    if len(phone) < 8:
        raise HTTPException(status_code=422, detail="Formato de telefono invalido", headers={"X-Error-Code": "INVALID_PHONE"})

    # Verify daily PIN if required
    db = await get_db()
    venue_rows = await db.execute_fetchall(
        "SELECT id FROM venues WHERE slug = ?", (req.venue_slug,)
    )
    if venue_rows:
        venue_id = venue_rows[0][0]
        if await auth_service.is_pin_required(venue_id):
            if not req.pin:
                raise HTTPException(
                    status_code=400,
                    detail="Codigo PIN requerido. Miralo en la pantalla del bar.",
                    headers={"X-Error-Code": "PIN_REQUIRED"},
                )
            if not await auth_service.verify_daily_pin(venue_id, req.pin):
                raise HTTPException(
                    status_code=403,
                    detail="Codigo PIN incorrecto",
                    headers={"X-Error-Code": "PIN_INVALID"},
                )

    try:
        result = await auth_service.register_user(
            phone=phone,
            table_number=req.table_number,
            venue_slug=req.venue_slug,
            data_consent=req.data_consent,
            display_name=req.display_name,
        )
    except ValueError as e:
        if str(e) == "VENUE_NOT_FOUND":
            raise HTTPException(status_code=404, detail="Bar no encontrado", headers={"X-Error-Code": "VENUE_NOT_FOUND"})
        if str(e) == "VENUE_INACTIVE":
            raise HTTPException(status_code=403, detail="Este bar no esta disponible en este momento")
        raise

    # Notify admin that a new table/user registered
    from app.routers.websocket import manager
    db = await get_db()
    venue_rows = await db.execute_fetchall(
        "SELECT id FROM venues WHERE slug = ?", (req.venue_slug,)
    )
    if venue_rows:
        await manager.broadcast(venue_rows[0][0], {
            "event": "table_registered",
            "data": {
                "table_number": req.table_number,
                "user_name": req.display_name or phone,
            },
        })

    return result


@router.get("/session")
async def get_session(user: dict = Depends(get_current_user)):
    db = await get_db()
    user_rows = await db.execute_fetchall(
        "SELECT id, phone, display_name FROM users WHERE id = ?",
        (user["user_id"],),
    )
    if not user_rows:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Update session activity (heartbeat)
    session_id = user.get("session_id")
    if session_id:
        try:
            await auth_service.update_session_activity(session_id)
        except Exception:
            pass  # Column may not exist yet if migration 009 hasn't run

    u = user_rows[0]
    session_info = await auth_service.get_session_info(user["user_id"], user["venue_id"])
    rate_info = await queue_service.get_rate_limit_info(user["user_id"], user["venue_id"])

    return {
        "user": {"id": u[0], "phone": u[1], "display_name": u[2]},
        "session": session_info,
        "rate_limit": {
            "songs_remaining": rate_info["songs_remaining"],
            "window_resets_at": rate_info["window_resets_at"],
        },
    }


@router.patch("/profile")
async def update_profile(req: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    db = await get_db()
    await db.execute(
        "UPDATE users SET display_name = ? WHERE id = ?",
        (req.display_name, user["user_id"]),
    )
    await db.commit()

    user_rows = await db.execute_fetchall(
        "SELECT id, phone, display_name FROM users WHERE id = ?",
        (user["user_id"],),
    )
    u = user_rows[0]
    return {"id": u[0], "phone": u[1], "display_name": u[2]}


@router.get("/venue-info")
async def venue_info(venue_slug: str = Query(...)):
    """Public endpoint to check venue status and PIN requirement."""
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT id, name, active, logo_url, config FROM venues WHERE slug = ?", (venue_slug,)
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Bar no encontrado")

    venue_id = rows[0][0]
    pin_required = await auth_service.is_pin_required(venue_id)

    # Parse theme from config
    theme = None
    if rows[0][4]:
        try:
            import json
            cfg = json.loads(rows[0][4])
            theme = cfg.get("theme")
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "venue_name": rows[0][1],
        "active": bool(rows[0][2]),
        "logo_url": rows[0][3],
        "pin_required": pin_required,
        "theme": theme,
    }
