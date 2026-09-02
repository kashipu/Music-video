# Diseño — Repítela

Describe el sistema **real**, no el ideal. Si algo está mal, se escribe mal.

> No confundir con [`docs/DESIGN.md`](docs/DESIGN.md), que es la especificación
> visual de la landing. Mismo nombre, tema distinto.

## Qué es

Un cliente de bar escanea el QR de su mesa, pide una canción de YouTube desde el
móvil, y la pantalla del local la reproduce cuando le llega el turno.

## Módulos

Tres artefactos desplegados juntos por Docker Compose, con **capas técnicas**
dentro de cada uno — ni MVC ni hexagonal. La auditoría recomienda **no migrar a
hexagonal**: sería sobreingeniería para este dominio.

| Módulo | Responsabilidad | Puede llamar a |
|---|---|---|
| `landing/` | Sitio público de venta (Astro) | nada |
| `frontend/src/views/` | Pantallas y orquestación de UI | components, composables, services, stores |
| `frontend/src/components/` | Presentación. No sabe de red | props/emits y stores de solo lectura |
| `frontend/src/composables/` | Lógica de UI reutilizable | services, stores |
| `frontend/src/services/` | **Única frontera de red** | `fetch` |
| `backend/app/routers/` | Parsear HTTP y responder | services |
| `backend/app/services/` | Reglas de negocio | `db/` |
| `backend/app/db/` | SQL y migraciones | SQLite |

Regla: un módulo no consulta datos de otro; pide por función.

## Datos

SQLite, 16 tablas, 26 migraciones versionadas con runner propio.

| Tabla | Dueño |
|---|---|
| `venues`, `venue_daily_pins` | bares y su PIN diario |
| `users`, `user_sessions`, `admins`, `super_admins` | identidad |
| `queue_songs`, `play_history`, `song_metadata` | cola y reproducción |
| `fallback_songs`, `blocked_videos` | playlist de respaldo y bloqueos |
| `venue_billing_events`, `platform_settings` | facturación |
| `analytics_events`, `submission_log`, `email_tokens` | analítica y correo |

## Bordes aislados

| Borde | Proveedor hoy | Dónde está |
|---|---|---|
| Búsqueda y metadatos de video | YouTube Data API | `services/youtube_search.py`, `youtube_service.py` |
| Pagos | Wompi (webhook firmado) | `services/billing_service.py`, `routers/billing.py` |
| Correo transaccional | Brevo | `services/email_service.py` |
| Anti-bot | Cloudflare Turnstile | `utils.py` |
| Identidad federada | Google Sign-In | `services/auth_service.py` |
| **QR** | `api.qrserver.com` — **sin aislar, en la ruta crítica** | inline en el frontend |

## Límites conocidos

Escritos porque son ciertos, no porque estén planeados.

| Límite | Se rompe cuando | Vía de salida |
|---|---|---|
| **Un solo worker asyncio** | El broadcast de WebSocket compite con servir logos y buscar en YouTube | Sacar activos a R2 (F5b); después, más workers exige salir de SQLite |
| **SQLite en un volumen** | ~500 MB de base, o cuando haga falta un segundo servidor | Postgres. Caro: 139 `execute()` con SQL a mano |
| **`db.commit()` no hace nada** | Ya está roto: 45 llamadas dan atomicidad falsa | F3 |
| **RPO de 24 h** | Un fallo de madrugada pierde la noche de mayor facturación | Litestream |
| **Sin CI** | Ya: `main` es deploy directo a producción | F1 |
| **Servidor de 2 vCPU / 1 GB compartido** | El build de un deploy compite con los bares en vivo | Construir en CI y publicar imágenes (F5b) |
| **Sin zona horaria** | El primer bar fuera de Colombia | Decisión de producto pendiente (DB-4) |

## Decisiones

- SQLite como base → [[decisions/sqlite-como-base]]
- Vue 3 sin TypeScript → [[decisions/vue-sin-typescript]]
- Dokploy y despliegue desde `main` → [[decisions/dokploy-y-deploy-desde-main]]
- SQL a mano, sin ORM → [[decisions/sql-a-mano-sin-orm]]

El diagnóstico completo, con los 50 hallazgos y su orden de ataque, está en
[`docs/reviews/INDEX.md`](docs/reviews/INDEX.md).
