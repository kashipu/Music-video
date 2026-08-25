# API Reference - Repitela.com

Base URL en producción: `https://{domain}/api`  
Base URL en desarrollo: `http://localhost:8000/api`

---

## 1. Convenciones y Formato de Errores

### Formato de Respuesta de Error
Todas las respuestas de error siguen el estándar nativo de **FastAPI / Starlette**. El cuerpo de la respuesta HTTP es un objeto JSON con la clave `detail`:

```json
{
  "detail": "Descripción del error en lenguaje natural"
}
```

Para errores de validación de esquema Pydantic (HTTP 422), `detail` es un arreglo de objetos describiendo la ubicación del campo y la regla violada:

```json
{
  "detail": [
    {
      "loc": ["body", "phone"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

> [!IMPORTANT]
> **Contrato Real de Errores y Códigos de Máquina:**
> En el backend **no existe** ninguna propiedad `"code"` dentro del cuerpo JSON de respuesta. Los códigos de error estructurados para consumo de clientes se transmiten exclusivamente mediante el header HTTP de respuesta:
> 
> ```http
> X-Error-Code: <ERROR_CODE>
> ```
>
> **Inconsistencia de Arquitectura:** El header `X-Error-Code` está implementado actualmente de forma exclusiva en los routers `auth.py` y `queue.py` (y `queue_service.py`). Los routers de `admin.py`, `admin_auth.py`, `superadmin.py`, `playback.py`, `billing.py` y `main.py` devuelven únicamente el cuerpo `{"detail": "..."}` con el status HTTP correspondiente, sin incluir el header `X-Error-Code`.

### Tabla de Códigos `X-Error-Code` Soportados

| Código en Header `X-Error-Code` | Status HTTP | Router | Descripción |
|---------------------------------|-------------|--------|-------------|
| `CONSENT_REQUIRED` | 400 | `auth.py:37` | El usuario no aceptó los términos de datos (`data_consent=false`). |
| `INVALID_PHONE` | 422 | `auth.py:41` | El teléfono no cumple longitud mínima (8 caracteres). |
| `PIN_REQUIRED` | 400 | `auth.py:55` | El venue tiene PIN diario activo y la petición no envió `pin`. |
| `PIN_INVALID` | 403 | `auth.py:61` | El PIN ingresado no coincide con el PIN activo del día. |
| `VENUE_NOT_FOUND` | 404 | `auth.py:74` | El slug del venue no existe en la base de datos. |
| `INVALID_URL` | 400 | `queue.py:64` | La URL de YouTube no coincide con los patrones válidos. |
| `RATE_LIMIT_EXCEEDED` | 429 | `queue.py:73,147` | El usuario excedió el límite de canciones en la ventana temporal. |
| `ALREADY_IN_QUEUE` | 409 | `queue.py:78,152` | La canción ya se encuentra en estado `pending` o `playing`. |
| `VIDEO_NOT_FOUND` | 404 | `queue.py:84` | YouTube oEmbed / Data API no encontró el video. |
| `VIDEO_NOT_EMBEDDABLE` | 400 | `queue.py:88` | El video tiene restricciones de reproducción externa/embebido. |
| `VIDEO_BLOCKED` | 400 | `queue.py:101,165` | El video está en la lista negra `blocked_videos` del local. |
| `DURATION_EXCEEDED` | 400 | `queue.py:114,194` | La duración supera `max_duration_sec` configurado en el venue. |

---

## 2. Autenticación y Niveles de Acceso

La API utiliza tokens JWT firmados con algoritmo `HS256` utilizando `APP_SECRET_KEY` ([backend/app/config.py:40](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/config.py#L40)).

```http
Authorization: Bearer <jwt_token>
```

Existen 3 tipos de tokens y esquemas de autorización:

1. **Cliente Final (Customer JWT)**:
   - Obtenido en `POST /api/auth/register`.
   - Payload: `{"user_id": int, "session_id": str, "venue_id": int, "exp": int}`.
   - Duración: 24 horas (`settings.jwt_expiration_hours`).
   - Valida inactividad de sesión (expira si transcurren >120 min sin actividad).

2. **Administrador de Bar (Admin JWT)**:
   - Obtenido en `POST /api/admin/login` o `POST /api/admin/google-signup`.
   - Payload: `{"admin_id": int, "username": str, "venue_id": int, "is_admin": true, "exp": int}`.
   - Duración: 8 horas (`settings.jwt_admin_expiration_hours`).

3. **Super Administrador (SuperAdmin JWT)**:
   - Obtenido en `POST /api/superadmin/login`.
   - Payload: `{"user_id": int, "username": str, "is_super_admin": true, "role": "super_admin" | "vendedor" | "editor", "exp": int}`.
   - Duración: 8 horas. Control de acceso basado en roles (RBAC).

4. **Webhooks y Tareas de Sistema**:
   - Webhook Wompi: Validación criptográfica mediante HMAC-SHA256 con `WOMPI_EVENTS_SECRET`.
   - Kiosco / Reproductor: Consultas públicas filtradas por slug de venue, con llamadas administrativas opcionales con Admin JWT.

---

## 3. Catálogo Completo de Endpoints (88 de Producción + 1 de Pruebas)

```
Resumen de Endpoints por Módulo:
├── 1. Auth Router (auth.py)                   :  4 endpoints
├── 2. Admin Auth Router (admin_auth.py)       :  7 endpoints
├── 3. Admin Operations Router (admin.py)      : 29 endpoints
├── 4. Queue Router (queue.py)                 :  9 endpoints
├── 5. Playback Router (playback.py)           :  4 endpoints
├── 6. SuperAdmin Router (superadmin.py)       : 29 endpoints
├── 7. Billing & Webhooks Router (billing.py)  :  3 endpoints
├── 8. WebSocket Endpoint (websocket.py)       :  1 endpoint
├── 9. Main / Servidor de Archivos (main.py)   :  2 endpoints
└── 10. Test Environment Router (test.py)      :  1 endpoint (Condicional APP_ENV=test)
Total = 88 en producción / 89 con entorno test
```

---

### 3.1. Auth Router (`/api/auth`) — 4 Endpoints

Módulo: [backend/app/routers/auth.py](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/routers/auth.py)

#### `POST /api/auth/register`
Registra un usuario cliente, valida consentimiento, verifica PIN diario (si aplica) y crea una sesión activa en el venue.

- **Auth:** Pública
- **Body:**
  ```json
  {
    "phone": "+573001234567",
    "venue_slug": "bar-la-esquina",
    "data_consent": true,
    "table_number": "5",
    "display_name": "Carlos",
    "pin": "1234"
  }
  ```
  *(Campos `table_number`, `display_name` y `pin` son opcionales `str | null = null`. El frontend envía `table_number: null` desde la landing).*
- **Response 201:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 42,
      "phone": "+573001234567",
      "display_name": "Carlos"
    },
    "session": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "table_number": "5",
      "venue_slug": "bar-la-esquina",
      "venue_id": 1,
      "started_at": "2026-08-25T14:00:00"
    }
  }
  ```
