import hashlib
import time
from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException

from app.config import settings
from app.database import get_db
from app.routers.superadmin import compute_payment_status, get_platform_settings
from app.services import auth_service

router = APIRouter(prefix="/api/admin", tags=["billing"])

# ponytail: plan único; multi-plan = tabla plans + plan_id en checkout/webhook
PLAN_DAYS = 30


async def get_current_admin(authorization: str | None = Header(None)) -> dict:
    # Sin el check de suspensión de admin.get_current_admin: el dueño del bar
    # tiene que poder ver su estado y pagar aunque esté suspendido.
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


@router.get("/billing")
async def get_billing(admin: dict = Depends(get_current_admin)):
    db = await get_db()
    venue_id = admin["venue_id"]

    rows = await db.execute_fetchall("SELECT paid_until FROM venues WHERE id = ?", (venue_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Bar no encontrado")
    paid_until = rows[0][0]

    payment_status = await compute_payment_status(paid_until)
    days_remaining = None
    if paid_until:
        try:
            days_remaining = (date.fromisoformat(paid_until) - date.today()).days
        except (TypeError, ValueError):
            pass

    # Solo pagos y pruebas: los ajustes/registros internos del superadmin no se
    # muestran al dueño del bar (ve el resultado en sus fechas, no la corrección).
    events = await db.execute_fetchall(
        "SELECT id, kind, source, amount_cents, days, period_start, period_end, created_at, status "
        "FROM venue_billing_events WHERE venue_id = ? AND status NOT IN ('declined', 'pending') "
        "AND kind IN ('payment', 'trial') "
        "ORDER BY created_at DESC, id DESC LIMIT 12",
        (venue_id,),
    )
    current = next((e for e in events if e[8] != "voided"), None)
    settings_row = await get_platform_settings()

    return {
        "payment_status": payment_status,
        "paid_until": paid_until,
        "period_start": current[5] if current else None,
        "days_remaining": days_remaining,
        "monthly_price_cents": settings_row["monthly_price_cents"],
        "history": [
            {
                "id": e[0], "kind": e[1], "source": e[2], "amount_cents": e[3], "days": e[4],
                "period_start": e[5], "period_end": e[6], "created_at": e[7], "status": e[8],
            }
            for e in events
        ],
    }


@router.get("/billing/checkout")
async def get_checkout(admin: dict = Depends(get_current_admin)):
    settings_row = await get_platform_settings()
    amount = settings_row["monthly_price_cents"]
    if not amount:
        raise HTTPException(status_code=409, detail="No hay un precio configurado todavia")
    if not settings.wompi_public_key or not settings.wompi_integrity_secret:
        raise HTTPException(status_code=503, detail="Wompi no esta configurado")

    reference = f"repitela-{admin['venue_id']}-{int(time.time())}"
    raw = f"{reference}{amount}COP{settings.wompi_integrity_secret}"
    signature = hashlib.sha256(raw.encode()).hexdigest()

    return {
        "public_key": settings.wompi_public_key,
        "currency": "COP",
        "amount_in_cents": amount,
        "reference": reference,
        "signature": signature,
    }
