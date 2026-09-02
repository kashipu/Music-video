# Modelo de Datos

> **Índice:** [[README]] · **Autoridad sobre:** el esquema de la base · **Últ. cambio:** 2026-08-25
> Si esta página contradice al código, gana el código y esta página tiene un bug.

Repitela usa SQLite multi-venue. Al inicializar, activa WAL, claves foráneas, `busy_timeout=15000`, caché de 64 MB y `synchronous=NORMAL` (`backend/app/database.py:17-31`). Las migraciones se aplican por nombre en orden lexicográfico y quedan registradas en `_migrations` (`backend/app/database.py:41-79`).

El esquema actual tiene 17 tablas contando `_migrations`: 16 de producto y el registro de migraciones.

## Tablas de producto

### `venues`

El bar/cliente: `id`, `name`, `slug` único, `fallback_playlist`, `fallback_mode` (`playlist` o `youtube_recommendations`), `config`, `created_at`, `active`, `logo_url`, `qr_url`, `paid_until`, `payment_notes`, `address`, `address_lat`, `address_lng`, `venue_type` (`discoteca`, `rock`, `musica_popular` u `otro`) y `venue_type_other`. Base en `001_initial_schema.sql:1-10`; extensiones en `002`, `004`, `005`, `008` y `014`.

`config` es un blob JSON. Hoy guarda límites opcionales y el tema, por ejemplo:

```json
{
  "max_duration_sec": 600,
  "max_songs_per_window": 5,
  "window_minutes": 30,
  "theme": "craft-dark"
}
```

`theme` es uno de los IDs de `frontend/src/constants/themePresets.js:1-90`. El superadmin lee todo el JSON, modifica las claves solicitadas y lo escribe completo (`backend/app/routers/superadmin.py:344-372`). **Deuda conocida:** ese patrón read-modify-write puede perder una escritura concurrente; no hay control de versión ni actualización JSON atómica.

### Identidad y sesiones

| Tabla | Columnas y propósito |
|---|---|
| `users` | `id`, `phone` único, `display_name`, `data_consent`, `created_at`. Clientes identificados por teléfono. |
| `user_sessions` | `id` UUID, `user_id`, `venue_id`, `table_number`, `started_at`, `ended_at`, `last_activity_at`. Una sesión activa tiene `ended_at` nulo; `last_activity_at` sustenta la expiración por inactividad (`009_session_activity.sql:1-8`). |
| `admins` | `id`, `venue_id`, `username` único, `password_hash`, `created_at`, `email`, `email_verified`, `google_sub`, `terms_accepted_at`, `terms_version`, `privacy_accepted_at`, `full_name`, `phone`, `role` (`owner` o `manager`), `onboarding_completed_at`, `last_login_at`, `address`, `city`, `country`. |
| `super_admins` | `id`, `username` único, `password_hash`, `created_at`, `role` (`super_admin`, `vendedor` o `editor`), `last_login_at`, `phone`, `email`. |
| `email_tokens` | `id`, `admin_id`, `token_hash`, `purpose` (`verify` o `reset`), `expires_at`, `used_at`, `created_at`. |

`admins` arranca en `001_initial_schema.sql:64-70` y recibe sus campos actuales en `013`, `014`, `015`, `019` y `020`. `super_admins` nace en `002` y se completa en `016`–`018`; `email_tokens` está en `013`.

### Música y reproducción

