# API Reference - Repitela.com

> **Índice:** [[README]] · **Autoridad sobre:** los 86 endpoints y su contrato · **Últ. cambio:** 2026-08-25
> Si esta página contradice al código, gana el código y esta página tiene un bug.

Base URL en producción: `https://{domain}/api`

> ⚠️ **La API no tiene versionado (2026-09-02).** Todo cuelga de `/api/` sin
> número de versión, así que un cliente viejo y uno nuevo piden la misma
> dirección. Las pantallas de los bares llevan días o semanas sin recargar: hoy
> **no hay forma segura de hacer un cambio incompatible**. Eso bloquea la
> separación de `/api/admin`, la unificación de tenancy y el paso de los seis
> POST con estado en query string a body. Rastreado en WIL-207.  
Base URL en desarrollo: `http://localhost:8000/api`

---

## 1. Índice General de Módulos y Endpoints

El backend expone **88 endpoints HTTP** (85 en routers principales + 2 en `main.py` + 1 en `test.py` para entorno de pruebas) y **1 endpoint de WebSocket** (`/ws/queue`), para un total de **89 rutas registradas**.

```
ÍNDICE DE ROUTERS:
├── 1. Auth Router (auth.py)                   :  4 endpoints HTTP
├── 2. Admin Auth Router (admin_auth.py)       :  7 endpoints HTTP
├── 3. Admin Operations Router (admin.py)      : 29 endpoints HTTP
├── 4. Queue Router (queue.py)                 :  9 endpoints HTTP
├── 5. Playback Router (playback.py)           :  4 endpoints HTTP
├── 6. SuperAdmin Router (superadmin.py)       : 29 endpoints HTTP
├── 7. Billing & Webhook Router (billing.py)   :  3 endpoints HTTP
├── 8. Main & System Routes (main.py)          :  2 endpoints HTTP
├── 9. Test Environment Router (test.py)       :  1 endpoint HTTP (APP_ENV=test)
└── 10. WebSocket Endpoint (websocket.py)      :  1 endpoint WS (/ws/queue) + 17 eventos
```

---

## 2. Convenciones de Errores y Seguridad

### Formato de Errores
Todas las respuestas de error siguen el estándar nativo de **FastAPI / Starlette** con cuerpo JSON:

```json
{
  "detail": "Descripción del error en lenguaje natural"
}
```

Para errores de validación de esquema Pydantic (HTTP 422), `detail` es una lista de objetos describiendo la regla violada:

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
> **Inconsistencia de Arquitectura:** El header `X-Error-Code` está implementado actualmente de forma exclusiva en los routers `auth.py` y `queue.py` (y `queue_service.py`). Los routers `admin.py`, `admin_auth.py`, `superadmin.py`, `playback.py`, `billing.py` y `main.py` devuelven únicamente el cuerpo `{"detail": "..."}` con el status HTTP correspondiente, sin incluir el header `X-Error-Code`.

### Tabla de Códigos `X-Error-Code` Soportados

