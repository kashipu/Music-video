import logging
from html import escape

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _template(title: str, content: str) -> str:
    return f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1a1a1a">
<h1 style="color:#FF5522">Repitela</h1><h2>{title}</h2>{content}
</div>"""


async def send_email(to: str, subject: str, html_body: str) -> None:
    # ponytail: local development has no Brevo key, so log the rendered email instead of sending it.
    if not settings.brevo_api_key:
        logger.warning("BREVO_API_KEY missing; email to %s: %s", to, html_body)
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post("https://api.brevo.com/v3/smtp/email", headers={
                "api-key": settings.brevo_api_key,
                "content-type": "application/json",
            }, json={
                "sender": {"email": settings.email_from, "name": "Repitela"},
                "to": [{"email": to}],
                "subject": subject,
                "htmlContent": html_body,
            })
            response.raise_for_status()
    except httpx.HTTPError:
        logger.exception("Brevo could not send email to %s", to)


async def send_verification_email(to: str, link: str) -> None:
    await send_email(to, "Verifica tu cuenta de Repitela", _template(
        "Verifica tu correo", f'<p>Confirma tu cuenta para empezar tu prueba gratis.</p><p><a style="color:#FF5522" href="{link}">Verificar mi correo</a></p>',
    ))


async def send_welcome_email(to: str, venue_name: str) -> None:
    await send_email(to, "Bienvenido a Repitela", _template(
        "Tu cuenta esta lista", f"<p>Bienvenido a Repitela. <strong>{escape(venue_name)}</strong> ya puede empezar a usar la plataforma.</p>",
    ))


async def send_reset_email(to: str, link: str) -> None:
    await send_email(to, "Restablece tu contrasena de Repitela", _template(
        "Restablece tu contrasena", f'<p>Solicitaste cambiar tu contrasena.</p><p><a style="color:#FF5522" href="{link}">Crear nueva contrasena</a></p>',
    ))
