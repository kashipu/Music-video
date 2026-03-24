from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "development"
    app_secret_key: str = "change-me-in-production"
    app_debug: bool = False

    database_path: str = "data/barqueue.db"

    youtube_api_key: str = ""

    cors_origins: str = "http://localhost:5173"

    max_songs_per_window: int = 5
    window_minutes: int = 30

    jwt_expiration_hours: int = 24
    jwt_admin_expiration_hours: int = 8

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
