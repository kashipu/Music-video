# Modelo de Datos - BarQueue

Base de datos SQLite con WAL mode habilitado para concurrencia de lecturas.

## Diagrama de Relaciones (ER)

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│   venues     │       │  user_sessions   │       │    users     │
│──────────────│       │──────────────────│       │──────────────│
│ PK id        │◄──┐   │ PK id (UUID)     │   ┌──►│ PK id        │
│    name      │   │   │ FK user_id ──────│───┘   │    phone     │
│    slug      │   │   │ FK venue_id ─────│───┐   │    display   │
│    fallback_ │   │   │    table_number  │   │   │    data_     │
│    playlist  │   │   │    started_at    │   │   │    consent   │
│    fallback_ │   │   │    ended_at      │   │   │    created_  │
│    mode      │   │   └──────────────────┘   │   └──────┬───────┘
│    config    │   │                          │          │
│    created_  │   │                          │          │
└──────┬───────┘   │                          │          │
       │           │                          │          │
       │   ┌───────┴──────────────────────────┘          │
       │   │                                             │
       ▼   ▼                                             ▼
┌──────────────────┐                          ┌──────────────────┐
│  queue_songs     │                          │ submission_log   │
│──────────────────│                          │──────────────────│
│ PK id            │                          │ PK id            │
│ FK venue_id      │                          │ FK user_id       │
│ FK user_id       │                          │ FK venue_id      │
│ FK session_id    │                          │    submitted_at  │
│    youtube_id    │                          └──────────────────┘
│    title         │
│    thumbnail_url │                          ┌──────────────────┐
│    duration_sec  │                          │    admins        │
│    position      │                          │──────────────────│
│    status        │                          │ PK id            │
│    added_at      │                          │ FK venue_id      │
│    played_at     │                          │    username      │
└──────────────────┘                          │    password_hash │
                                              │    created_at    │
┌──────────────────┐                          └──────────────────┘
│  play_history    │
│──────────────────│       ┌──────────────────┐
│ PK id            │       │  song_metadata   │
│ FK venue_id      │       │──────────────────│
│ FK user_id       │       │ PK youtube_id    │
│    youtube_id ───│──────►│    title         │
│    title         │       │    artist        │
│    artist        │       │    genre         │
│    genre         │       │    tags (JSON)   │
│    played_at     │       │    duration_sec  │
│    duration_sec  │       │    first_seen_at │
└──────────────────┘       └──────────────────┘
```

## Esquema SQL

### Tabla: `venues`

Almacena la información de cada bar/venue.

```sql
CREATE TABLE venues (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    fallback_playlist TEXT,          -- JSON array de youtube_ids, ej: '["dQw4w9WgXcQ", "abc123"]'
    fallback_mode   TEXT NOT NULL DEFAULT 'playlist'
                    CHECK (fallback_mode IN ('playlist', 'youtube_recommendations')),
    config          TEXT DEFAULT '{}', -- JSON con configuración del venue
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- El slug se usa en las URLs: https://app.domain.com/{slug}
-- config ejemplo: {"max_duration_sec": 600, "max_songs_per_window": 5, "window_minutes": 30}
```

### Tabla: `users`

Usuarios identificados por número de celular.

```sql
CREATE TABLE users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phone           TEXT UNIQUE NOT NULL,    -- Formato E.164: +573001234567
    display_name    TEXT,                    -- Nombre opcional del usuario
    data_consent    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_phone ON users(phone);
```

### Tabla: `user_sessions`

Registra cada sesión de un usuario en un venue (escaneo de QR).

```sql
CREATE TABLE user_sessions (
    id              TEXT PRIMARY KEY,        -- UUID v4
    user_id         INTEGER NOT NULL REFERENCES users(id),
    venue_id        INTEGER NOT NULL REFERENCES venues(id),
    table_number    TEXT NOT NULL,           -- Número/nombre de mesa
    started_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at        TIMESTAMP               -- NULL si está activa
);

CREATE INDEX idx_sessions_user_venue ON user_sessions(user_id, venue_id);
CREATE INDEX idx_sessions_venue_active ON user_sessions(venue_id, ended_at);
```

### Tabla: `queue_songs`

La cola de canciones. Tabla central del sistema.

```sql
CREATE TABLE queue_songs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id        INTEGER NOT NULL REFERENCES venues(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    session_id      TEXT NOT NULL REFERENCES user_sessions(id),
    youtube_id      TEXT NOT NULL,           -- ID del video (11 chars)
    title           TEXT NOT NULL,
    thumbnail_url   TEXT,
    duration_sec    INTEGER,
    position        INTEGER NOT NULL,        -- Orden en la cola
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'playing', 'played', 'removed')),
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    played_at       TIMESTAMP               -- Momento en que empezó a sonar
);

-- Índice principal para consultar la cola activa de un venue
CREATE INDEX idx_queue_venue_status ON queue_songs(venue_id, status, position);

-- Para verificar deduplicación (mismo video no puede estar pendiente 2 veces)
CREATE UNIQUE INDEX idx_queue_active_video ON queue_songs(venue_id, youtube_id)
    WHERE status IN ('pending', 'playing');