| Tabla | Columnas y propósito |
|---|---|
| `queue_songs` | `id`, `venue_id`, `user_id`, `session_id`, `youtube_id`, `title`, `thumbnail_url`, `duration_sec`, `position`, `status` (`pending`, `playing`, `played`, `removed`), `added_at`, `played_at`. Cola por venue. |
| `submission_log` | `id`, `user_id`, `venue_id`, `submitted_at`; soporte del límite de envíos. |
| `play_history` | `id`, `venue_id`, `user_id`, `youtube_id`, `title`, `artist`, `genre`, `played_at`, `duration_sec`; historial de reproducción. |
| `song_metadata` | `youtube_id` PK, `title`, `artist`, `genre`, `tags` JSON, `duration_sec`, `first_seen_at`; catálogo local de videos conocidos. |
| `fallback_songs` | `id`, `venue_id`, `youtube_id`, `title`, `thumbnail_url`, `duration_sec`, `position`, `active`, `added_at`; canciones de respaldo, únicas por `(venue_id, youtube_id)`. |
| `blocked_videos` | `id`, `youtube_id` único, `venue_id` nullable, `error_code`, `title`, `blocked_at`; bloqueos de reproducción o embebido. |

Las seis tablas están definidas en `001_initial_schema.sql:34-96`, `003_fallback_songs.sql` y `010_blocked_videos.sql`. `idx_queue_active_video` **sí existe**: es un índice único parcial sobre `(venue_id, youtube_id)` para estados `pending` y `playing` (`001_initial_schema.sql:50-53`).

### Operación, analytics y facturación

| Tabla | Columnas y propósito |
|---|---|
| `venue_daily_pins` | `id`, `venue_id`, `pin`, `valid_date`, `created_at`; PIN único por venue y fecha. |
| `analytics_events` | `id`, `venue_id` nullable, `event_type`, `event_data` JSON, `user_id`, `session_id`, `created_at`. `venue_id` pasó a nullable para registrar búsquedas anónimas (`012_analytics_events_nullable_venue.sql:1-27`). |
| `platform_settings` | Fila única `id=1`, `trial_days`, `grace_period_days`, `monthly_price_cents`. |
| `venue_billing_events` | `id`, `venue_id`, `kind` (`payment`, `trial`, `legacy`, `adjustment`), `source`, datos del creador, `amount_cents`, `days`, período, `status`, `provider_ref`, `raw_payload`, `notes`, `created_at`. Conserva el historial de cobros y ajustes. |
| `_migrations` | `id`, `filename` único, `applied_at`; control interno de migraciones. |

`venue_billing_events.venue_id` usa `ON DELETE CASCADE`; su índice de idempotencia hace único `(source, provider_ref)` cuando la referencia no es nula (`023_billing_adjustment.sql:5-33`). `platform_settings` se crea con una fila inicial en `013` y gana el precio en `021`.

## Relaciones e índices relevantes

`venues` es el límite de tenancy: lo referencian sesiones, cola, logs, historial, admins, fallback, PINs, analytics, bloqueos y facturación. Las canciones de cola referencian a `users` y `user_sessions`; el historial y los logs referencian usuarios. Salvo la cascada explícita de `venue_billing_events`, las FKs no declaran cascada.

Índices operativos: cola por `(venue_id, status, position)` y sesión; sesiones activas por venue y por actividad; envíos por usuario/venue/fecha; historial por venue/fecha, video y usuario; analytics por venue/tipo/fecha; y los índices únicos descritos en las migraciones `001`, `003`, `006`, `010`, `013`, `021` y `023`.

## Migraciones

```
001_initial_schema.sql
002_super_admins.sql
003_fallback_songs.sql
004_venue_logo.sql
005_venue_qr_url.sql
006_venue_daily_pin.sql
007_analytics_events.sql
008_venue_billing.sql
009_session_activity.sql
010_blocked_videos.sql
011_performance_indexes.sql
012_analytics_events_nullable_venue.sql
013_admin_selfsignup.sql
014_admin_onboarding.sql
015_admin_last_login.sql
016_super_admin_roles.sql
017_super_admin_last_login.sql
018_super_admin_contact.sql
019_admin_contact.sql
020_admin_country.sql
021_venue_billing_history.sql
022_backfill_onboarding.sql
023_billing_adjustment.sql
```

Cada archivo se ejecuta una vez, dentro de una transacción por archivo; si falla no se registra en `_migrations` (`backend/app/database.py:60-79`). No hay rollback automático.
