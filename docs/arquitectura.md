# Arquitectura del Sistema - Repitela.com

> **Índice:** [[README]] · **Autoridad sobre:** la topología del backend · **Últ. cambio:** 2026-08-25
> Si esta página contradice al código, gana el código y esta página tiene un bug.

---

## 1. Visión General del Sistema

**Repitela.com** (anteriormente conocido como BarQueue) es una plataforma SaaS multi-inquilino (*multi-tenant*) de rockola digital interactiva para bares, gastrobares y discotecas. Permite a los clientes de un establecimiento encolar canciones de YouTube desde sus teléfonos móviles escaneando un código QR, mientras el establecimiento controla la reproducción y la moderación desde una pantalla dedicada (Kiosco) y un panel administrativo.

La plataforma integra auto-registro de bares con periodo de prueba gratuito, cobros recurrentes en Colombia mediante Wompi, verificación de presencia física vía PIN diario, y sincronización en tiempo real de baja latencia mediante WebSockets.

---

## 2. Diagrama de Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENTES Y PUNTOS DE ACCESO                              │
└─────────────────────────────────────────────────────────────────────────────────────────┘
      │                               │                           │                   │
      ▼                               ▼                           ▼                   ▼
┌──────────────┐             ┌──────────────────┐        ┌──────────────────┐ ┌───────────────┐
│ Landing Web  │             │   Cliente Móvil  │        │   Admin Panel    │ │  Kiosco Bar   │
│ (Astro SSG/  │             │   (Vue 3 SPA)    │        │   (Vue 3 SPA)    │ │  (Vue 3 SPA)  │
│     SSR)     │             │                  │        │                  │ │               │
│ - Repitela   │             │ - Escaneo QR     │        │ - Moderación     │ │ - IFrame      │
│ - Blog / SEO │             │ - Registro/Auth  │        │ - Vol / Banner   │ │   YouTube API │
│ - Precios    │             │ - Búsqueda/Cola  │        │ - PIN / Mesas    │ │ - Auto-skip   │
│ - Lead CTA   │             │ - Notificaciones │        │ - Facturación    │ │ - Fallback    │
└──────┬───────┘             └────────┬─────────┘        └────────┬─────────┘ └───────┬───────┘
       │                              │ HTTPS / WSS               │ HTTPS / WSS       │ HTTPS / WSS
       │                              └─────────────┬─────────────┴───────────────────┘
       │ HTTPS                                      │
       ▼                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    NGINX / INGRESS REVERSE PROXY & SSL TERMINATION                      │