- **Errores:**
  - `400` con `X-Error-Code: CONSENT_REQUIRED` — `data_consent` es `false`.
  - `422` con `X-Error-Code: INVALID_PHONE` — Teléfono con menos de 8 caracteres.
  - `400` con `X-Error-Code: PIN_REQUIRED` — El local exige PIN y no fue enviado.
  - `403` con `X-Error-Code: PIN_INVALID` — PIN incorrecto.
  - `404` con `X-Error-Code: VENUE_NOT_FOUND` — El `venue_slug` no existe.
  - `403` `{"detail": "Este bar no esta disponible en este momento"}` — Venue inactivo.
- **WebSocket:** Emite `table_registered` a todos los clientes del venue.

#### `GET /api/auth/session`
Obtiene la información de la sesión actual del cliente y actualiza el timestamp de actividad para evitar expiración por inactividad.

- **Auth:** Customer Bearer Token
- **Response 200:**
  ```json
  {
    "user": {
      "id": 42,
      "phone": "+573001234567",
      "display_name": "Carlos"
    },
    "session": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "table_number": "5",
      "venue_slug": "bar-la-esquina",
      "venue_id": 1,
      "started_at": "2026-08-25T14:00:00"
    },
    "rate_limit": {
      "songs_remaining": 3,
      "window_resets_at": "2026-08-25T14:30:00"
    }
  }
  ```
- **Errores:**
  - `401` `{"detail": "Sesion invalida"}` / `{"detail": "Sesion expirada por inactividad, vuelve a registrarte"}`
  - `404` `{"detail": "Usuario no encontrado"}`

#### `PATCH /api/auth/profile`
Actualiza el nombre para mostrar (`display_name`) del usuario autenticado.

- **Auth:** Customer Bearer Token
- **Body:**
  ```json
  {
    "display_name": "Carlos Gomez"
  }
  ```
- **Response 200:**
  ```json
  {
    "id": 42,
    "phone": "+573001234567",
    "display_name": "Carlos Gomez"
  }
  ```
- **Errores:** `401` (No autorizado o sesión expirada).

#### `GET /api/auth/venue-info`
Consulta pública para comprobar el estado de un local, su logo, tema visual configurado y si requiere PIN de presencia física.

- **Auth:** Pública
- **Query Params:** `venue_slug: str` (requerido)
- **Response 200:**
  ```json
  {
    "id": 1,
    "name": "Bar La Esquina",
    "active": true,
    "logo_url": "/api/uploads/logo_1_17112345.png",
    "pin_required": false,
    "theme": "craft"
  }
  ```
- **Errores:** `404` `{"detail": "Bar no encontrado"}`.

---

### 3.2. Admin Auth Router (`/api/admin`) — 7 Endpoints

Módulo: [backend/app/routers/admin_auth.py](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/routers/admin_auth.py)

