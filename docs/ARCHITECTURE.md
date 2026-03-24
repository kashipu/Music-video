# Arquitectura del Sistema - BarQueue

## Visión General

BarQueue es una aplicación web que permite a los clientes de un bar encolar canciones de YouTube desde su celular. El sistema se compone de tres interfaces principales: la vista del cliente (móvil), el panel de administración y el kiosco de reproducción (pantalla del bar).

## Diagrama de Alto Nivel

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Cliente Móvil   │     │  Admin Panel     │     │  Kiosco Bar     │
│  (Vue.js SPA)    │     │  (Vue.js SPA)    │     │  (Vue.js SPA)   │
│                  │     │                  │     │                  │
│  - Escanea QR    │     │  - Gestiona cola │     │  - Reproduce     │
│  - Registra      │     │  - Skip/Pause    │     │    YouTube       │
│  - Encola songs  │     │  - Analytics     │     │  - Auto-advance  │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │ HTTPS                  │ HTTPS                  │ HTTPS
         │ WebSocket              │ WebSocket              │ WebSocket
         ▼                        ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        FastAPI Backend                                │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ │
│  │  Auth    │ │  Queue   │ │  Admin   │ │ Playback │ │ Analytics │ │
│  │  Router  │ │  Router  │ │  Router  │ │  Router  │ │  Router   │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘ │
│       │             │            │             │              │       │
│  ┌────▼─────────────▼────────────▼─────────────▼──────────────▼────┐ │
│  │                    Capa de Servicios                             │ │
│  │  AuthService │ QueueService │ PlaybackService │ AnalyticsService│ │
│  └─────────────────────────┬───────────────────────────────────────┘ │
│                            │                                         │
│  ┌─────────────────────────▼───────────────────────────────────────┐ │
│  │                     SQLite (WAL mode)                           │ │
│  │  venues │ users │ user_sessions │ queue_songs │ play_history    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                  WebSocket Manager                              │ │
│  │  Broadcast: song_added, removed, skipped, now_playing_changed  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  YouTube Data    │
│  API v3          │
│  (metadata)      │
└──────────────────┘
```

## Componentes

### Backend (Python + FastAPI)

```
backend/
├── app/
│   ├── main.py              # App FastAPI, CORS, lifespan events
│   ├── config.py            # Settings desde variables de entorno
│   ├── database.py          # Conexión SQLite + migraciones
│   ├── routers/
│   │   ├── auth.py          # Registro, sesiones
│   │   ├── queue.py         # CRUD de la cola de canciones
│   │   ├── admin.py         # Gestión admin, analytics
│   │   ├── playback.py      # Control del kiosco
│   │   └── websocket.py     # WebSocket connections
│   ├── services/
│   │   ├── auth_service.py      # Lógica de registro y tokens
│   │   ├── queue_service.py     # Lógica de la cola, rate limiting
│   │   ├── youtube_service.py   # Validación URLs, metadata via API
│   │   ├── playback_service.py  # Control de reproducción
│   │   └── analytics_service.py # Consultas de data mining
│   ├── models/
│   │   ├── schemas.py       # Pydantic models (request/response)
│   │   └── database.py      # Modelos de tablas
│   └── db/
│       └── migrations/      # Archivos SQL numerados
├── tests/
├── requirements.txt
└── Dockerfile
```

**Librerías principales:**
- `fastapi` + `uvicorn` — servidor ASGI
- `aiosqlite` — acceso async a SQLite
- `pyjwt` — generación y validación de JWT
- `httpx` — cliente HTTP async para YouTube Data API
- `pydantic` — validación de datos

### Frontend (Vue.js 3 + Vite)

```
frontend/
├── src/
│   ├── App.vue
│   ├── main.js
│   ├── router/
│   │   └── index.js         # Vue Router con guards
│   ├── views/
│   │   ├── QRLanding.vue    # Página de registro (QR → formulario)
│   │   ├── CustomerDashboard.vue  # Dashboard del cliente
│   │   ├── AdminLogin.vue   # Login admin
│   │   ├── AdminDashboard.vue     # Panel de administración
│   │   └── Kiosk.vue        # Vista de reproducción (pantalla bar)
│   ├── components/
│   │   ├── SongCard.vue     # Tarjeta de canción (thumbnail, título, etc.)
│   │   ├── QueueList.vue    # Lista de la cola
│   │   ├── NowPlaying.vue   # Canción actual
│   │   ├── SongSubmit.vue   # Formulario para pegar link
│   │   └── SongPreview.vue  # Preview antes de confirmar
│   ├── composables/
│   │   ├── useWebSocket.js  # Composable para WebSocket
│   │   ├── useAuth.js       # Estado de autenticación
│   │   └── useQueue.js      # Estado de la cola
│   ├── stores/
│   │   ├── auth.js          # Pinia store - auth
│   │   └── queue.js         # Pinia store - cola
│   └── utils/
│       └── youtube.js       # Parseo de URLs de YouTube
├── package.json
├── vite.config.js
├── nginx.conf               # Config para producción
└── Dockerfile
```

**Librerías principales:**
- `vue` 3 — framework UI
- `vite` — build tool
- `pinia` — state management
- `vue-router` — routing con guards para auth

## Decisiones de Diseño

### ADR-001: SQLite como base de datos

**Contexto:** Necesitamos persistir la cola de canciones, usuarios y datos históricos.

**Decisión:** Usar SQLite con WAL mode.

**Justificación:**
- Una instancia por venue maneja decenas de usuarios concurrentes — bien dentro de las capacidades de SQLite
- Zero-config: no requiere servidor de base de datos separado
- WAL mode permite lecturas concurrentes sin bloquear escrituras
- Archivo único facilita backups (copiar archivo)
- Si algún día se necesita más capacidad, PostgreSQL es la ruta de migración natural

### ADR-002: Reproducción de YouTube (dos opciones)

**Contexto:** Necesitamos reproducir canciones de YouTube en la pantalla del bar.

#### Opción A: YouTube IFrame Player API (Recomendada para producción)

**Pros:**
- Cumple con los Términos de Servicio de YouTube
- No requiere procesamiento en el servidor
- Soporte nativo para controles de reproducción
- Se actualiza automáticamente

**Contras:**
- Requiere conexión a internet constante en el bar
- Muestra el video (puede ocultarse con CSS pero es zona gris en ToS)
- Depende de la disponibilidad de YouTube

#### Opción B: yt-dlp (Solo para desarrollo/testing)

**Pros:**
- Control total sobre el audio
- Funciona offline una vez descargado
- Permite preprocesamiento (normalización de volumen)

**Contras:**
- **Viola los Términos de Servicio de YouTube (Sección 5)**
- Requiere procesamiento en el servidor
- Los formatos/URLs cambian frecuentemente

**Estado:** Documentar ambas opciones. Evaluar en fase de prototipo.

### ADR-003: WebSockets para tiempo real

**Contexto:** Los clientes necesitan ver la cola actualizada en tiempo real.

**Decisión:** Usar WebSockets nativos de FastAPI.

**Justificación:**
- FastAPI tiene soporte nativo para WebSocket
- Baja latencia para actualizaciones de la cola
- Bidireccional: permite enviar notificaciones dirigidas a usuarios específicos (ej: "tu canción está sonando")
- Combinado con la **Notification API** del navegador para notificaciones cuando la app está en segundo plano
- Alternativa considerada: SSE (Server-Sent Events) — más simple pero unidireccional

### ADR-004: QR como punto de entrada

**Contexto:** Los usuarios necesitan acceder a la app de forma rápida desde el bar.

**Decisión:** Código QR por mesa que lleva a la URL del venue con el número de mesa pre-cargado.

**Justificación:**
- No requiere descargar app nativa
- El número de mesa se incluye en el QR, reduciendo fricción
- Cada mesa tiene su propio QR con formato: `https://app.domain.com/{venue_slug}?mesa={table_number}`