-- Para consultar las canciones de un usuario
CREATE INDEX idx_queue_user ON queue_songs(user_id, venue_id);
```

### Tabla: `submission_log`

Registro de envíos para implementar rate limiting.

```sql
CREATE TABLE submission_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    venue_id        INTEGER NOT NULL REFERENCES venues(id),
    submitted_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consulta de rate limit: COUNT(*) WHERE user_id = ? AND venue_id = ? AND submitted_at > datetime('now', '-30 minutes')
CREATE INDEX idx_submissions_rate_limit ON submission_log(user_id, venue_id, submitted_at);
```

### Tabla: `admins`

Cuentas de administrador (separadas de los clientes).

```sql
CREATE TABLE admins (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id        INTEGER NOT NULL REFERENCES venues(id),
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,           -- bcrypt hash
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: `play_history`

Historial completo de canciones reproducidas. Fuente principal para analytics.

```sql
CREATE TABLE play_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id        INTEGER NOT NULL REFERENCES venues(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    youtube_id      TEXT NOT NULL,
    title           TEXT NOT NULL,
    artist          TEXT,                    -- Extraído de metadata de YouTube
    genre           TEXT,                    -- Categoría de YouTube
    played_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_sec    INTEGER
);

CREATE INDEX idx_history_venue_date ON play_history(venue_id, played_at);
CREATE INDEX idx_history_youtube ON play_history(youtube_id);
CREATE INDEX idx_history_user ON play_history(user_id, played_at);
```

### Tabla: `song_metadata`

Catálogo de canciones conocidas. Se llena la primera vez que se solicita un video.

```sql
CREATE TABLE song_metadata (
    youtube_id      TEXT PRIMARY KEY,        -- ID del video de YouTube
    title           TEXT NOT NULL,
    artist          TEXT,                    -- Extraído del título o metadata
    genre           TEXT,                    -- Categoría de YouTube
    tags            TEXT,                    -- JSON array de tags del video
    duration_sec    INTEGER,
    first_seen_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Configuración de SQLite

```sql
-- Habilitar WAL mode para mejor concurrencia
PRAGMA journal_mode = WAL;

-- Habilitar foreign keys (deshabilitadas por defecto en SQLite)
PRAGMA foreign_keys = ON;

-- Timeout para escrituras concurrentes (5 segundos)
PRAGMA busy_timeout = 5000;

-- Optimizar para velocidad de lectura
PRAGMA cache_size = -64000;  -- 64MB cache
PRAGMA synchronous = NORMAL; -- Balance entre seguridad y velocidad
```

## Estrategia de Migraciones

Archivos SQL numerados en `backend/app/db/migrations/`:

```
migrations/
├── 001_initial_schema.sql
├── 002_add_song_metadata.sql
├── 003_add_venue_config.sql
└── ...
```

- Cada migración se ejecuta en orden al iniciar la app
- Se registra en una tabla `_migrations` qué migraciones ya se aplicaron
- Rollback manual (no automático) — SQLite no soporta todas las operaciones ALTER TABLE

```sql
CREATE TABLE _migrations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    filename        TEXT UNIQUE NOT NULL,
    applied_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Consultas Frecuentes

### Cola activa de un venue

```sql
SELECT qs.*, u.display_name, us.table_number
FROM queue_songs qs
JOIN users u ON qs.user_id = u.id
JOIN user_sessions us ON qs.session_id = us.id
WHERE qs.venue_id = ?
  AND qs.status IN ('pending', 'playing')
ORDER BY qs.position ASC;
```

### Rate limit check

```sql
SELECT COUNT(*) as song_count
FROM submission_log
WHERE user_id = ?
  AND venue_id = ?
  AND submitted_at > datetime('now', '-30 minutes');
```

### Top 10 canciones más pedidas (mes actual)

```sql
SELECT youtube_id, title, artist, COUNT(*) as times_played
FROM play_history
WHERE venue_id = ?
  AND played_at >= date('now', 'start of month')
GROUP BY youtube_id
ORDER BY times_played DESC
LIMIT 10;
```

### Co-ocurrencia de canciones (qué se pide junto)

```sql
SELECT a.youtube_id AS song_a, b.youtube_id AS song_b,
       a.title AS title_a, b.title AS title_b,
       COUNT(*) AS co_occurrences
FROM queue_songs a
JOIN queue_songs b ON a.session_id = b.session_id
  AND a.youtube_id < b.youtube_id
WHERE a.venue_id = ?
  AND a.status = 'played'
  AND b.status = 'played'
GROUP BY a.youtube_id, b.youtube_id
ORDER BY co_occurrences DESC
LIMIT 20;
```

### Horas pico por venue

```sql
SELECT strftime('%H', added_at) AS hour,
       COUNT(*) AS requests
FROM queue_songs
WHERE venue_id = ?
  AND added_at >= date('now', '-30 days')
GROUP BY hour
ORDER BY requests DESC;
```