> [!NOTE]
> Todos los endpoints de autenticación de admin tienen un limitador en memoria ([backend/app/routers/admin_auth.py:18](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/routers/admin_auth.py#L18)) de **máximo 5 intentos por minuto** por par `(IP, ruta)`. Al excederlo responden `429` `{"detail": "Demasiados intentos. Intenta de nuevo en un minuto"}`.

#### `POST /api/admin/login`
Autenticación tradicional de administradores de local mediante usuario y contraseña.

- **Auth:** Pública (Rate limited)
- **Body:**
  ```json
  {
    "username": "admin_esquina",
    "password": "PasswordSeguro123",
    "venue_slug": "bar-la-esquina"
  }
  ```
  *(El campo `venue_slug` es opcional; si se envía, valida que el admin pertenezca a dicho bar).*
- **Response 200:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1Ni...",
    "admin": {
      "id": 5,
      "username": "admin_esquina",
      "venue_id": 1,
      "venue_slug": "bar-la-esquina",
      "venue_name": "Bar La Esquina",
      "onboarding_completed_at": "2026-04-01T10:00:00"
    }
  }
  ```
- **Errores:**
  - `401` `{"detail": "Usuario o contrasena incorrectos"}`
  - `403` `{"detail": "Este bar esta inactivo. Contacta al administrador."}` (excepto si está en estado `suspended` por pago, permitiendo ingresar a pagar)
  - `403` `{"detail": "Este usuario no pertenece a este bar"}`
  - `404` `{"detail": "Bar no encontrado"}`
  - `429` `{"detail": "Demasiados intentos..."}`

#### `POST /api/admin/signup`
Auto-registro de nuevo bar con periodo de prueba gratuito automático (15 días por defecto).

- **Auth:** Pública (Rate limited + Cloudflare Turnstile)
- **Body:**
  ```json
  {
    "venue_name": "Mi Gastrobar",
    "email": "contacto@migastrobar.com",
    "password": "PasswordSeguro123",
    "phone": "+573101234567",
    "address": "Calle 85 # 14-02",
    "city": "Bogota",
    "country": "Colombia",
    "terms_version": "v1.0",
    "terms_accepted": true,
    "privacy_accepted": true,
    "turnstile_token": "0.XXXXX..."
  }
  ```
- **Response 201:**
  ```json
  {
    "message": "Cuenta creada. Revisa tu correo para verificarla.",
    "venue_slug": "mi-gastrobar"
  }
  ```
- **Errores:**
  - `400` `{"detail": "Debes aceptar los terminos y el tratamiento de datos"}`
  - `400` `{"detail": "Verificacion anti-bot invalida"}`
  - `409` `{"detail": "Ya existe una cuenta con este correo"}`
  - `422` `{"detail": "Datos de registro invalidos"}`

#### `POST /api/admin/verify-email`
Verifica la dirección de correo electrónico mediante token firmado enviado por email (vía Brevo).

- **Auth:** Pública (Rate limited)
- **Body:** `{"token": "string_del_token"}`
- **Response 200:** `{"message": "Correo verificado"}`
- **Errores:** `400` `{"detail": "Token invalido o vencido"}`

#### `POST /api/admin/forgot-password`
Solicita el restablecimiento de contraseña para un correo registrado.

- **Auth:** Pública (Rate limited)
- **Body:** `{"email": "contacto@migastrobar.com"}`
- **Response 200:** `{"message": "Si el correo existe, te enviamos instrucciones"}`

#### `POST /api/admin/reset-password`
Aplica una nueva contraseña utilizando el token de restablecimiento recibido por correo.

- **Auth:** Pública (Rate limited)
- **Body:** `{"token": "string_del_token", "password": "NuevaPassword123"}`
- **Response 200:** `{"message": "Contrasena actualizada"}`
- **Errores:** `400` `{"detail": "Token invalido o vencido"}`

#### `POST /api/admin/google-signup`
Registro y autenticación directa mediante Google OAuth (Google Identity Services).

- **Auth:** Pública (Rate limited + Cloudflare Turnstile)
- **Body:**
  ```json
  {
    "token": "google_id_token_credential",
    "venue_name": "Mi Gastrobar",
    "phone": "+573101234567",
    "address": "Calle 85 # 14-02",
    "city": "Bogota",
    "country": "Colombia",
    "terms_version": "v1.0",
    "terms_accepted": true,
    "privacy_accepted": true,
    "turnstile_token": "0.XXXXX..."
  }
  ```
- **Response 201:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1Ni...",
    "admin": {
      "id": 6,
      "username": "contacto@migastrobar.com",
      "venue_id": 2,
      "venue_slug": "mi-gastrobar",
      "venue_name": "Mi Gastrobar",
      "onboarding_completed_at": null
    }
  }
  ```
- **Errores:** `400` (Términos/Turnstile inválidos), `401` `{"detail": "Token de Google invalido"}`, `503` `{"detail": "Google Sign-In no esta configurado"}`.

#### `GET /api/admin/trial-info`
Consulta pública de la duración del periodo de prueba configurado en la plataforma.

- **Auth:** Pública
- **Response 200:** `{"trial_days": 15}`

---

### 3.3. Admin Operations Router (`/api/admin`) — 29 Endpoints

Módulo: [backend/app/routers/admin.py](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/routers/admin.py)  
*Todos los endpoints de este router requieren `Authorization: Bearer <admin_token>`.*

| Método | Ruta | Query / Body | Respuesta / Descripción | Errores / WS |
|--------|------|--------------|-------------------------|--------------|
| `POST` | `/api/admin/onboarding` | Body: `OnboardingRequest` (`full_name`, `phone`, `role`, `city`, `country`, `venue_name`, `venue_address`, `venue_type`, `venue_type_other`) | `{"message": "Onboarding completado"}`. Guarda perfil del admin y temática del bar. | 401, 422 si tipo es 'otro' sin detalle |
| `GET` | `/api/admin/queue` | Ninguno | Retorna estado completo: `now_playing`, `queue`, `playback_status`, `volume`, `banner_text`, `show_brand`, `show_qr`, `qr_size`, `fallback_active`, `fallback_playlist`. | 401 |
| `GET` | `/api/admin/played` | Ninguno | Lista canciones reproducidas hoy: `[{"id", "youtube_id", "title", "duration_sec", "added_by", "played_at"}]`. | 401 |
| `DELETE` | `/api/admin/queue/songs/{song_id}` | Path: `song_id: int` | `{"status": "removed", "song_id": int}`. Elimina canción pendiente. | 401, 404. WS: `song_removed`, `rate_limit_reset` |
| `POST` | `/api/admin/queue/songs/{song_id}/play-now` | Path: `song_id: int` | `{"status": "playing", "song_id": int}`. Interrumpe la canción actual y reproduce esta de inmediato. | 401, 404. WS: `now_playing_changed`, `your_song_playing`, `fallback_skip` |
| `PATCH` | `/api/admin/queue/songs/{song_id}` | Path: `song_id`, Body: `{"position": int}` | `{"status": "reordered", "song_id": int, "new_position": int}`. Reordena la cola. | 401, 404. WS: `queue_reordered` |
| `POST` | `/api/admin/queue/songs` | Body: `{"youtube_url": str}` | `{"status": "added", "song": {...}}`. Inserción manual de canción por el admin (sin rate limit). | 400, 409. WS: `song_added` / `now_playing_changed` |
| `POST` | `/api/admin/queue/skip` | Ninguno | `{"status": "skipped", "now_playing": {...}}`. Salta la canción actual. | 401. WS: `now_playing_changed`, `rate_limit_reset`, `your_song_playing`, `fallback_skip` |
| `POST` | `/api/admin/playback/start` | Ninguno | `{"status": "started", "now_playing": {...}}`. Inicia la primera canción pendiente si el reproductor estaba detenido. | 401. WS: `now_playing_changed`, `your_song_playing` |
| `GET` | `/api/admin/playlist` | Ninguno | Retorna canciones activas en la lista de respaldo (`fallback_songs` del local). | 401 |
| `POST` | `/api/admin/fallback-status` | Query: `paused: bool = False` | `{"status": "ok", "paused": bool}`. Pausa/reanuda la reproducción de respaldo. | 401. WS: `fallback_status_changed` |
| `POST` | `/api/admin/fallback-play` | Ninguno | `{"status": "ok"}`. Fuerza al kiosco a cambiar a playlist de respaldo. | 400 (si vacía). WS: `fallback_play_now` |
| `POST` | `/api/admin/fallback-skip` | Ninguno | `{"status": "ok"}` o `{"status": "playing_queue"}`. Salta canción de respaldo actual. | 401. WS: `fallback_skip`, `now_playing_changed` |
| `POST` | `/api/admin/fallback/add` | Query: `youtube_id: str` | `{"status": "added", "song": {...}}`. Agrega video a la playlist de respaldo. | 400 (duplicado o no encontrado) |
| `DELETE` | `/api/admin/fallback/{song_id}` | Path: `song_id: int` | `{"status": "removed", "song_id": int}`. Elimina canción de respaldo. | 401, 404 |
| `POST` | `/api/admin/playback/pause` | Ninguno | `{"status": "paused"}`. Pausa global de reproducción en el kiosco. | 401. WS: `playback_status_changed` |
| `POST` | `/api/admin/playback/resume` | Ninguno | `{"status": "playing"}`. Reanuda reproducción en el kiosco. | 401. WS: `playback_status_changed` |
| `GET` | `/api/admin/history` | Query: `page=1`, `per_page=20`, `date_from`, `date_to` | `{"items": [...], "total": int, "page": int, "per_page": int, "pages": int}`. Historial paginado. | 401 |
| `GET` | `/api/admin/analytics` | Query: `period="week"` (`day|week|month|all`) | Métricas del bar: total reproducciones, usuarios únicos, horas pico, géneros/artistas top. | 401 |
| `GET` | `/api/admin/library` | Query: `search: str | None` | Catálogo de canciones reproducidas previamente con contador de popularidad. | 401 |
| `POST` | `/api/admin/volume` | Query: `volume: int` (0-100) | `{"volume": int}`. Ajusta el volumen del reproductor en vivo. | 401. WS: `volume_changed` |
| `POST` | `/api/admin/banner` | Query: `text: str`, `show_brand: bool | None` | `{"banner_text": str}`. Configura cintillo de texto en pantalla del kiosco. | 401. WS: `banner_changed` |
| `POST` | `/api/admin/show-qr` | Query: `show: bool | None`, `size: str | None` (`S|M|L`) | `{"show_qr": bool, "qr_size": str}`. Controla visibilidad del código QR en pantalla. | 400 (talla inválida). WS: `qr_visibility_changed` |
| `GET` | `/api/admin/tables` | Ninguno | `{"tables": [{"table_number", "users", "pending_songs", "played_songs", "rate_limit"}]}`. | 401 |
| `POST` | `/api/admin/tables/{table_number}/kick` | Path: `table_number: str` | `{"status": "kicked", "table_number": str, "sessions_ended": int, "songs_removed": int}`. | 401. WS: `session_kicked`, `song_removed` |
| `POST` | `/api/admin/tables/{table_number}/reset-limit` | Path: `table_number: str` | `{"message": "Limite de X reseteado"}`. Reinicia la cuota de canciones de la mesa. | 401. WS: `rate_limit_reset` |
| `GET` | `/api/admin/daily-pin` | Ninguno | `{"pin": "1234", "date": "YYYY-MM-DD", "require_pin": bool}`. PIN del día. | 401 |
| `POST` | `/api/admin/daily-pin/regenerate` | Ninguno | `{"pin": "5678", "date": "YYYY-MM-DD"}`. Regenera PIN del día. | 401 |
| `POST` | `/api/admin/settings/pin` | Query: `require: bool` | `{"require_pin": bool}`. Habilita o deshabilita la exigencia de PIN. | 401 |

---

### 3.4. Queue Router (`/api/queue`) — 9 Endpoints

Módulo: [backend/app/routers/queue.py](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/routers/queue.py)

#### `GET /api/queue/search`
Búsqueda de canciones en YouTube mediante scraping asíncrono con caché en memoria (TTL: 5 min, máx 500 consultas) sin consumir cuota de API Key.

- **Auth:** Pública
- **Query Params:** `q: str` (mínimo 2 caracteres)
- **Response 200:**
  ```json
  [
    {
      "youtube_id": "dQw4w9WgXcQ",
      "title": "Rick Astley - Never Gonna Give You Up",
      "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      "duration": "3:33",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    }
  ]
  ```

#### `GET /api/queue`
Retorna el estado público de la cola del venue (canción sonando, lista de espera, marca y tema).

- **Auth:** Pública
- **Query Params:** `venue: str` (slug del local, requerido)
- **Response 200:**
  ```json
  {
    "now_playing": {
      "id": 101,
      "youtube_id": "dQw4w9WgXcQ",
      "title": "Rick Astley - Never Gonna Give You Up",
      "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      "duration_sec": 213,
      "duration_formatted": "3:33",
      "added_by": "Carlos",
      "table_number": "5",
      "playing_since": "2026-08-25T14:10:00",
      "user_id": 42
    },
    "queue": [
      {
        "id": 102,
        "position": 1,
        "youtube_id": "kJQP7kiw5Fk",
        "title": "Luis Fonsi - Despacito",
        "thumbnail_url": "https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg",
        "duration_sec": 282,
        "added_by": "Maria",
        "table_number": "3",
        "added_at": "2026-08-25T14:12:00",
        "estimated_wait_sec": 120
      }
    ],
    "total_in_queue": 1,
    "playback_status": "playing",
    "fallback_active": false,
    "fallback_playlist": [],
    "venue_name": "Bar La Esquina",
    "venue_logo": "/api/uploads/logo.png"
  }
  ```
- **Errores:** `404` `{"detail": "Bar no encontrado"}`

#### `POST /api/queue/songs`
Valida una URL de YouTube, comprueba restricciones de duración, bloqueo y cuota de usuario, retornando la previsualización del video.

- **Auth:** Customer Bearer Token
- **Body:** `{"youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}`
- **Response 200:**
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
- **Errores:** Ver tabla de `X-Error-Code` (`INVALID_URL`, `RATE_LIMIT_EXCEEDED`, `ALREADY_IN_QUEUE`, `VIDEO_NOT_FOUND`, `VIDEO_NOT_EMBEDDABLE`, `VIDEO_BLOCKED`, `DURATION_EXCEEDED`).

#### `POST /api/queue/songs/confirm`
Confirma la inclusión definitiva de la canción previsualizada en la cola de reproducción.

- **Auth:** Customer Bearer Token
- **Body:** `{"youtube_id": "dQw4w9WgXcQ"}`
- **Response 201:**
  ```json
  {
    "id": 105,
    "youtube_id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "position": 2,
    "estimated_wait_sec": 495,
    "songs_remaining": 2,
    "window_resets_at": "2026-08-25T14:40:00"
  }
  ```
- **WebSocket:** Emite `song_added` (broadcast) o `now_playing_changed` + `your_song_playing` si la cola estaba vacía.

#### `POST /api/queue/start-playing/{song_id}`
Invocado por el Kiosco para marcar una canción de la cola en estado `playing` de manera inmediata.

- **Auth:** Pública
- **Path Params:** `song_id: int`
- **Query Params:** `venue: str`
- **Response 200:** `{"status": "playing", "song_id": 105}`
- **WebSocket:** Emite `now_playing_changed` y `your_song_playing`.

#### `GET /api/queue/my-songs`
Obtiene las canciones pedidas por el usuario autenticado (canción activa actual y pendientes).

- **Auth:** Customer Bearer Token
- **Response 200:** `{"now_playing": {...} | null, "pending": [...]}`

#### `GET /api/queue/recent-history`
Obtiene las últimas 5 canciones pedidas por el usuario que ya sonaron.

- **Auth:** Customer Bearer Token
- **Response 200:** `[{"youtube_id": "...", "title": "...", "played_at": "..."}]`

#### `GET /api/queue/remaining-slots`
Consulta el cupo disponible del usuario bajo el rate limit actual.

- **Auth:** Customer Bearer Token
- **Response 200:**
  ```json
  {
    "remaining": 3,
    "max": 5,
    "window_minutes": 20,
    "resets_at": "2026-08-25T14:40:00"
  }
  ```

#### `DELETE /api/queue/my-songs/{song_id}`
Cancela una canción que el propio usuario encoló mientras aún se encuentra en estado `pending`.

- **Auth:** Customer Bearer Token
- **Path Params:** `song_id: int`
- **Response 200:** `{"status": "cancelled", "song_id": 105}`
- **Errores:** `404` `{"detail": "Cancion no encontrada o no pertenece a tu sesion"}`
- **WebSocket:** Emite `song_removed`.

---

### 3.5. Playback Router (`/api/playback`) — 4 Endpoints

Módulo: [backend/app/routers/playback.py](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/routers/playback.py)

#### `GET /api/playback/now-playing`
Consulta de polling de alta fidelidad utilizada por el kiosco para sincronización de audio, volumen, cintillo y banners.

- **Auth:** Pública
- **Query Params:** `venue: str`
- **Response 200:** Estado de reproducción completo del kiosco.

#### `POST /api/playback/fallback-playing`
Notifica al backend que el kiosco comenzó a reproducir un video de la playlist de respaldo.

- **Auth:** Pública
- **Query Params:** `venue: str`, `youtube_id: str`, `title: str`
- **Response 200:** `{"status": "ok"}`
- **WebSocket:** Emite `now_playing_changed` marcando `is_fallback: true`.

#### `POST /api/playback/finished`
Notifica que la canción actual terminó de reproducirse. Registra el evento en `play_history`, marca la canción como `played`, avanza la cola y restaura cuotas.

- **Auth:** Opcional (Header `Authorization`)
- **Body:**
  ```json
  {
    "song_id": 105,
    "venue_slug": "bar-la-esquina"
  }
  ```
- **Response 200:** `{"status": "advanced", "now_playing": {...}}` o `{"status": "queue_empty"}`
- **WebSocket:** Emite `rate_limit_reset`, `now_playing_changed`, `your_song_playing`.

#### `POST /api/playback/error`
Reporta fallo de reproducción en el IFrame de YouTube (ej. código 101/150 de inserción bloqueada o video eliminado). Realiza auto-reintento (hasta 3 veces) o salta automáticamente la canción rota.

- **Auth:** Opcional (Header `Authorization`)
- **Body:**
  ```json
  {
    "song_id": 105,
    "venue_slug": "bar-la-esquina",
    "error_code": 150
  }
  ```
- **Response 200:** `{"status": "skipped", "now_playing": {...}}` o `{"status": "retrying", "attempt": 1}`
- **WebSocket:** Emite `song_error`, `song_error_notification`, `now_playing_changed`.

---

### 3.6. SuperAdmin Router (`/api/superadmin`) — 29 Endpoints

Módulo: [backend/app/routers/superadmin.py](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/routers/superadmin.py)  
*Requiere `Authorization: Bearer <super_admin_token>`. Los roles disponibles son `super_admin`, `vendedor`, `editor`.*

| Método | Ruta | Rol Requerido | Body / Parámetros | Descripción |
|--------|------|---------------|-------------------|-------------|
| `POST` | `/api/superadmin/login` | Público | `{"username", "password"}` | Login del panel de superadministración. Devuelve JWT de 8h. |
| `GET` | `/api/superadmin/settings` | Todos | Ninguno | Lee configuración global (`trial_days`, `grace_period_days`, `monthly_price_cents`). |
| `PATCH` | `/api/superadmin/settings` | `super_admin` | `{"trial_days", "grace_period_days", "monthly_price_cents"}` | Actualiza configuración global de plataforma. |
| `GET` | `/api/superadmin/billing/summary` | Todos | Ninguno | Reporte de ventas: MRR, locales activos, en prueba, suspendidos e ingresos del mes. |
| `GET` | `/api/superadmin/venues` | Todos | Ninguno | Lista todos los locales con estado de pago, administradores asignados y fechas de expiración. |
| `POST` | `/api/superadmin/venues` | `vendedor`, `super_admin` | Body: `CreateVenueRequest` | Crea un bar con su admin, límites de cola, logo, QR y días de prueba. |
| `PATCH` | `/api/superadmin/venues/{venue_id}` | `vendedor`, `super_admin` | Body: `UpdateVenueRequest` | Modifica configuración del local (límites, logo, QR, tema, estado activo). |
| `DELETE` | `/api/superadmin/venues/{venue_id}` | `super_admin` | Path: `venue_id: int` | Elimina permanentemente un local y sus datos en cascada. |
| `GET` | `/api/superadmin/venues/{venue_id}/stats` | Todos | Path: `venue_id: int` | Métricas operativas individuales del bar (canciones pedidas, usuarios, historial). |
| `GET` | `/api/superadmin/venues/{venue_id}/analytics` | Todos | Query: `period="week"` | Analítica detallada del bar por periodo. |
| `GET` | `/api/superadmin/venues/{venue_id}/users` | Todos | Path: `venue_id: int` | Lista de clientes registrados en el bar con sus estadísticas de uso. |
| `POST` | `/api/superadmin/venues/{venue_id}/admins` | `vendedor`, `super_admin` | `{"username", "password"}` | Asigna un nuevo administrador a un bar existente. |
| `DELETE` | `/api/superadmin/venues/{venue_id}/admins/{admin_id}` | `vendedor`, `super_admin` | Path: `venue_id`, `admin_id` | Elimina un administrador de un bar. |
| `GET` | `/api/superadmin/venues/{venue_id}/playlist` | Todos | Path: `venue_id: int` | Lista canciones de respaldo configuradas para ese local. |
| `POST` | `/api/superadmin/venues/{venue_id}/playlist/import` | `editor`, `vendedor`, `super_admin` | `{"playlist_url": "https://..."}` | Importa canciones desde una lista de reproducción de YouTube. |
| `POST` | `/api/superadmin/venues/{venue_id}/playlist/add` | `editor`, `vendedor`, `super_admin` | `{"youtube_url": "https://..."}` | Añade un video individual a la lista de respaldo del local. |
| `DELETE` | `/api/superadmin/venues/{venue_id}/playlist/{song_id}` | `editor`, `vendedor`, `super_admin` | Path: `venue_id`, `song_id` | Elimina canción de respaldo. |
| `PATCH` | `/api/superadmin/venues/{venue_id}/playlist/{song_id}/toggle` | `editor`, `vendedor`, `super_admin` | Path: `venue_id`, `song_id` | Habilita/deshabilita una canción en la rotación de respaldo. |
| `DELETE` | `/api/superadmin/venues/{venue_id}/playlist` | `editor`, `vendedor`, `super_admin` | Path: `venue_id: int` | Vacía completamente la playlist de respaldo del local. |
| `POST` | `/api/superadmin/venues/{venue_id}/logo` | `vendedor`, `super_admin` | Form: `file: UploadFile` | Sube imagen de logo (PNG, JPG, SVG, máx 2MB) a `/data/logos/`. |
| `POST` | `/api/superadmin/venues/{venue_id}/mark-paid` | `vendedor`, `super_admin` | `{"months": int, "days": int, "notes": str, "amount_cents": int}` | Registra pago manual (efectivo/transferencia) y extiende `paid_until`. |
| `POST` | `/api/superadmin/venues/{venue_id}/extend-trial` | `vendedor`, `super_admin` | `{"days": int}` | Extiende el periodo de prueba gratuito por N días adicionales. |
| `POST` | `/api/superadmin/venues/{venue_id}/adjust-expiry` | `vendedor`, `super_admin` | `{"paid_until": "YYYY-MM-DD", "notes": str}` | Fija fecha de vencimiento exacta con nota de auditoría obligatoria. |
| `POST` | `/api/superadmin/venues/{venue_id}/billing/events/{event_id}/void` | `super_admin` | Path: `venue_id`, `event_id` | Anula un evento contable/pago en el historial del bar. |
| `PATCH` | `/api/superadmin/venues/{venue_id}/billing/events/{event_id}` | `super_admin` | `{"notes", "amount_cents", "period_end"}` | Edita nota o monto de un evento de facturación registrado. |
| `GET` | `/api/superadmin/admins` | `super_admin` | Ninguno | Lista todas las cuentas de superadministradores y vendedores. |
| `POST` | `/api/superadmin/admins` | `super_admin` | `{"username", "password", "phone", "email", "role"}` | Crea un nuevo usuario superadministrador o vendedor. |
| `PATCH` | `/api/superadmin/admins/{admin_id}` | `super_admin` | `{"role", "password"}` | Modifica rol o contraseña de un superadministrador. |
| `DELETE` | `/api/superadmin/admins/{admin_id}` | `super_admin` | Path: `admin_id: int` | Elimina una cuenta de superadministrador. |

---

### 3.7. Billing & Webhooks Router (`/api/admin` & `/api/billing`) — 3 Endpoints

Módulo: [backend/app/routers/billing.py](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/routers/billing.py)

#### `GET /api/admin/billing`
Consulta el estado de suscripción del bar autenticado, días restantes, precio mensual e historial de pagos/pruebas. Accesible incluso si el bar se encuentra en estado `suspended` por falta de pago.

- **Auth:** Admin Bearer Token
- **Response 200:**
  ```json
  {
    "payment_status": "active",
    "paid_until": "2026-09-24",
    "period_start": "2026-08-25",
    "days_remaining": 30,
    "monthly_price_cents": 15000000,
    "history": [
      {
        "id": 1,
        "kind": "payment",
        "source": "wompi",
        "amount_cents": 15000000,
        "days": 30,
        "period_start": "2026-08-25",
        "period_end": "2026-09-24",
        "created_at": "2026-08-25T10:00:00",
        "status": "approved"
      }
    ]
  }
  ```

#### `GET /api/admin/billing/checkout`
Genera la firma criptográfica SHA256 requerida por el widget de Checkout de Wompi Colombia (`reference + amount + currency + WOMPI_INTEGRITY_SECRET`).

- **Auth:** Admin Bearer Token
- **Response 200:**
  ```json
  {
    "public_key": "pub_prod_XXXXXX",
    "currency": "COP",
    "amount_in_cents": 15000000,
    "reference": "repitela-1-1711234567",
    "signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
  ```
- **Errores:** `409` `{"detail": "No hay un precio configurado todavia"}`, `503` `{"detail": "Wompi no esta configurado"}`.

#### `POST /api/billing/wompi/webhook`
Receptor de notificaciones de eventos de pago de Wompi Colombia (`transaction.updated`). Valida la firma HMAC-SHA256 con `WOMPI_EVENTS_SECRET` y extiende automáticamente `paid_until` por 30 días si el pago es aprobado.

- **Auth:** Firma HMAC-SHA256 en cuerpo (`signature.checksum`)
- **Body:** Payload estándar de eventos de Wompi Colombia
- **Response 200:** `{"ok": true}`
- **Errores:** `400` `{"detail": "JSON invalido"}`, `403` `{"detail": "Firma invalida"}`, `503` `{"detail": "Wompi no esta configurado"}`.

---

### 3.8. Main / Servidor de Archivos (`/api`) — 2 Endpoints

Módulo: [backend/app/main.py](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/main.py)

#### `GET /api/uploads/{filename}`
Sirve archivos estáticos subidos (logos de bares) con encabezados de caché `Cache-Control: public, max-age=604800`.

- **Auth:** Pública
- **Path Params:** `filename: str`
- **Response 200:** Archivo binario con Content-Type correspondiente (`image/png`, `image/jpeg`, `image/svg+xml`).
- **Errores:** `404` `{"detail": "File not found"}`.

#### `GET /api/health`
Healthcheck de infraestructura. Verifica la conectividad con SQLite (`SELECT 1`).

- **Auth:** Pública
- **Response 200:**
  ```json
  {
    "status": "ok",
    "version": "1.0.2",
    "database": "connected"
  }
  ```

---

### 3.9. Test Environment Router (`/api/test`) — 1 Endpoint

Módulo: [backend/app/routers/test.py](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/routers/test.py)  
*(Montado exclusivamente cuando `APP_ENV=test` en [backend/app/main.py:96](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/main.py#L96)).*

#### `POST /api/test/reset`
Limpia todas las tablas de la base de datos e inserta datos base para pruebas deterministas E2E.

- **Auth:** Guard de entorno (`settings.app_env == "test"`)
- **Response 200:** `{"status": "ok", "message": "Database reset and seeded"}`
- **Errores:** `403` `{"detail": "Only allowed in test environment"}`.

---

## 4. WebSocket API (`/ws/queue`)

Módulo: [backend/app/routers/websocket.py](file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/app/routers/websocket.py)

### Conexión
```
ws://{domain}/ws/queue?venue={venue_slug}&token={jwt_token}
```

- **Parámetros:**
  - `venue` (requerido, query string): Slug del bar. Si no existe, cierra con código `4004`.
  - `token` (opcional, query string): Token JWT de sesión de cliente o admin. Si no se envía o expira, la conexión se mantiene abierta para eventos generales (broadcast), pero no recibirá notificaciones dirigidas.
  - `user_id` (deprecado, ignorado por seguridad: la identidad se extrae únicamente del token JWT).

---

### Catálogo de los 17 Eventos de WebSocket Emitidos por el Backend

> [!WARNING]
> **Evento Inexistente:** El evento `song_skipped` **nunca es emitido por el backend**. Cuando una canción se salta, el sistema emite `now_playing_changed`, `rate_limit_reset` al usuario afectado y `your_song_playing` al nuevo turno.

```
Formatos de mensaje WebSocket:
{
  "event": "<EVENT_NAME>",
  "data": { ... }
}
```

| # | Evento | Tipo de Envío | Payload (`data`) | Disparador y Contexto |
|---|--------|---------------|------------------|-----------------------|
| 1 | `song_added` | Broadcast | `{"song": {...}}` | Se encola una nueva canción (cliente o admin). |
| 2 | `song_removed` | Broadcast | `{"song_id": int}` | Admin o usuario cancela/elimina una canción pendiente. |
| 3 | `now_playing_changed` | Broadcast | `{"now_playing": {...} \| null, "previous_song": {...} \| null}` | Cambia la canción activa (por inicio, skip, término o play-now). |
| 4 | `your_song_playing` | Dirigido (`send_to_user`) | `{"song": {...}}` | Enviado al dueño de la canción cuando su video entra a sonar. |
| 5 | `queue_reordered` | Broadcast | `{"queue": [...]}` | Admin altera el orden de las canciones en espera. |
| 6 | `playback_status_changed` | Broadcast | `{"status": "playing" \| "paused"}` | Admin pausa o reanuda la reproducción general. |
| 7 | `banner_changed` | Broadcast | `{"banner_text": str, "show_brand": bool}` | Admin actualiza el texto del cintillo o logo en pantalla. |
| 8 | `volume_changed` | Broadcast | `{"volume": int}` | Admin ajusta el nivel de volumen en vivo (0 a 100). |
| 9 | `qr_visibility_changed` | Broadcast | `{"show_qr": bool, "qr_size": "S" \| "M" \| "L"}` | Admin cambia visibilidad o tamaño del QR en pantalla. |
| 10 | `fallback_status_changed` | Broadcast | `{"paused": bool}` | Admin pausa o activa la playlist de respaldo. |
| 11 | `fallback_play_now` | Broadcast | `{}` | Admin fuerza al kiosco a cambiar a playlist de respaldo. |
| 12 | `fallback_skip` | Broadcast | `{}` | Kiosco o admin salta canción de respaldo o vuelve a cola. |
| 13 | `session_kicked` | Dirigido (`send_to_user`) | `{"reason": "session_terminated"}` | Admin expulsa a una mesa o usuario del local. |
| 14 | `rate_limit_reset` | Dirigido (`send_to_user`) | `{"songs_remaining": int}` | Admin resetea el límite de una mesa o finaliza su canción. |
| 15 | `table_registered` | Broadcast | `{"table_number": str \| null, "user_name": str}` | Notifica al panel admin cuando un cliente escanea y se registra. |
| 16 | `song_error` | Broadcast | `{"song_id": int, "error_code": int}` | Kiosco reporta fallo en YouTube IFrame y salta de canción. |
| 17 | `song_error_notification` | Dirigido (`send_to_user`) | `{"song_id": int, "title": str, "error_code": int}` | Notifica al cliente que su canción no pudo ser reproducida. |
