from datetime import datetime, timezone

import jwt
import pytest
from fastapi import HTTPException

from app.config import settings
from app.services import auth_service
from app.routers.playback import playback_venue_id


def _exp(token):
    payload = jwt.decode(token, settings.app_secret_key, algorithms=["HS256"])
    return datetime.fromtimestamp(payload["exp"], tz=timezone.utc)


@pytest.mark.asyncio
async def test_sin_credencial_no_se_puede_reportar_reproduccion():
    """El slug del bar es público: si autorizara, cualquiera podría saltar la
    canción que suena, bloquear un video o inyectar un 'suena ahora' falso."""
    for header in ("", "Bearer basura", "Basic abc"):
        with pytest.raises(HTTPException) as e:
            await playback_venue_id(header)
        assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_la_sesion_de_un_cliente_no_sirve_para_reportar():
    cliente = auth_service.create_token(1, "3001234567", 7, "5", "sess-1")
    with pytest.raises(HTTPException) as e:
        await playback_venue_id(f"Bearer {cliente}")
    assert e.value.status_code == 403


@pytest.mark.asyncio
async def test_kiosk_y_admin_resuelven_su_propio_venue():
    assert await playback_venue_id(f"Bearer {auth_service.create_kiosk_token(7)}") == 7
    admin = auth_service.create_admin_token(1, "dueno", 7)
    assert await playback_venue_id(f"Bearer {admin}") == 7


def test_el_token_de_kiosk_sobrevive_la_noche():
    """La pantalla queda encendida sin nadie que vuelva a iniciar sesión: si
    caducara como la del admin (8h), dejaría de avanzar canciones de madrugada."""
    ahora = datetime.now(timezone.utc)
    kiosk = (_exp(auth_service.create_kiosk_token(7)) - ahora).total_seconds() / 3600
    admin = (_exp(auth_service.create_admin_token(1, "dueno", 7)) - ahora).total_seconds() / 3600
    assert admin < 24 < kiosk