│      Rutas: / → Landing | /admin, /:venue, /superadmin → Frontend | /api, /ws → Backend │
└─────────────────────────────────────┬───────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND CONTAINER (Python 3.11 - Single Worker)               │
│                                                                                         │
│  ┌───────────────────────────────── ROU T E R S ─────────────────────────────────────┐  │
│  │ auth.py        │ admin_auth.py  │ admin.py       │ queue.py      │ playback.py    │  │
│  │ superadmin.py  │ billing.py     │ websocket.py   │ test.py       │ main.py        │  │
│  └──────────────────────────────────────┬────────────────────────────────────────────┘  │
│                                         │                                               │
│  ┌────────────────────────────────── S E R V I C E S ────────────────────────────────┐  │
│  │ auth_service      │ admin_signup_service │ billing_service  │ queue_service       │  │
│  │ playback_service  │ playlist_service     │ analytics_service│ youtube_service     │  │
│  │ youtube_search    │ email_service (Brevo)│                  │                     │  │
│  └──────────────────────────────────────┬────────────────────────────────────────────┘  │
│                                         │                                               │
│  ┌────────────────────────────── ESTADO EN MEMORIA ──────────────────────────────────┐  │
│  │ ConnectionManager (WebSockets) │ _fallback_now_playing │ Rate Limiters (_attempts)│  │
│  │ _search_cache (YouTube TTL)    │ _playback_locks       │                          │  │
│  └──────────────────────────────────────┬────────────────────────────────────────────┘  │
│                                         │                                               │
│  ┌───────────────────────────── PERSISTENCIA LOCAL ──────────────────────────────────┐  │
│  │ SQLite (WAL Mode, synchronous=NORMAL, busy_timeout=15000, 23 Migraciones SQL)     │  │
│  │ Tablas: venues, admins, super_admins, users, user_sessions, queue_songs,          │  │
│  │         fallback_songs, play_history, venue_daily_pins, venue_billing_events...   │  │
│  │ Volumen /data/logos: Almacenamiento local de logos de locales (/api/uploads/*)    │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────┬────────────────────────────┬──────────────────┘
               │                          │                            │
               ▼                          ▼                            ▼
      ┌─────────────────┐        ┌──────────────────┐         ┌──────────────────┐
      │  YouTube APIs   │        │  Wompi Colombia  │         │  Brevo & Cloud-  │
      │  - Data API v3  │        │  - Widget Pay    │         │    flare         │
      │  - oEmbed API   │        │  - HMAC Webhooks │         │  - Emails trans. │
      │  - Scraping s/k │        │  - PSE/Tarjetas  │         │  - Turnstile CF  │
      └─────────────────┘        └──────────────────┘         └──────────────────┘
```

---

## 3. Desglose de Componentes y Servicios

El despliegue de producción se orquesta mediante `docker-compose.yml` ([docker-compose.yml:1-70](../docker-compose.yml#L1-L70)), compuesto por **4 servicios de infraestructura**:

### 3.1. Landing & Blog (`landing`)
- **Tecnología:** Astro (SSG/SSR) + Nginx ([landing/Dockerfile](../landing/Dockerfile)).
- **Función:** Sitio web comercial, marketing de captación, comparativas de producto (Pain vs Gain), calculadora de precios, blog optimizado para SEO (`/blog/*`), botón flotante de WhatsApp y contenedor de Google Tag Manager.
- **Exposición:** Puerto 80 interno mapeado al dominio principal `repitela.com`.

### 3.2. Frontend Webapp (`frontend`)
- **Tecnología:** Vue.js 3 + Vite + Pinia + Vue Router ([frontend/Dockerfile](../frontend/Dockerfile)).
- **Estructura de Vistas (21 Vistas en [frontend/src/views/](../frontend/src/views/)):**
  - **Cliente Final:**
    - `QRLanding.vue`: Pantalla de registro al escanear QR (`/:venueSlug/registro`).
    - `CustomerDashboard.vue`: Búsqueda de canciones, confirmación y estado de cola (`/:venueSlug/usuario`).
    - `PrivacyPolicy.vue`: Términos de tratamiento de datos (`/privacidad`).
  - **Administración de Bar:**
    - `AdminLogin.vue`: Acceso de administradores (`/admin` y `/:venueSlug/admin/login`).
    - `AdminSignup.vue`: Registro autoservicio de bares (`/admin/signup`).
    - `VerifyEmail.vue`: Confirmación de correo (`/admin/verify-email`).
    - `ForgotPassword.vue` / `ResetPassword.vue`: Recuperación de cuenta.
    - `AdminOnboarding.vue`: Asistente de configuración inicial (`/admin/onboarding`).
    - `AdminDashboard.vue`: Moderación de cola en vivo, control de volumen, banners, QR y mesas (`/:venueSlug/admin`).
    - `AdminSubscription.vue`: Pasarela de pagos Wompi y estado de suscripción (`/:venueSlug/admin/suscripcion`).
  - **Pantalla del Bar (Kiosco):**
    - `Kiosk.vue`: Reproductor YouTube IFrame con auto-avance, manejo de fallback y banner (`/:venueSlug/video`).
  - **SuperAdministración & Ventas:**
    - `SuperAdminLogin.vue`: Acceso superadmin (`/superadmin/login`).
    - `SuperAdminPanel.vue`: Dashboard general de métricas (`/superadmin`).
    - `SuperAdminCreateVenue.vue`: Alta manual de locales (`/superadmin/crear-bar`).
    - `SuperAdminSales.vue`: Reporte de ventas e ingresos MRR (`/superadmin/ventas`).
    - `SuperAdminUsers.vue`: Gestión de cuentas superadmin (`/superadmin/admins`).
    - `SuperAdminVenueDetail.vue`: Vista contenedora de bar (`/superadmin/venue/:venueId`).
    - `venue/SuperAdminVenueOverview.vue`: Resumen y estadísticas del local.
    - `venue/SuperAdminVenueConfig.vue`: Edición de límites, logo, QR y playlist de respaldo.
    - `venue/SuperAdminVenueUsers.vue`: Historial de usuarios del local.
- **Composables Reales:**
  - `useWebSocket.js`: Conexión reactiva con reconexión exponencial y despacho de eventos.
  - `useGoogleAuth.js`: Integración con Google Identity Services para login/signup.
  - `useTheme.js`: Gestión dinámica de temas visuales (`default.css`, `craft.css`).
  - `useToast.js`: Notificaciones toast no intrusivas en UI.
  - `useConfirmModal.js`: Diálogos modales de confirmación.
- **Pinia Stores:**
  - `stores/auth.js`: Tokens de cliente y admin, persistencia en localStorage y estado de sesión.
  - `stores/queue.js`: Estado reactivo de la cola, canción actual y cuota de rate limit.

### 3.3. Backend API (`backend`)
- **Tecnología:** Python 3.11 + FastAPI + Uvicorn/Gunicorn + aiosqlite.
- **10 Routers en [backend/app/routers/](../backend/app/routers/):**
  1. `auth.py`: Autenticación de clientes, validación de PIN diario y perfil (4 endpoints).
  2. `admin_auth.py`: Login de bar, auto-registro con prueba gratis, Turnstile, recuperación y Google OAuth (7 endpoints).
  3. `admin.py`: Control de cola, play-now, skip, volumen, banner, QR, mesas, PIN diario y analítica (29 endpoints).
  4. `queue.py`: Búsqueda de YouTube sin cuota, confirmación, slots y cancelación (9 endpoints).
  5. `playback.py`: Sincronización del kiosco, avance automático y manejo de errores de video (4 endpoints).
  6. `superadmin.py`: CRUD de bares, roles (`super_admin`, `vendedor`, `editor`), ajustes globales y facturación manual (29 endpoints).
  7. `billing.py`: Consultas de estado de suscripción, firmas Wompi y webhook de pagos (3 endpoints).
  8. `websocket.py`: Endpoint `/ws/queue` con gestor de conexiones bidireccional (1 endpoint).
  9. `test.py`: Limpieza y seed para pruebas automatizadas (`APP_ENV=test`, 1 endpoint).
  10. Endpoints en `main.py`: `/api/uploads/{filename}` (logos) y `/api/health` (2 endpoints).
- **Servicios Principales en [backend/app/services/](../backend/app/services/):**
  - `queue_service.py`: Control de concurrencia y cálculo de rate limiting en ventana deslizante.
  - `playback_service.py`: Máquina de estados de reproducción con locks asíncronos por bar (`_playback_locks`).
  - `youtube_service.py`: Validación de URLs y obtención de metadata vía oEmbed o YouTube Data API v3.
  - `youtube_search.py`: Búsqueda de YouTube sin clave mediante scraping optimizado con caché TTL en memoria.
  - `billing_service.py`: Registro contable de eventos y extensiones de vigencia (`paid_until`).
  - `admin_signup_service.py`: Generación de tokens de email, creación de locales y verificación.
  - `email_service.py`: Envío de correos transaccionales vía API HTTP de Brevo.
  - `analytics_service.py`: Consultas agregadas de tendencias, horas pico y géneros.

---

## 4. Restricciones de Arquitectura y Techo de Escala (Sección Crítica)

### 4.1. Restricción Obligatoria de Proceso Único: Gunicorn `-w 1`
En [backend/Dockerfile:14-23](../backend/Dockerfile#L14-L23), el backend está configurado estrictamente con **un solo worker de proceso**:

```dockerfile
CMD ["gunicorn", "app.main:app", "-w", "1", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--forwarded-allow-ips", "*", "--access-logfile", "-"]
```

#### Justificación Técnica de la Restricción:
1. **Estado de WebSockets en Memoria:** La clase `ConnectionManager` ([backend/app/routers/websocket.py:7-54](../backend/app/routers/websocket.py#L7-L54)) mantiene las instancias activas de WebSockets en el diccionario `self.active_connections` del proceso Python. Si se configuran `>1` workers, cada proceso tiene su propio espacio de memoria aislado; cuando un admin ejecuta una acción en el worker A, el broadcast nunca llega a los clientes conectados al worker B. Las pruebas empíricas registraron una **pérdida del 12% al 75% de eventos en tiempo real** al habilitar múltiples workers.
2. **Estado de Reproducción Fallback en Memoria:** La variable `_fallback_now_playing` ([backend/app/services/playback_service.py:9](../backend/app/services/playback_service.py#L9)) reside en la memoria del proceso.
3. **Locks Asíncronos de Reproducción:** Los cerrojos `_playback_locks` serializan mutaciones de cola (`skip`, `finished`, `error`) por venue para evitar condiciones de carrera entre clics concurrentes.
4. **Prevención de Contención en SQLite:** Un solo proceso asíncrono minimiza los errores de `database is locked` en SQLite bajo concurrencia de escrituras.

> [!IMPORTANT]
> **Ruta de Escalabilidad Horizontal:**
> Para escalar el backend a múltiples instancias o múltiples workers, **no se debe aumentar `-w`**. El paso técnico obligatorio consiste en:
> 1. Extraer el `ConnectionManager` hacia un bus de mensajería externo (**Redis Pub/Sub**).
> 2. Migrar la base de datos de SQLite a **PostgreSQL**.
> 3. Almacenar el estado de rate limit y fallback en Redis.

### 4.2. Impacto de Despliegues y Reinicios en la Reproducción
Dado que `ConnectionManager` y `_fallback_now_playing` son volátiles en memoria:
- **Cada despliegue o reinicio del contenedor corta las conexiones WebSocket activas**.
- Los clientes frontend se reconectan automáticamente en segundos gracias al algoritmo de reintento en `useWebSocket.js`.
- El Kiosco recupera el estado de reproducción mediante polling a `/api/playback/now-playing`. Sin embargo, si el bar estaba reproduciendo música de la playlist de respaldo (*fallback*), el audio puede experimentar una interrupción transitoria hasta que el Kiosco reinicie la sincronización.

---

## 5. Decisiones de Diseño de Arquitectura (ADRs)

### ADR-001: SQLite en Modo WAL como Motor de Datos
- **Decisión:** Mantener SQLite con `PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = 15000` y `PRAGMA synchronous = NORMAL` ([backend/app/database.py:25-30](../backend/app/database.py#L25-L30)).
- **Migraciones:** 23 migraciones SQL secuenciales ejecutadas automáticamente al arrancar.
- **Mantenimiento:** Bucle en segundo plano (`_hourly_cleanup_loop` en [backend/app/main.py:46](../backend/app/main.py#L46)) que purga registros de cola y logs mayores a 7 días, sesiones inactivas y eventos de analítica mayores a 180 días para mantener el tamaño del archivo `.db` en niveles óptimos.

### ADR-002: Motor de Reproducción YouTube — Cierre de Decisión (IFrame API)
- **Contexto Histórico:** Inicialmente se evaluaron dos alternativas: YouTube IFrame Player API vs descarga y procesamiento con `yt-dlp`.
- **Decisión Final (CERRADA):** Uso exclusivo de **YouTube IFrame Player API** en el Kiosco ([frontend/src/views/Kiosk.vue](../frontend/src/views/Kiosk.vue)).
- **Justificación:**
  1. **Cumplimiento Legal:** Cumple estrictamente los Términos de Servicio de YouTube (Sección 5).
  2. **Cero Carga de Servidor:** El streaming se realiza directamente desde la infraestructura de Google hacia el navegador del Kiosco; el servidor backend no transcodifica ni almacena video/audio.
  3. `yt-dlp` fue descartado y **no forma parte de `backend/requirements.txt`**.
  4. Los fallos por restricciones de inserción (errores 101/150) son detectados por el evento `onError` del IFrame y gestionados por el endpoint `/api/playback/error` con auto-skip.

### ADR-003: Sincronización en Tiempo Real mediante WebSockets
- **Decisión:** WebSockets nativos de FastAPI sobre `/ws/queue`.
- **Justificación:**
  - Comunicación bidireccional de baja latencia (<50ms).
  - Permite tanto difusión masiva (*broadcast*) como notificaciones dirigidas al usuario que pidió la canción (*targeted messaging*) para activar la **Notification API** del navegador cuando el celular está bloqueado o en otra pestaña.

### ADR-004: Estrategia de Enrutamiento y Acceso por Código QR
- **Decisión:** URLs dinámicas basadas en slug de venue `/:venueSlug/registro`.
- **Evolución:** El parámetro de mesa (`mesa`) es opcional. El sistema admite gastrobares con mesas numeradas y discotecas o barras sin asignación de mesa (`table_number: null`).
- **Seguridad Presencial:** Mecanismo opcional de PIN diario mostrado en el Kiosco para locales que deseen evitar pedidos remotos fuera del establecimiento.

### ADR-005: Arquitectura de Autenticación de Tres Niveles
- **Nivel 1 (Cliente):** Teléfono móvil + consentimiento de datos + PIN diario (opcional). Emite JWT de 24h.
- **Nivel 2 (Administrador de Bar):** Email + contraseña (bcrypt) o Google OAuth, protegido por **Cloudflare Turnstile** anti-bot y rate limit de 5 intentos/minuto. Emite JWT de 8h.
- **Nivel 3 (SuperAdmin):** Usuario + contraseña con RBAC (`super_admin`, `vendedor`, `editor`). Emite JWT de 8h.

### ADR-006: Modelo Multi-Tenant, Auto-Registro y Facturación Wompi
- **Decisión:** Base de datos multi-inquilino unificada aislada por `venue_id`.
- **Flujo de Suscripción:**
  1. Auto-registro crea el bar y asigna `trial_days` (15 días por defecto).
  2. Al vencer el periodo, el estado pasa a `overdue` (periodo de gracia de 5 días) y finalmente a `suspended`.
  3. En estado `suspended`, los clientes no pueden pedir canciones, pero los administradores pueden ingresar a pagar.
  4. La integración con Wompi genera firmas criptográficas en el backend y procesa eventos de pago mediante webhooks HMAC-SHA256, extendiendo automáticamente `paid_until` en bloques de 30 días.

### ADR-007: Landing estática con Astro
- **Decisión:** La landing se construye con Astro; su contenido se entrega como HTML estático y las interacciones puntuales usan JavaScript sin framework.
- **Motivación:** La landing anterior era una SPA React 18 + Vite cuyo HTML inicial sólo contenía `<div id="root">`; el `<h1>` se renderizaba en el cliente. Un parche de texto oculto intentaba compensarlo y suponía un riesgo de SEO. Astro permite que el contenido y los metadatos estén disponibles directamente en el HTML servido.

---

## 6. Matriz de Seguridad y Políticas de Protección

| Capa de Seguridad | Mecanismo Implementado | Ubicación en Código |
|-------------------|------------------------|---------------------|
| **Guard de Arranque en Producción** | El backend aborta el inicio si `APP_ENV=production` y `APP_SECRET_KEY` tiene el valor por defecto o longitud < 32 caracteres. | [backend/app/config.py:45-51](../backend/app/config.py#L45-L51) |
| **Protección Anti-Bot en Registro** | Validación de tokens de Cloudflare Turnstile en endpoints de signup. | [backend/app/routers/admin_auth.py:32-61](../backend/app/routers/admin_auth.py#L32-L61) |
| **Rate Limit de Autenticación** | Máximo 5 intentos de login/signup por minuto por par (IP, ruta) en memoria. | [backend/app/routers/admin_auth.py:18-26](../backend/app/routers/admin_auth.py#L18-L26) |
| **Rate Limit de Canciones** | Límite configurable de canciones por ventana deslizante (default: 5 canciones en 20 min). | [backend/app/services/queue_service.py:100](../backend/app/services/queue_service.py#L100) |
| **Preservación de IP Real** | Gunicorn configurado con `--forwarded-allow-ips "*"` para respetar encabezados `X-Forwarded-For` de Nginx. | [backend/Dockerfile:23](../backend/Dockerfile#L23) |
| **Validación de Firmas Webhook** | Verificación criptográfica HMAC-SHA256 de webhooks de Wompi con `WOMPI_EVENTS_SECRET`. | [backend/app/routers/billing.py:115-127](../backend/app/routers/billing.py#L115-L127) |
| **Filtro de Contenido y Duración** | Validación de URLs por regex, lista negra de videos bloqueados por bar (`blocked_videos`) y tope de duración en segundos. | [backend/app/routers/queue.py:64-115](../backend/app/routers/queue.py#L64-L115) |
| **Expiración de Sesiones** | Inactividad > 120 min o duración total > 24 horas expira la sesión del cliente. | [backend/app/services/auth_service.py:220](../backend/app/services/auth_service.py#L220) |

---

## 7. Ciclos de Vida Principales

### 7.1. Ciclo de Pedido de Canción (Cliente)
```
1. Cliente escanea QR en el bar
   └─► Abre https://app.repitela.com/:venueSlug/registro
2. Registro
   └─► POST /api/auth/register { phone, data_consent, pin? }
   └─► Backend valida PIN, crea sesión y retorna Customer JWT (24h)
3. Búsqueda o Inserción de Canción
   └─► GET /api/queue/search?q=nombre_cancion (Scraping con caché en memoria)
   └─► POST /api/queue/songs { youtube_url } -> Retorna preview validado
4. Confirmación
   └─► POST /api/queue/songs/confirm { youtube_id }
   └─► Backend valida rate limit (≤5 en 20min), añade a queue_songs
   └─► Emite WebSocket broadcast: {"event": "song_added", "data": {...}}
```

### 7.2. Ciclo de Reproducción y Avance Automático (Kiosco)
```
1. Kiosco montado en pantalla del bar
   └─► Abre https://app.repitela.com/:venueSlug/video
   └─► Conecta a /ws/queue?venue=:venueSlug
2. Reproducción
   └─► Kiosco carga video en YouTube IFrame Player
   └─► Si la cola está vacía: Kiosco reproduce canciones de fallback_songs
3. Fin de Canción
   └─► Evento onStateChange (ENDED) del IFrame
   └─► POST /api/playback/finished { song_id, venue_slug }
   └─► Backend actualiza estado a 'played', registra en play_history
   └─► Emite WebSocket:
       - Broadcast: {"event": "now_playing_changed"}
       - Targeted al dueño anterior: {"event": "rate_limit_reset"}
       - Targeted al dueño entrante: {"event": "your_song_playing"}
4. Manejo de Errores de Video
   └─► Error 101/150 en IFrame -> POST /api/playback/error { song_id, error_code }
   └─► Backend auto-salta el video roto y notifica al cliente ("song_error_notification")
```
