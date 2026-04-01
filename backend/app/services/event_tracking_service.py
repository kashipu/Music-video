"""
Event tracking service — Plan de medicion BarQueue.

Eventos de PRODUCTO:
  - song_played          : Cancion reproducida completamente
  - song_skipped         : Cancion saltada por admin
  - song_removed         : Cancion removida de la cola
  - song_added           : Cancion agregada a la cola
  - song_error           : Video fallo al reproducir (derechos, etc.)
  - fallback_activated   : Playlist de respaldo se activo (cola vacia)
  - fallback_deactivated : Playlist de respaldo se desactivo (cancion de usuario llego)
  - queue_empty          : Cola quedo vacia

Eventos de USUARIO:
  - user_registered      : Nuevo usuario se registro
  - user_returned        : Usuario recurrente inicio sesion
  - session_started      : Sesion iniciada
  - session_ended        : Sesion cerrada (manual o kick)
  - session_kicked       : Admin expulso una mesa

Eventos de NEGOCIO:
  - venue_day_started    : Primer actividad del dia en el venue
  - venue_day_ended      : Ultima actividad registrada (calculado)
"""

import json

from app.database import get_db


# -- Event types as constants for type safety --
SONG_PLAYED = "song_played"
SONG_SKIPPED = "song_skipped"
SONG_REMOVED = "song_removed"
SONG_ADDED = "song_added"
SONG_ERROR = "song_error"
FALLBACK_ACTIVATED = "fallback_activated"
FALLBACK_DEACTIVATED = "fallback_deactivated"
QUEUE_EMPTY = "queue_empty"

USER_REGISTERED = "user_registered"
USER_RETURNED = "user_returned"
SESSION_STARTED = "session_started"
SESSION_ENDED = "session_ended"
SESSION_KICKED = "session_kicked"

VENUE_DAY_STARTED = "venue_day_started"


async def track(
    venue_id: int,
    event_type: str,
    user_id: int | None = None,
    session_id: str | None = None,
    data: dict | None = None,
) -> None:
    """Record an analytics event. Fire-and-forget, never raises."""
    try:
        db = await get_db()
        await db.execute(
            "INSERT INTO analytics_events (venue_id, user_id, session_id, event_type, event_data) "
            "VALUES (?, ?, ?, ?, ?)",
            (venue_id, user_id, session_id, event_type, json.dumps(data or {})),
        )
        await db.commit()
    except Exception:
        pass  # Analytics should never break the main flow


async def track_venue_day_start(venue_id: int) -> None:
    """Track first activity of the day for a venue (idempotent per day)."""
    try:
        db = await get_db()
        rows = await db.execute_fetchall(
            "SELECT 1 FROM analytics_events "
            "WHERE venue_id = ? AND event_type = ? "
            "AND created_at > datetime('now', 'start of day') LIMIT 1",
            (venue_id, VENUE_DAY_STARTED),
        )
        if not rows:
            await track(venue_id, VENUE_DAY_STARTED)
    except Exception:
        pass