| Código en Header `X-Error-Code` | Status HTTP | Router | Descripción |
|---------------------------------|-------------|--------|-------------|
| `CONSENT_REQUIRED` | 400 | [auth.py:37](../backend/app/routers/auth.py#L37) | El usuario no aceptó el tratamiento de datos (`data_consent=false`). |
| `INVALID_PHONE` | 422 | [auth.py:41](../backend/app/routers/auth.py#L41) | El teléfono no cumple la longitud mínima (8 caracteres). |
| `PIN_REQUIRED` | 400 | [auth.py:55](../backend/app/routers/auth.py#L55) | El venue exige PIN diario y la petición no lo incluyó. |
| `PIN_INVALID` | 403 | [auth.py:61](../backend/app/routers/auth.py#L61) | El PIN ingresado no coincide con el PIN activo del día. |
| `VENUE_NOT_FOUND` | 404 | [auth.py:74](../backend/app/routers/auth.py#L74) | El slug del venue no existe en la base de datos. |
| `INVALID_URL` | 400 | [queue.py:64](../backend/app/routers/queue.py#L64) | La URL de YouTube no coincide con los patrones válidos. |
| `RATE_LIMIT_EXCEEDED` | 429 | [queue.py:73,147](../backend/app/routers/queue.py#L73) | El usuario excedió el límite de canciones en la ventana temporal. |
| `ALREADY_IN_QUEUE` | 409 | [queue.py:78,152](../backend/app/routers/queue.py#L78) | La canción ya se encuentra en cola (`pending` o `playing`). |
| `VIDEO_NOT_FOUND` | 404 | [queue.py:84](../backend/app/routers/queue.py#L84) | YouTube oEmbed / Data API no encontró el video. |
| `VIDEO_NOT_EMBEDDABLE` | 400 | [queue.py:88](../backend/app/routers/queue.py#L88) | El video tiene restricciones de reproducción externa/embebido. |
| `VIDEO_BLOCKED` | 400 | [queue.py:101,165](../backend/app/routers/queue.py#L101) | El video está en la lista negra `blocked_videos` del local. |
| `DURATION_EXCEEDED` | 400 | [queue.py:114,194](../backend/app/routers/queue.py#L114) | La duración supera `max_duration_sec` configurado en el venue. |

---

## 3. Autenticación y Tipos de Token

Los endpoints protegidos requieren el header:
```http
Authorization: Bearer <jwt_token>
```

Existen 3 tipos de tokens emitidos con JWT HS256:
1. **Cliente Final (Customer JWT):** Expira en 24h. Payload: `{"user_id": int, "session_id": str, "venue_id": int}`. Se invalida por inactividad (>120 min).
2. **Administrador de Bar (Admin JWT):** Expira en 8h. Payload: `{"admin_id": int, "username": str, "venue_id": int, "is_admin": true}`.
3. **SuperAdmin JWT:** Expira en 8h. Payload: `{"user_id": int, "username": str, "is_super_admin": true, "role": "super_admin" | "vendedor" | "editor"}`.

---

## 4. Documentación Detallada de Todos los Endpoints

---

### 4.1. Auth Router (`/api/auth`) — 4 Endpoints

Módulo: [backend/app/routers/auth.py](../backend/app/routers/auth.py)

| Método y Ruta | Auth Requerida | Parámetros / Cuerpo | Respuesta Exitosa | Errores / Headers |
|---|---|---|---|---|
| `POST /api/auth/register`<br>([auth.py:35](../backend/app/routers/auth.py#L35)) | Pública | **Body (JSON):**<br>• `phone`: `str` (8-20 car.)<br>• `venue_slug`: `str`<br>• `data_consent`: `bool`<br>• `table_number`: `str \| null = null`<br>• `display_name`: `str \| null = null`<br>• `pin`: `str \| null = null` | **Status 201 Created**<br>`{"token": str, "user": {"id": int, "phone": str, "display_name": str\|null}, "session": {"id": str, "table_number": str\|null, "venue_slug": str, "venue_id": int, "started_at": str}}` | **400** `CONSENT_REQUIRED`<br>**422** `INVALID_PHONE`<br>**400** `PIN_REQUIRED`<br>**403** `PIN_INVALID`<br>**404** `VENUE_NOT_FOUND`<br>**403** Bar inactivo |
| `GET /api/auth/session`<br>([auth.py:98](../backend/app/routers/auth.py#L98)) | Cliente JWT | Ninguno (actualiza timestamp de actividad de sesión) | **Status 200 OK**<br>`{"user": {"id": int, "phone": str, "display_name": str}, "session": {...}, "rate_limit": {"songs_remaining": int, "window_resets_at": str}}` | **401** Sesión inválida / expirada por inactividad<br>**404** Usuario no encontrado |
| `PATCH /api/auth/profile`<br>([auth.py:130](../backend/app/routers/auth.py#L130)) | Cliente JWT | **Body (JSON):**<br>• `display_name`: `str` | **Status 200 OK**<br>`{"id": int, "phone": str, "display_name": str}` | **401** No autorizado<br>**422** Error de validación |
| `GET /api/auth/venue-info`<br>([auth.py:147](../backend/app/routers/auth.py#L147)) | Pública | **Query:**<br>• `venue_slug`: `str` (requerido) | **Status 200 OK**<br>`{"id": int, "name": str, "active": bool, "logo_url": str\|null, "pin_required": bool, "theme": str\|null}` | **404** `Bar no encontrado` |

---

### 4.2. Admin Auth Router (`/api/admin`) — 7 Endpoints

Módulo: [backend/app/routers/admin_auth.py](../backend/app/routers/admin_auth.py)  
*Limitador en memoria: Máximo 5 intentos/min por IP y ruta (responde HTTP 429 al superarlo).*

| Método y Ruta | Auth Requerida | Parámetros / Cuerpo | Respuesta Exitosa | Errores / Notas |
|---|---|---|---|---|
| `POST /api/admin/login`<br>([admin_auth.py:103](../backend/app/routers/admin_auth.py#L103)) | Pública (Rate Limit) | **Body (JSON):**<br>• `username`: `str`<br>• `password`: `str`<br>• `venue_slug`: `str \| null` | **Status 200 OK**<br>`{"token": str, "admin": {"id": int, "username": str, "venue_id": int, "venue_slug": str, "venue_name": str, "onboarding_completed_at": str\|null}}` | **401** Credenciales incorrectas<br>**403** Bar inactivo / usuario ajeno al bar<br>**404** Bar no encontrado<br>**429** Límite superado |
| `POST /api/admin/signup`<br>([admin_auth.py:128](../backend/app/routers/admin_auth.py#L128)) | Pública (Turnstile + Rate Limit) | **Body (JSON):**<br>• `venue_name`, `email`, `password`, `phone`, `address`, `city`, `country`, `terms_version`, `terms_accepted`, `privacy_accepted`, `turnstile_token` | **Status 201 Created**<br>`{"message": "Cuenta creada. Revisa tu correo para verificarla.", "venue_slug": str}` | **400** Términos o Turnstile inválido<br>**409** Correo ya registrado<br>**422** Datos inválidos<br>**429** Límite superado |
| `POST /api/admin/verify-email`<br>([admin_auth.py:150](../backend/app/routers/admin_auth.py#L150)) | Pública (Rate Limit) | **Body (JSON):**<br>• `token`: `str` | **Status 200 OK**<br>`{"message": "Correo verificado"}` | **400** Token inválido o vencido<br>**429** Límite superado |
| `POST /api/admin/forgot-password`<br>([admin_auth.py:159](../backend/app/routers/admin_auth.py#L159)) | Pública (Rate Limit) | **Body (JSON):**<br>• `email`: `str` | **Status 200 OK**<br>`{"message": "Si el correo existe, te enviamos instrucciones"}` | **429** Límite superado |
| `POST /api/admin/reset-password`<br>([admin_auth.py:165](../backend/app/routers/admin_auth.py#L165)) | Pública (Rate Limit) | **Body (JSON):**<br>• `token`: `str`<br>• `password`: `str` (min 8 car.) | **Status 200 OK**<br>`{"message": "Contrasena actualizada"}` | **400** Token inválido o vencido<br>**429** Límite superado |
| `POST /api/admin/google-signup`<br>([admin_auth.py:174](../backend/app/routers/admin_auth.py#L174)) | Pública (Turnstile + Rate Limit) | **Body (JSON):**<br>• `token` (Google ID Token), `venue_name`, `phone`, `address`, `city`, `country`, `terms_version`, `terms_accepted`, `privacy_accepted`, `turnstile_token` | **Status 201 Created**<br>`{"token": str, "admin": {...}}` | **400** Términos o Turnstile inválido<br>**401** Token de Google inválido<br>**503** Google OAuth no configurado |
| `GET /api/admin/trial-info`<br>([admin_auth.py:193](../backend/app/routers/admin_auth.py#L193)) | Pública | Ninguno | **Status 200 OK**<br>`{"trial_days": 15}` | Ninguno |

---

### 4.3. Admin Operations Router (`/api/admin`) — 29 Endpoints

Módulo: [backend/app/routers/admin.py](../backend/app/routers/admin.py)  
*Todos los endpoints de este router requieren autenticación de administrador de bar (`Admin Bearer Token`).*

| Método y Ruta | Parámetros / Cuerpo | Respuesta Exitosa | Errores / Eventos WebSocket |
|---|---|---|---|
| `POST /api/admin/onboarding`<br>([admin.py:40](../backend/app/routers/admin.py#L40)) | **Body (JSON):**<br>• `full_name`, `phone`, `role` (`"owner" \| "manager"`), `city`, `country`, `venue_name`, `venue_address`, `venue_type` (`"discoteca" \| "rock" \| "musica_popular" \| "otro"`), `venue_type_other` | **Status 200 OK**<br>`{"message": "Onboarding completado"}` | **401** No autenticado<br>**422** Tipo 'otro' sin detalle |
| `GET /api/admin/queue`<br>([admin.py:61](../backend/app/routers/admin.py#L61)) | Ninguno | **Status 200 OK**<br>`{"now_playing": {...}\|null, "queue": [...], "playback_status": str, "volume": int, "banner_text": str, "show_brand": bool, "show_qr": bool, "qr_size": str, "fallback_active": bool, "fallback_playlist": [...]}` | **401** No autenticado |
| `GET /api/admin/played`<br>([admin.py:126](../backend/app/routers/admin.py#L126)) | Ninguno | **Status 200 OK**<br>`[{"id": int, "youtube_id": str, "title": str, "duration_sec": int, "added_by": str, "played_at": str}]` | **401** No autenticado |
| `DELETE /api/admin/queue/songs/{song_id}`<br>([admin.py:152](../backend/app/routers/admin.py#L152)) | **Path:** `song_id: int` | **Status 200 OK**<br>`{"status": "removed", "song_id": int}` | **401** No autenticado<br>**404** Canción no encontrada<br>WS: `song_removed`, `rate_limit_reset` |
| `POST /api/admin/queue/songs/{song_id}/play-now`<br>([admin.py:168](../backend/app/routers/admin.py#L168)) | **Path:** `song_id: int` | **Status 200 OK**<br>`{"status": "playing", "song_id": int}` | **401** No autenticado<br>**404** Canción no encontrada<br>WS: `now_playing_changed`, `your_song_playing`, `fallback_skip` |
| `PATCH /api/admin/queue/songs/{song_id}`<br>([admin.py:203](../backend/app/routers/admin.py#L203)) | **Path:** `song_id: int`<br>**Body:** `{"position": int}` | **Status 200 OK**<br>`{"status": "reordered", "song_id": int, "new_position": int}` | **401** No autenticado<br>**404** Canción no encontrada<br>WS: `queue_reordered` |
| `POST /api/admin/queue/songs`<br>([admin.py:223](../backend/app/routers/admin.py#L223)) | **Body (JSON):**<br>• `youtube_url`: `str` | **Status 200 OK**<br>`{"status": "added", "song": {...}}` | **400** URL inválida / video no encontrado<br>**409** Ya en cola<br>WS: `song_added` / `now_playing_changed` |
| `POST /api/admin/queue/skip`<br>([admin.py:318](../backend/app/routers/admin.py#L318)) | Ninguno | **Status 200 OK**<br>`{"status": "skipped", "now_playing": {...}}` o `{"status": "queue_empty"}` | **401** No autenticado<br>WS: `now_playing_changed`, `rate_limit_reset`, `your_song_playing`, `fallback_skip` |
| `POST /api/admin/playback/start`<br>([admin.py:373](../backend/app/routers/admin.py#L373)) | Ninguno | **Status 200 OK**<br>`{"status": "started", "now_playing": {...}}` o `{"status": "queue_empty"}` | **401** No autenticado<br>WS: `now_playing_changed`, `your_song_playing`, `fallback_skip` |
| `GET /api/admin/playlist`<br>([admin.py:418](../backend/app/routers/admin.py#L418)) | Ninguno | **Status 200 OK**<br>`[{"id": int, "youtube_id": str, "title": str, "duration_sec": int, "artist": str, "active": bool}]` | **401** No autenticado |
| `POST /api/admin/fallback-status`<br>([admin.py:425](../backend/app/routers/admin.py#L425)) | **Query:** `paused: bool = False` | **Status 200 OK**<br>`{"status": "ok", "paused": bool}` | **401** No autenticado<br>WS: `fallback_status_changed` |
| `POST /api/admin/fallback-play`<br>([admin.py:440](../backend/app/routers/admin.py#L440)) | Ninguno | **Status 200 OK**<br>`{"status": "ok"}` | **400** Playlist vacía<br>WS: `fallback_play_now` |
| `POST /api/admin/fallback-skip`<br>([admin.py:455](../backend/app/routers/admin.py#L455)) | Ninguno | **Status 200 OK**<br>`{"status": "ok"}` o `{"status": "playing_queue", "song": {...}}` | **401** No autenticado<br>WS: `fallback_skip`, `now_playing_changed` |
| `POST /api/admin/fallback/add`<br>([admin.py:494](../backend/app/routers/admin.py#L494)) | **Query:** `youtube_id: str` | **Status 200 OK**<br>`{"status": "added", "song": {...}}` | **400** Canción duplicada o no encontrada |
| `DELETE /api/admin/fallback/{song_id}`<br>([admin.py:532](../backend/app/routers/admin.py#L532)) | **Path:** `song_id: int` | **Status 200 OK**<br>`{"status": "removed", "song_id": int}` | **404** Canción no encontrada |
| `POST /api/admin/playback/pause`<br>([admin.py:549](../backend/app/routers/admin.py#L549)) | Ninguno | **Status 200 OK**<br>`{"status": "paused"}` | **401** No autenticado<br>WS: `playback_status_changed` |
| `POST /api/admin/playback/resume`<br>([admin.py:560](../backend/app/routers/admin.py#L560)) | Ninguno | **Status 200 OK**<br>`{"status": "playing"}` | **401** No autenticado<br>WS: `playback_status_changed` |
| `GET /api/admin/history`<br>([admin.py:571](../backend/app/routers/admin.py#L571)) | **Query:** `page=1`, `per_page=20`, `date_from`, `date_to` | **Status 200 OK**<br>`{"items": [...], "total": int, "page": int, "per_page": int, "pages": int}` | **401** No autenticado |
| `GET /api/admin/analytics`<br>([admin.py:584](../backend/app/routers/admin.py#L584)) | **Query:** `period: str = "week"` (`day\|week\|month\|all`) | **Status 200 OK**<br>`{"summary": {...}, "top_songs": [...], "hourly_distribution": [...], "daily_trends": [...]}` | **401** No autenticado |
| `GET /api/admin/library`<br>([admin.py:592](../backend/app/routers/admin.py#L592)) | **Query:** `search: str \| None` | **Status 200 OK**<br>`[{"youtube_id": str, "title": str, "artist": str, "duration_sec": int, "play_count": int, "last_played_at": str}]` | **401** No autenticado |
| `POST /api/admin/volume`<br>([admin.py:630](../backend/app/routers/admin.py#L630)) | **Query:** `volume: int` (0 a 100) | **Status 200 OK**<br>`{"volume": int}` | **401** No autenticado<br>WS: `volume_changed` |
| `POST /api/admin/banner`<br>([admin.py:654](../backend/app/routers/admin.py#L654)) | **Query:** `text: str`, `show_brand: bool \| None` | **Status 200 OK**<br>`{"banner_text": str}` | **401** No autenticado<br>WS: `banner_changed` |
| `POST /api/admin/show-qr`<br>([admin.py:687](../backend/app/routers/admin.py#L687)) | **Query:** `show: bool \| None`, `size: str \| None` (`S\|M\|L`) | **Status 200 OK**<br>`{"show_qr": bool, "qr_size": str}` | **400** Talla inválida<br>WS: `qr_visibility_changed` |
| `GET /api/admin/tables`<br>([admin.py:718](../backend/app/routers/admin.py#L718)) | Ninguno | **Status 200 OK**<br>`{"tables": [{"table_number": str, "users": [...], "pending_songs": int, "played_songs": int, "rate_limit": {...}}]}` | **401** No autenticado |
| `POST /api/admin/tables/{table_number}/kick`<br>([admin.py:767](../backend/app/routers/admin.py#L767)) | **Path:** `table_number: str` | **Status 200 OK**<br>`{"status": "kicked", "table_number": str, "sessions_ended": int, "songs_removed": int}` | **401** No autenticado<br>WS: `session_kicked`, `song_removed` |
| `POST /api/admin/tables/{table_number}/reset-limit`<br>([admin.py:821](../backend/app/routers/admin.py#L821)) | **Path:** `table_number: str` | **Status 200 OK**<br>`{"message": "Limite de mesa reseteado"}` | **401** No autenticado<br>WS: `rate_limit_reset` |
| `GET /api/admin/daily-pin`<br>([admin.py:857](../backend/app/routers/admin.py#L857)) | Ninguno | **Status 200 OK**<br>`{"pin": "1234", "date": "YYYY-MM-DD", "require_pin": bool}` | **401** No autenticado |
| `POST /api/admin/daily-pin/regenerate`<br>([admin.py:865](../backend/app/routers/admin.py#L865)) | Ninguno | **Status 200 OK**<br>`{"pin": "5678", "date": "YYYY-MM-DD"}` | **401** No autenticado |
| `POST /api/admin/settings/pin`<br>([admin.py:881](../backend/app/routers/admin.py#L881)) | **Query:** `require: bool` | **Status 200 OK**<br>`{"require_pin": bool}` | **401** No autenticado |

---

### 4.4. Queue Router (`/api/queue`) — 9 Endpoints

Módulo: [backend/app/routers/queue.py](../backend/app/routers/queue.py)

| Método y Ruta | Auth Requerida | Parámetros / Cuerpo | Respuesta Exitosa | Errores / Headers |
|---|---|---|---|---|
| `GET /api/queue/search`<br>([queue.py:12](../backend/app/routers/queue.py#L12)) | Pública | **Query:** `q: str` (min 2 car.) | **Status 200 OK**<br>`[{"youtube_id": str, "title": str, "thumbnail_url": str, "duration": str, "url": str}]` | Ninguno (Caché TTL 5 min) |
| `GET /api/queue`<br>([queue.py:49](../backend/app/routers/queue.py#L49)) | Pública | **Query:** `venue: str` (slug requerido) | **Status 200 OK**<br>`{"now_playing": {...}\|null, "queue": [...], "total_in_queue": int, "playback_status": str, "fallback_active": bool, "venue_name": str, "venue_logo": str\|null}` | **404** Venue no encontrado |
| `POST /api/queue/songs`<br>([queue.py:60](../backend/app/routers/queue.py#L60)) | Cliente JWT | **Body (JSON):**<br>• `youtube_url`: `str` | **Status 200 OK**<br>`{"youtube_id": str, "title": str, "thumbnail_url": str, "duration_sec": int, "duration_formatted": str, "valid": bool, "recently_played_by_user": bool}` | **400** `INVALID_URL`<br>**429** `RATE_LIMIT_EXCEEDED`<br>**409** `ALREADY_IN_QUEUE`<br>**404** `VIDEO_NOT_FOUND`<br>**400** `VIDEO_NOT_EMBEDDABLE`<br>**400** `VIDEO_BLOCKED`<br>**400** `DURATION_EXCEEDED` |
| `POST /api/queue/songs/confirm`<br>([queue.py:138](../backend/app/routers/queue.py#L138)) | Cliente JWT | **Body (JSON):**<br>• `youtube_id`: `str` | **Status 201 Created**<br>`{"id": int, "youtube_id": str, "title": str, "position": int, "estimated_wait_sec": int, "songs_remaining": int, "window_resets_at": str}` | **429** `RATE_LIMIT_EXCEEDED`<br>**409** `ALREADY_IN_QUEUE`<br>**400** `VIDEO_BLOCKED`<br>**400** `DURATION_EXCEEDED`<br>WS: `song_added` / `now_playing_changed` |
| `POST /api/queue/start-playing/{song_id}`<br>([queue.py:259](../backend/app/routers/queue.py#L259)) | Pública (Kiosco) | **Path:** `song_id: int`<br>**Query:** `venue: str` | **Status 200 OK**<br>`{"status": "playing", "song_id": int}` | **404** Bar no encontrado<br>WS: `now_playing_changed`, `your_song_playing` |
| `GET /api/queue/my-songs`<br>([queue.py:293](../backend/app/routers/queue.py#L293)) | Cliente JWT | Ninguno | **Status 200 OK**<br>`{"now_playing": {...}\|null, "pending": [...]}` | **401** No autorizado |
| `GET /api/queue/recent-history`<br>([queue.py:306](../backend/app/routers/queue.py#L306)) | Cliente JWT | Ninguno | **Status 200 OK**<br>`[{"youtube_id": str, "title": str, "played_at": str}]` (últimas 5) | **401** No autorizado |
| `GET /api/queue/remaining-slots`<br>([queue.py:312](../backend/app/routers/queue.py#L312)) | Cliente JWT | Ninguno | **Status 200 OK**<br>`{"remaining": int, "max": int, "window_minutes": int, "resets_at": str}` | **401** No autorizado |
| `DELETE /api/queue/my-songs/{song_id}`<br>([queue.py:317](../backend/app/routers/queue.py#L317)) | Cliente JWT | **Path:** `song_id: int` | **Status 200 OK**<br>`{"status": "cancelled", "song_id": int}` | **401** No autorizado<br>**404** Canción no encontrada / ajena<br>WS: `song_removed` |

---

### 4.5. Playback Router (`/api/playback`) — 4 Endpoints

Módulo: [backend/app/routers/playback.py](../backend/app/routers/playback.py)

| Método y Ruta | Auth Requerida | Parámetros / Cuerpo | Respuesta Exitosa | Errores / Eventos WebSocket |
|---|---|---|---|---|
| `GET /api/playback/now-playing`<br>([playback.py:12](../backend/app/routers/playback.py#L12)) | Pública (Kiosco) | **Query:** `venue: str` (slug) | **Status 200 OK**<br>`{"now_playing": {...}\|null, "next_song": {...}\|null, "playback_status": str, "volume": int, "banner_text": str, "show_brand": bool, "show_qr": bool, "qr_size": str, "fallback_active": bool, "fallback_playlist": [...]}` | **404** Bar no encontrado |
| `POST /api/playback/fallback-playing`<br>([playback.py:23](../backend/app/routers/playback.py#L23)) | Pública (Kiosco) | **Query:**<br>• `venue`: `str`<br>• `youtube_id`: `str`<br>• `title`: `str` | **Status 200 OK**<br>`{"status": "ok"}` | **404** Bar no encontrado<br>WS: `now_playing_changed` (`is_fallback: true`) |
| `POST /api/playback/finished`<br>([playback.py:47](../backend/app/routers/playback.py#L47)) | Opcional | **Body (JSON):**<br>• `song_id`: `int`<br>• `venue_slug`: `str` | **Status 200 OK**<br>`{"status": "advanced", "now_playing": {...}}` o `{"status": "queue_empty"}` | **404** Bar no encontrado<br>WS: `rate_limit_reset`, `now_playing_changed`, `your_song_playing` |
| `POST /api/playback/error`<br>([playback.py:102](../backend/app/routers/playback.py#L102)) | Opcional | **Body (JSON):**<br>• `song_id`: `int`<br>• `venue_slug`: `str`<br>• `error_code`: `int` | **Status 200 OK**<br>`{"status": "skipped", "now_playing": {...}}` o `{"status": "retrying", "attempt": int}` | **404** Bar no encontrado<br>WS: `song_error`, `song_error_notification`, `now_playing_changed` |

---

### 4.6. SuperAdmin Router (`/api/superadmin`) — 29 Endpoints

Módulo: [backend/app/routers/superadmin.py](../backend/app/routers/superadmin.py)  
*Requiere `SuperAdmin Bearer Token`. Roles admitidos: `super_admin`, `vendedor`, `editor`.*

| Método y Ruta | Rol Requerido | Parámetros / Cuerpo | Respuesta Exitosa | Errores / Notas |
|---|---|---|---|---|
| `POST /api/superadmin/login`<br>([superadmin.py:146](../backend/app/routers/superadmin.py#L146)) | Pública | **Body (JSON):**<br>• `username`: `str`<br>• `password`: `str` | **Status 200 OK**<br>`{"token": str, "super_admin": {"id": int, "username": str, "role": str, "email": str, "phone": str}}` | **401** Credenciales incorrectas |
| `GET /api/superadmin/settings`<br>([superadmin.py:158](../backend/app/routers/superadmin.py#L158)) | Cualquiera | Ninguno | **Status 200 OK**<br>`{"trial_days": int, "grace_period_days": int, "monthly_price_cents": int}` | **401** No autorizado |
| `PATCH /api/superadmin/settings`<br>([superadmin.py:163](../backend/app/routers/superadmin.py#L163)) | `super_admin` | **Body (JSON):**<br>• `trial_days`: `int \| null`<br>• `grace_period_days`: `int \| null`<br>• `monthly_price_cents`: `int \| null` | **Status 200 OK**<br>`{"trial_days": int, "grace_period_days": int, "monthly_price_cents": int}` | **401** No autorizado<br>**403** Permiso denegado |
| `GET /api/superadmin/billing/summary`<br>([superadmin.py:192](../backend/app/routers/superadmin.py#L192)) | Cualquiera | Ninguno | **Status 200 OK**<br>`{"mrr_cents": int, "active_paying": int, "in_trial": int, "suspended": int, "total_venues": int, "monthly_price_cents": int, "current_month_revenue_cents": int}` | **401** No autorizado |
| `GET /api/superadmin/venues`<br>([superadmin.py:219](../backend/app/routers/superadmin.py#L219)) | Cualquiera | Ninguno | **Status 200 OK**<br>`[{"id": int, "name": str, "slug": str, "active": bool, "paid_until": str\|null, "payment_status": str, "admins": [...]}]` | **401** No autorizado |
| `POST /api/superadmin/venues`<br>([superadmin.py:278](../backend/app/routers/superadmin.py#L278)) | `vendedor`, `super_admin` | **Body (JSON):**<br>• `name`, `slug`, `admin_username`, `admin_password`, `admin_email`, `admin_phone`, `admin_address`, `admin_city`, `logo_url`, `qr_url`, `max_duration_sec`, `max_songs_per_window`, `window_minutes`, `trial_days` | **Status 200 OK**<br>`{"id": int, "slug": str, "name": str}` | **400** Slug ya en uso<br>**401** No autorizado<br>**403** Permiso denegado |
| `PATCH /api/superadmin/venues/{venue_id}`<br>([superadmin.py:340](../backend/app/routers/superadmin.py#L340)) | `editor`, `super_admin` | **Path:** `venue_id: int`<br>**Body:** `{"name", "logo_url", "qr_url", "active", "max_duration_sec", "max_songs_per_window", "window_minutes", "theme"}` | **Status 200 OK**<br>`{"status": "ok"}` | **401** No autorizado<br>**403** Permiso denegado |
| `DELETE /api/superadmin/venues/{venue_id}`<br>([superadmin.py:378](../backend/app/routers/superadmin.py#L378)) | `super_admin` | **Path:** `venue_id: int` | **Status 200 OK**<br>`{"status": "deleted"}` | **401** No autorizado<br>**403** Permiso denegado |
| `GET /api/superadmin/venues/{venue_id}/stats`<br>([superadmin.py:401](../backend/app/routers/superadmin.py#L401)) | Cualquiera | **Path:** `venue_id: int` | **Status 200 OK**<br>`{"venue": {...}, "stats": {"total_songs_played": int, "unique_users": int, "sessions_count": int, "history_7d": [...]}}` | **401** No autorizado<br>**404** Venue no encontrado |
| `GET /api/superadmin/venues/{venue_id}/analytics`<br>([superadmin.py:479](../backend/app/routers/superadmin.py#L479)) | Cualquiera | **Path:** `venue_id: int`<br>**Query:** `period="week"` | **Status 200 OK**<br>`{"summary": {...}, "top_songs": [...], "hourly_distribution": [...]}` | **401** No autorizado |
| `GET /api/superadmin/venues/{venue_id}/users`<br>([superadmin.py:485](../backend/app/routers/superadmin.py#L485)) | Cualquiera | **Path:** `venue_id: int` | **Status 200 OK**<br>`[{"id": int, "phone": str, "display_name": str, "created_at": str, "total_songs": int, "last_active": str}]` | **401** No autorizado |
| `POST /api/superadmin/venues/{venue_id}/admins`<br>([superadmin.py:552](../backend/app/routers/superadmin.py#L552)) | `super_admin` | **Path:** `venue_id: int`<br>**Body:** `{"username": str, "password": str}` | **Status 200 OK**<br>`{"id": int, "username": str}` | **401** No autorizado<br>**403** Permiso denegado |
| `DELETE /api/superadmin/venues/{venue_id}/admins/{admin_id}`<br>([superadmin.py:575](../backend/app/routers/superadmin.py#L575)) | `super_admin` | **Path:** `venue_id: int`, `admin_id: int` | **Status 200 OK**<br>`{"status": "deleted"}` | **401** No autorizado<br>**403** Permiso denegado |
| `GET /api/superadmin/venues/{venue_id}/playlist`<br>([superadmin.py:599](../backend/app/routers/superadmin.py#L599)) | Cualquiera | **Path:** `venue_id: int` | **Status 200 OK**<br>`[{"id": int, "youtube_id": str, "title": str, "artist": str, "duration_sec": int, "active": bool}]` | **401** No autorizado |
| `POST /api/superadmin/venues/{venue_id}/playlist/import`<br>([superadmin.py:606](../backend/app/routers/superadmin.py#L606)) | Cualquiera | **Path:** `venue_id: int`<br>**Body:** `{"playlist_url": str}` | **Status 200 OK**<br>`{"status": "imported", "count": int}` | **400** URL inválida<br>**401** No autorizado |
| `POST /api/superadmin/venues/{venue_id}/playlist/add`<br>([superadmin.py:617](../backend/app/routers/superadmin.py#L617)) | Cualquiera | **Path:** `venue_id: int`<br>**Body:** `{"youtube_url": str}` | **Status 200 OK**<br>`{"status": "added", "song": {...}}` | **400** URL inválida o video no encontrado |
| `DELETE /api/superadmin/venues/{venue_id}/playlist/{song_id}`<br>([superadmin.py:656](../backend/app/routers/superadmin.py#L656)) | Cualquiera | **Path:** `venue_id: int`, `song_id: int` | **Status 200 OK**<br>`{"status": "removed"}` | **401** No autorizado<br>**404** Canción no encontrada |
| `PATCH /api/superadmin/venues/{venue_id}/playlist/{song_id}/toggle`<br>([superadmin.py:665](../backend/app/routers/superadmin.py#L665)) | Cualquiera | **Path:** `venue_id: int`, `song_id: int` | **Status 200 OK**<br>`{"status": "toggled", "active": bool}` | **401** No autorizado<br>**404** Canción no encontrada |
| `DELETE /api/superadmin/venues/{venue_id}/playlist`<br>([superadmin.py:677](../backend/app/routers/superadmin.py#L677)) | Cualquiera | **Path:** `venue_id: int` | **Status 200 OK**<br>`{"status": "cleared"}` | **401** No autorizado |
| `POST /api/superadmin/venues/{venue_id}/logo`<br>([superadmin.py:685](../backend/app/routers/superadmin.py#L685)) | Cualquiera | **Path:** `venue_id: int`<br>**Form:** `file: UploadFile` (PNG, JPG, SVG, máx 2MB) | **Status 200 OK**<br>`{"status": "ok", "logo_url": str}` | **400** Formato o tamaño no válido |
| `POST /api/superadmin/venues/{venue_id}/mark-paid`<br>([superadmin.py:730](../backend/app/routers/superadmin.py#L730)) | `super_admin` | **Path:** `venue_id: int`<br>**Body:** `{"months": 1, "days": int\|null, "notes": str\|null, "amount_cents": int\|null}` | **Status 200 OK**<br>`{"status": "ok", "paid_until": str, "payment_status": str}` | **401** No autorizado<br>**403** Permiso denegado |
| `POST /api/superadmin/venues/{venue_id}/extend-trial`<br>([superadmin.py:759](../backend/app/routers/superadmin.py#L759)) | `super_admin` | **Path:** `venue_id: int`<br>**Body:** `{"days": int}` | **Status 200 OK**<br>`{"status": "ok", "paid_until": str, "payment_status": str}` | **401** No autorizado<br>**403** Permiso denegado |
| `POST /api/superadmin/venues/{venue_id}/adjust-expiry`<br>([superadmin.py:781](../backend/app/routers/superadmin.py#L781)) | `super_admin` | **Path:** `venue_id: int`<br>**Body:** `{"paid_until": "YYYY-MM-DD", "notes": str}` | **Status 200 OK**<br>`{"status": "ok", "paid_until": str, "payment_status": str}` | **401** No autorizado<br>**403** Permiso denegado |
| `POST /api/superadmin/venues/{venue_id}/billing/events/{event_id}/void`<br>([superadmin.py:803](../backend/app/routers/superadmin.py#L803)) | `super_admin` | **Path:** `venue_id: int`, `event_id: int` | **Status 200 OK**<br>`{"status": "voided", "event_id": int}` | **401** No autorizado<br>**403** Permiso denegado |
| `PATCH /api/superadmin/venues/{venue_id}/billing/events/{event_id}`<br>([superadmin.py:821](../backend/app/routers/superadmin.py#L821)) | `super_admin` | **Path:** `venue_id: int`, `event_id: int`<br>**Body:** `{"notes", "amount_cents", "period_end"}` | **Status 200 OK**<br>`{"status": "ok"}` | **401** No autorizado<br>**403** Permiso denegado |
| `GET /api/superadmin/admins`<br>([superadmin.py:854](../backend/app/routers/superadmin.py#L854)) | `super_admin` | Ninguno | **Status 200 OK**<br>`[{"id": int, "username": str, "email": str, "phone": str, "role": str, "last_login_at": str}]` | **401** No autorizado<br>**403** Permiso denegado |
| `POST /api/superadmin/admins`<br>([superadmin.py:875](../backend/app/routers/superadmin.py#L875)) | `super_admin` | **Body (JSON):**<br>• `username`, `password`, `phone`, `email`, `role` (`"vendedor" \| "editor" \| "super_admin"`) | **Status 200 OK**<br>`{"id": int, "username": str, "role": str}` | **400** Usuario duplicado<br>**401** No autorizado |
| `PATCH /api/superadmin/admins/{admin_id}`<br>([superadmin.py:923](../backend/app/routers/superadmin.py#L923)) | `super_admin` | **Path:** `admin_id: int`<br>**Body:** `{"role": str \| null, "password": str \| null}` | **Status 200 OK**<br>`{"status": "ok"}` | **401** No autorizado<br>**403** Permiso denegado |
| `DELETE /api/superadmin/admins/{admin_id}`<br>([superadmin.py:961](../backend/app/routers/superadmin.py#L961)) | `super_admin` | **Path:** `admin_id: int` | **Status 200 OK**<br>`{"status": "deleted"}` | **401** No autorizado<br>**403** Permiso denegado |

---

### 4.7. Billing & Webhook Router (`/api/admin` & `/api/billing`) — 3 Endpoints

Módulo: [backend/app/routers/billing.py](../backend/app/routers/billing.py)

| Método y Ruta | Auth Requerida | Parámetros / Cuerpo | Respuesta Exitosa | Errores / Notas |
|---|---|---|---|---|
| `GET /api/admin/billing`<br>([billing.py:38](../backend/app/routers/billing.py#L38)) | Admin JWT (permite suspendidos) | Ninguno | **Status 200 OK**<br>`{"payment_status": "active"\|"overdue"\|"suspended", "paid_until": str, "period_start": str, "days_remaining": int, "monthly_price_cents": int, "history": [...]}` | **401** Sesión inválida<br>**404** Bar no encontrado |
| `GET /api/admin/billing/checkout`<br>([billing.py:84](../backend/app/routers/billing.py#L84)) | Admin JWT | Ninguno | **Status 200 OK**<br>`{"public_key": str, "currency": "COP", "amount_in_cents": int, "reference": str, "signature": str}` | **409** Precio no configurado<br>**503** Wompi no configurado |
| `POST /api/billing/wompi/webhook`<br>([billing.py:130](../backend/app/routers/billing.py#L130)) | Firma HMAC-SHA256 en cuerpo | **Body (JSON):** Payload de Wompi Colombia (`event: "transaction.updated"`) | **Status 200 OK**<br>`{"ok": true}` | **400** JSON inválido<br>**403** Firma inválida<br>**503** Secret no configurado |

---

### 4.8. Main & System Routes (`/api`) — 2 Endpoints

Módulo: [backend/app/main.py](../backend/app/main.py)

| Método y Ruta | Auth Requerida | Parámetros / Cuerpo | Respuesta Exitosa | Errores / Headers |
|---|---|---|---|---|
| `GET /api/uploads/{filename}`<br>([main.py:101](../backend/app/main.py#L101)) | Pública | **Path:** `filename: str` | **Status 200 OK**<br>Archivo binario (`image/png`, `image/jpeg`, `image/svg+xml`) con `Cache-Control: public, max-age=604800` | **404** `File not found` |
| `GET /api/health`<br>([main.py:115](../backend/app/main.py#L115)) | Pública | Ninguno | **Status 200 OK**<br>`{"status": "ok", "version": "1.0.2", "database": "connected"}` | Ninguno |

---

### 4.9. Test Environment Router (`/api/test`) — 1 Endpoint

Módulo: [backend/app/routers/test.py](../backend/app/routers/test.py)  
*Montado condicionalmente en [backend/app/main.py:96](../backend/app/main.py#L96) solo si `APP_ENV=test`.*

| Método y Ruta | Auth Requerida | Parámetros / Cuerpo | Respuesta Exitosa | Errores / Notas |
|---|---|---|---|---|
| `POST /api/test/reset`<br>([test.py:9](../backend/app/routers/test.py#L9)) | Guard de Entorno (`APP_ENV=test`) | Ninguno (borra todas las tablas y siembra datos iniciales) | **Status 200 OK**<br>`{"status": "ok", "message": "Database reset and seeded"}` | **403** `Only allowed in test environment` |

---

## 5. WebSocket API (`/ws/queue`)

Módulo: [backend/app/routers/websocket.py](../backend/app/routers/websocket.py#L58)

| Método y Ruta | Auth Requerida | Parámetros de Query | Descripción |
|---|---|---|---|
| `WEBSOCKET /ws/queue`<br>([websocket.py:58](../backend/app/routers/websocket.py#L58)) | Token opcional en query string | • `venue`: `str` (requerido)<br>• `token`: `str \| null` (Customer o Admin JWT) | Canal de sincronización bidireccional en tiempo real para eventos de cola, reproductor, volumen y moderación. |

### Conexión
```
ws://{domain}/ws/queue?venue={venue_slug}&token={jwt_token}
```

---

### Catálogo Completo de los 17 Eventos Emitidos por el Backend

> [!WARNING]
> **Evento Inexistente:** El evento `song_skipped` **nunca es emitido por el backend**. Cuando una canción se salta, el sistema emite `now_playing_changed`, `rate_limit_reset` al usuario afectado y `your_song_playing` al nuevo turno.

```json
{
  "event": "<EVENT_NAME>",
  "data": { ... }
}
```

| # | Evento | Tipo de Envío | Payload (`data`) | Disparador y Contexto |
|---|---|---|---|---|
| 1 | `song_added` | Broadcast | `{"song": {...}}` | Se encola una nueva canción (cliente o admin). |
| 2 | `song_removed` | Broadcast | `{"song_id": int}` | Admin o usuario cancela/elimina una canción pendiente. |
| 3 | `now_playing_changed` | Broadcast | `{"now_playing": {...} \| null, "previous_song": {...} \| null}` | Cambia la canción activa (inicio, skip, término, fallback o play-now). |
| 4 | `your_song_playing` | Dirigido (`send_to_user`) | `{"song": {...}}` | Enviado al dueño de la canción cuando su video comienza a sonar. |
| 5 | `queue_reordered` | Broadcast | `{"queue": [...]}` | Admin altera el orden de las canciones en espera. |
| 6 | `playback_status_changed` | Broadcast | `{"status": "playing" \| "paused"}` | Admin pausa o reanuda la reproducción general. |
| 7 | `banner_changed` | Broadcast | `{"banner_text": str, "show_brand": bool}` | Admin actualiza el cintillo o logo en la pantalla del kiosco. |
| 8 | `volume_changed` | Broadcast | `{"volume": int}` | Admin ajusta el volumen en vivo (0 a 100). |
| 9 | `qr_visibility_changed` | Broadcast | `{"show_qr": bool, "qr_size": "S" \| "M" \| "L"}` | Admin cambia visibilidad o tamaño del QR en pantalla. |
| 10 | `fallback_status_changed` | Broadcast | `{"paused": bool}` | Admin pausa o activa la playlist de respaldo. |
| 11 | `fallback_play_now` | Broadcast | `{}` | Admin fuerza al kiosco a cambiar a playlist de respaldo. |
| 12 | `fallback_skip` | Broadcast | `{}` | Kiosco o admin salta canción de respaldo o regresa a la cola. |
| 13 | `session_kicked` | Dirigido (`send_to_user`) | `{"reason": "session_terminated"}` | Admin expulsa a una mesa o usuario del local. |
| 14 | `rate_limit_reset` | Dirigido (`send_to_user`) | `{"songs_remaining": int}` | Admin resetea el límite de una mesa o finaliza su canción. |
| 15 | `table_registered` | Broadcast | `{"table_number": str \| null, "user_name": str}` | Notifica al panel admin cuando un cliente escanea y se registra. |
| 16 | `song_error` | Broadcast | `{"song_id": int, "error_code": int}` | Kiosco reporta fallo en YouTube IFrame y salta de canción. |
| 17 | `song_error_notification` | Dirigido (`send_to_user`) | `{"song_id": int, "title": str, "error_code": int}` | Notifica al cliente que su canción no pudo ser reproducida. |