### ADR-005: Autenticación por número de celular

**Contexto:** Necesitamos identificar usuarios para aplicar rate limiting y trazabilidad.

**Decisión:** Registro con número de celular + número de mesa + aceptación de uso de datos.

**Justificación:**
- Natural en contexto de bar (todos tienen celular)
- Suficiente para identificar y limitar usuarios
- Permite contacto futuro (marketing con consentimiento)
- Sin contraseñas que recordar
- Sesión válida por 24 horas

## Ciclo de Vida de una Solicitud

```
1. Usuario escanea QR de la mesa
   └─► Abre https://app.domain.com/{venue_slug}?mesa=5

2. Registro
   └─► POST /api/auth/register { phone, table_number, data_consent }
   └─► Backend crea user + session, retorna JWT

3. Usuario pega link de YouTube
   └─► POST /api/queue/songs { youtube_url }
   └─► Backend valida URL, consulta YouTube Data API v3
   └─► Retorna preview: { title, thumbnail, duration }

4. Usuario confirma
   └─► POST /api/queue/songs/confirm { youtube_url }
   └─► Backend verifica rate limit (≤5 en 30min)
   └─► Inserta en queue_songs con position = MAX + 1
   └─► Registra en submission_log
   └─► Broadcast WebSocket: { event: "song_added", data: {...} }

5. Reproducción (Kiosco)
   └─► GET /api/playback/now-playing
   └─► Kiosco reproduce via YouTube IFrame API / yt-dlp
   └─► Al terminar: POST /api/playback/finished
   └─► Backend marca song como "played", avanza a la siguiente
   └─► Broadcast WebSocket: { event: "now_playing_changed" }
   └─► Notificación dirigida al dueño: { event: "your_song_playing" }
   └─► Si app en segundo plano: Notification API del navegador

6. Cola vacía
   └─► Backend detecta que no hay songs pendientes
   └─► Según config del venue: reproduce fallback playlist o
       activa recomendaciones de YouTube
```

## Seguridad

| Área | Medida |
|------|--------|
| URLs de YouTube | Validación estricta con regex + verificación via API |
| Rate limiting | Max 5 canciones por usuario cada 30 min, implementado en backend |
| Autenticación cliente | JWT con expiración de 24h |
| Autenticación admin | Username/password con bcrypt, sesión de 8h |
| CORS | Configurado para permitir solo el dominio del frontend |
| Datos personales | Consentimiento explícito al registrarse (checkbox obligatorio) |
| Inputs | Sanitización de todos los inputs con Pydantic |
| HTTPS | Obligatorio en producción (requerido para WebSocket seguro wss://) |

## Multi-venue

El sistema soporta múltiples bares desde el día 1:
- Cada venue tiene un `slug` único usado en las URLs
- Los QR de cada mesa incluyen el `venue_slug`
- Datos completamente aislados por `venue_id` en todas las tablas
- Un admin puede gestionar solo su(s) venue(s)
- Deploy inicial: un solo venue, pero la arquitectura no requiere cambios para agregar más
