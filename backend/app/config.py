from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "development"
    app_secret_key: str = "change-me-in-production"
    app_debug: bool = False

    database_path: str = "data/barqueue.db"

    youtube_api_key: str = ""
    google_client_id: str = ""
    turnstile_secret_key: str = ""
    # Hostnames que Cloudflare puede reportar como origen del reto. Vacio = no se valida.
    turnstile_hostnames: str = ""
    brevo_api_key: str = ""
    email_from: str = "no-reply@repitela.com"
    frontend_url: str = "http://localhost:5173"

    cors_origins: str = "http://localhost:5173"

    max_songs_per_window: int = 5
    window_minutes: int = 20

    jwt_expiration_hours: int = 24
    jwt_admin_expiration_hours: int = 8

    wompi_public_key: str = ""
    wompi_integrity_secret: str = ""
    wompi_events_secret: str = ""
    google_signup_enabled: bool = True
    wompi_checkout_enabled: bool = True

    session_inactivity_minutes: int = 120  # expire after 2h of inactivity
    session_max_hours: int = 24            # hard max session duration

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

# Los JWT se firman con app_secret_key. Arrancar en produccion con el valor por
# defecto permite a cualquiera forjar un token de superadmin (verificado: HTTP 200
# en /api/superadmin/venues con token fabricado). Fallar al arrancar es preferible
# a servir con auth abierta.
_INSECURE_SECRETS = {"change-me-in-production", "cambiar-en-produccion", ""}
if settings.app_env == "production" and (
    settings.app_secret_key in _INSECURE_SECRETS or len(settings.app_secret_key) < 32
):
    raise RuntimeError(
        "APP_SECRET_KEY tiene el valor por defecto en produccion. "
        "Genera uno con: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )
