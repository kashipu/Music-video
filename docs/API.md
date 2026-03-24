# API Reference - BarQueue

Base URL: `https://{domain}/api`

Todas las respuestas son JSON. Los errores siguen el formato:

```json
{
  "detail": "Descripción del error",
  "code": "ERROR_CODE"
}
```

## Autenticación

Los endpoints protegidos requieren el header:

```
Authorization: Bearer <jwt_token>
```

Los endpoints de admin requieren un token de admin (obtenido vía `/api/admin/login`).

---

## Auth / Registro

### `POST /api/auth/register`

Registra un usuario y crea una sesión. Es el primer paso después de escanear el QR.

**Body:**

```json
{
  "phone": "+573001234567",
  "table_number": "5",
  "venue_slug": "bar-la-esquina",
  "data_consent": true
}
```

**Response 201:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 42,
    "phone": "+573001234567",
    "display_name": null
  },
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "table_number": "5",
    "venue_slug": "bar-la-esquina"
  }
}
```

**Errores:**

| Status | Code | Descripción |
|--------|------|-------------|
| 400 | `CONSENT_REQUIRED` | `data_consent` debe ser `true` |
| 404 | `VENUE_NOT_FOUND` | El `venue_slug` no existe |
| 422 | `INVALID_PHONE` | Formato de teléfono inválido |

**Notas:**
- Si el teléfono ya existe en `users`, se reutiliza el usuario existente
- Se crea una nueva `user_session` en cada registro
- El JWT expira en 24 horas

---

### `GET /api/auth/session`

Retorna información de la sesión actual.

**Auth:** Bearer token requerido

**Response 200:**

```json
{
  "user": {
    "id": 42,
    "phone": "+573001234567",
    "display_name": "Carlos"
  },
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "table_number": "5",
    "venue_slug": "bar-la-esquina",
    "started_at": "2026-03-24T21:00:00Z"
  },
  "rate_limit": {
    "songs_remaining": 3,
    "window_resets_at": "2026-03-24T21:30:00Z"
  }
}
```

---

### `PATCH /api/auth/profile`

Actualiza el nombre del usuario.

**Auth:** Bearer token requerido

**Body:**

```json
{
  "display_name": "Carlos"
}
```

**Response 200:**

```json
{
  "id": 42,
  "phone": "+573001234567",
  "display_name": "Carlos"
}
```

---

## Cola de Canciones (Cliente)

### `GET /api/queue`

Retorna la cola actual del venue. **No requiere autenticación.**

**Query params:**

| Param | Tipo | Descripción |
|-------|------|-------------|
| `venue` | string | Slug del venue (requerido) |

**Response 200:**

```json
{
  "now_playing": {
    "id": 101,
    "youtube_id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    "duration_sec": 213,
    "added_by": "Carlos",
    "table_number": "5",
    "playing_since": "2026-03-24T21:15:00Z"
  },
  "queue": [
    {
      "id": 102,
      "position": 2,
      "youtube_id": "kJQP7kiw5Fk",
      "title": "Luis Fonsi - Despacito",
      "thumbnail_url": "https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg",
      "duration_sec": 282,
      "added_by": "María",
      "table_number": "3",
      "added_at": "2026-03-24T21:14:00Z",
      "estimated_wait_sec": 180
    }
  ],
  "total_in_queue": 5,
  "fallback_active": false
}
```

---

### `POST /api/queue/songs`

Envía una URL de YouTube para validación. Retorna preview de la canción.

**Auth:** Bearer token requerido

**Body:**

```json
{
  "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response 200:**

```json
{
  "youtube_id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
  "duration_sec": 213,
  "duration_formatted": "3:33",
  "valid": true,
  "recently_played_by_user": false,
  "recently_played_minutes_ago": null
}
```

**Errores:**

| Status | Code | Descripción |
|--------|------|-------------|
| 400 | `INVALID_URL` | URL no es de YouTube o formato incorrecto |
| 400 | `VIDEO_NOT_FOUND` | El video no existe o no está disponible |
| 400 | `VIDEO_NOT_EMBEDDABLE` | El video no permite ser embebido |
| 400 | `DURATION_EXCEEDED` | La canción supera el límite de duración |
| 409 | `ALREADY_IN_QUEUE` | La canción ya está en la cola activa |
| 429 | `RATE_LIMIT_EXCEEDED` | Se alcanzó el límite de 5 canciones en 30 min |

**Nota:** Este endpoint NO encola la canción. Solo valida y retorna preview.

---

### `POST /api/queue/songs/confirm`

Confirma y encola una canción previamente validada.

**Auth:** Bearer token requerido

**Body:**

```json
{
  "youtube_id": "dQw4w9WgXcQ"
}
```

**Response 201:**

```json
{
  "id": 103,
  "youtube_id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "position": 6,
  "estimated_wait_sec": 900,
  "songs_remaining": 2,
  "window_resets_at": "2026-03-24T21:45:00Z"
}
```

**Errores:**

| Status | Code | Descripción |
|--------|------|-------------|
| 409 | `ALREADY_IN_QUEUE` | La canción fue encolada entre el preview y la confirmación |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit alcanzado |

---

### `GET /api/queue/my-songs`

Canciones del usuario en la sesión actual.

**Auth:** Bearer token requerido

**Response 200:**

```json
{
  "songs": [
    {
      "id": 103,
      "youtube_id": "dQw4w9WgXcQ",
      "title": "Rick Astley - Never Gonna Give You Up",
      "position": 6,
      "status": "pending",
      "added_at": "2026-03-24T21:16:00Z"
    }
  ],
  "rate_limit": {
    "songs_remaining": 2,
    "window_resets_at": "2026-03-24T21:45:00Z"
  }
}
```

---

### `GET /api/queue/recent-history`

Canciones que el usuario pidió en las últimas 2 horas (para evitar repeticiones).

**Auth:** Bearer token requerido

**Response 200:**

```json
{
  "recent_songs": [
    {
      "youtube_id": "dQw4w9WgXcQ",
      "title": "Rick Astley - Never Gonna Give You Up",
      "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      "status": "played",
      "added_at": "2026-03-24T20:30:00Z",
      "minutes_ago": 45
    },
    {
      "youtube_id": "kJQP7kiw5Fk",
      "title": "Luis Fonsi - Despacito",
      "thumbnail_url": "https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg",
      "status": "pending",
      "added_at": "2026-03-24T21:03:00Z",
      "minutes_ago": 12
    }
  ],
  "window_hours": 2
}
```

---

### `GET /api/queue/remaining-slots`

Cuántas canciones puede agregar el usuario en la ventana actual.

**Auth:** Bearer token requerido

**Response 200:**

```json
{
  "songs_remaining": 3,
  "max_songs": 5,
  "window_minutes": 30,
  "window_resets_at": "2026-03-24T21:45:00Z",
  "recent_submissions": 2
}
```

---

## Administración

### `POST /api/admin/login`

Login de administrador.

**Body:**

```json
{
  "username": "admin_bar",
  "password": "secure_password"
}
```

**Response 200:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "admin": {
    "id": 1,
    "username": "admin_bar",
    "venue_id": 1,
    "venue_name": "Bar La Esquina"
  }
}
```

---

### `GET /api/admin/queue`

Cola completa con detalles de administración.

**Auth:** Admin token requerido

**Response 200:**

```json
{
  "now_playing": {
    "id": 101,
    "youtube_id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "user_phone": "+573001234567",
    "user_name": "Carlos",
    "table_number": "5",
    "added_at": "2026-03-24T21:10:00Z",
    "playing_since": "2026-03-24T21:15:00Z"
  },
  "queue": [
    {
      "id": 102,
      "position": 2,
      "youtube_id": "kJQP7kiw5Fk",
      "title": "Luis Fonsi - Despacito",
      "user_phone": "+573009876543",
      "user_name": "María",
      "table_number": "3",
      "added_at": "2026-03-24T21:14:00Z",
      "duration_sec": 282
    }
  ],
  "total_in_queue": 5,
  "playback_status": "playing"
}
```

---

### `DELETE /api/admin/queue/songs/{song_id}`

Remueve una canción de la cola.

**Auth:** Admin token requerido

**Response 200:**

```json
{
  "message": "Canción removida",
  "song_id": 102
}
```

---

### `PATCH /api/admin/queue/songs/{song_id}`

Reordena una canción en la cola.

**Auth:** Admin token requerido

**Body:**

```json
{
  "position": 2
}
```

**Response 200:**

```json
{
  "message": "Canción reordenada",
  "song_id": 102,
  "new_position": 2
}
```

---

### `POST /api/admin/queue/songs`

El admin agrega una canción directamente (sin rate limit).

**Auth:** Admin token requerido

**Body:**

```json
{
  "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response 201:**

```json
{
  "id": 110,
  "youtube_id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "position": 7,
  "added_by": "admin"
}
```

---

### `POST /api/admin/queue/skip`

Salta la canción actual y avanza a la siguiente.

**Auth:** Admin token requerido

**Response 200:**

```json
{
  "message": "Canción saltada",
  "skipped": {
    "id": 101,
    "title": "Rick Astley - Never Gonna Give You Up"
  },
  "now_playing": {
    "id": 102,
    "title": "Luis Fonsi - Despacito"
  }
}
```

---

### `POST /api/admin/playback/pause`

Pausa la reproducción en el kiosco.

**Auth:** Admin token requerido

**Response 200:**

```json
{
  "playback_status": "paused"
}
```

---

### `POST /api/admin/playback/resume`

Reanuda la reproducción.

**Auth:** Admin token requerido

**Response 200:**

```json
{
  "playback_status": "playing"
}
```

---

### `GET /api/admin/history`

Historial de canciones pedidas.

**Auth:** Admin token requerido

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `page` | int | 1 | Página |
| `per_page` | int | 50 | Resultados por página |
| `date_from` | string | - | Fecha inicio (ISO 8601) |
| `date_to` | string | - | Fecha fin (ISO 8601) |

**Response 200:**

```json
{
  "history": [
    {
      "id": 1,
      "youtube_id": "dQw4w9WgXcQ",
      "title": "Rick Astley - Never Gonna Give You Up",
      "user_name": "Carlos",
      "user_phone": "+573001234567",
      "table_number": "5",
      "played_at": "2026-03-24T21:15:00Z",
      "duration_sec": 213
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 234,
    "total_pages": 5
  }
}
```

---

### `GET /api/admin/analytics`

Estadísticas y data mining.

**Auth:** Admin token requerido

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `period` | string | `week` | `day`, `week`, `month`, `all` |

**Response 200:**

```json
{
  "period": "week",
  "summary": {
    "total_songs_played": 342,
    "unique_users": 87,
    "unique_songs": 198,
    "avg_queue_length": 4.2,
    "avg_wait_time_sec": 540
  },
  "top_songs": [
    {
      "youtube_id": "kJQP7kiw5Fk",
      "title": "Luis Fonsi - Despacito",
      "times_played": 12
    }
  ],
  "peak_hours": [
    { "hour": "22", "requests": 45 },
    { "hour": "23", "requests": 38 },
    { "hour": "21", "requests": 32 }
  ],
  "top_tables": [
    { "table_number": "5", "total_songs": 28 },
    { "table_number": "3", "total_songs": 22 }
  ]
}
```

---

## Playback (Kiosco)

### `GET /api/playback/now-playing`

Retorna la canción que debe reproducirse.

**Query params:**

| Param | Tipo | Descripción |
|-------|------|-------------|
| `venue` | string | Slug del venue (requerido) |

**Response 200:**

```json
{
  "song": {
    "id": 101,
    "youtube_id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "duration_sec": 213
  },
  "playback_status": "playing",
  "fallback_active": false,
  "next_in_queue": {
    "title": "Luis Fonsi - Despacito",
    "added_by": "María"
  }
}
```

**Response 200 (cola vacía, fallback activo):**

```json
{
  "song": null,
  "playback_status": "playing",
  "fallback_active": true,
  "fallback_mode": "playlist",
  "fallback_playlist": ["video_id_1", "video_id_2", "video_id_3"]
}
```

---

### `POST /api/playback/finished`

El kiosco notifica que la canción actual terminó.

**Body:**

```json
{
  "song_id": 101,
  "venue_slug": "bar-la-esquina"
}
```

**Response 200:**

```json
{
  "next_song": {
    "id": 102,
    "youtube_id": "kJQP7kiw5Fk",
    "title": "Luis Fonsi - Despacito"
  },
  "fallback_active": false
}
```

---

## WebSocket

### `ws://{domain}/ws/queue?venue={venue_slug}`

Conexión WebSocket para recibir actualizaciones en tiempo real de la cola.

**Eventos del servidor:**

```json
// Canción agregada
{
  "event": "song_added",
  "data": {
    "id": 103,
    "youtube_id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "position": 6,
    "added_by": "Carlos"
  }
}

// Canción removida
{
  "event": "song_removed",
  "data": {
    "id": 102,
    "removed_by": "admin"
  }
}

// Canción saltada
{
  "event": "song_skipped",
  "data": {
    "skipped_id": 101,
    "now_playing": {
      "id": 102,
      "youtube_id": "kJQP7kiw5Fk",
      "title": "Luis Fonsi - Despacito"
    }
  }
}

// Cola reordenada
{
  "event": "queue_reordered",
  "data": {
    "queue": [
      { "id": 103, "position": 2 },
      { "id": 104, "position": 3 }
    ]
  }
}

// Cambio de canción actual
{
  "event": "now_playing_changed",
  "data": {
    "song": {
      "id": 102,
      "youtube_id": "kJQP7kiw5Fk",
      "title": "Luis Fonsi - Despacito"
    }
  }
}

// Playback pausado/reanudado
{
  "event": "playback_status_changed",
  "data": {
    "status": "paused"
  }
}

// Tu canción está sonando (enviado SOLO al usuario dueño de la canción)
{
  "event": "your_song_playing",
  "data": {
    "song": {
      "id": 103,
      "youtube_id": "dQw4w9WgXcQ",
      "title": "Rick Astley - Never Gonna Give You Up"
    },
    "message": "Tu canción está sonando ahora"
  }
}
```

---

## Health Check

### `GET /api/health`

**Response 200:**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "database": "connected"
}
```
