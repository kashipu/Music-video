# Plan de mejoras: correcciones, multi-tenant y escalada

> Resultado de la revisión completa de backend y base de datos (2026-08-21).
> Objetivo de negocio: llegar a **100 bares × 200 usuarios diarios por bar**, con
> alta autogestionada, cobro automático de suscripciones y avisos de pago.
>
> Referencias: mediciones de carga en `docs/CAPACITY.md`, auditoría previa en
> `docs/AUDIT_WEBSOCKET_PERFORMANCE.md`.

---

## Resumen ejecutivo

| Tema | Estado |
|---|---|
| Arquitectura actual (FastAPI + SQLite WAL + 1 worker) | Sana y medida: aguanta ~30-40 bares activos |
| Multi-tenant | Bien diseñado: todo el esquema filtra por `venue_id` desde el día 1 |
| Bugs encontrados | 6 concretos (2 rompen features completas) — ver P0 |
| Techo real de escala | El proceso único: WebSockets y estado de reproducción viven en memoria del worker |
| Para romper el techo | Redis (pub/sub + estado compartido) → luego varios workers → PostgreSQL |
| Trabajo grande pendiente | No es rendimiento: es producto (alta autogestionada, billing, suscripciones) |

---

## P0 — Bugs a corregir ya (horas de trabajo, no semanas)

### 1. La analítica de búsquedas nunca se guarda
- **Dónde**: `backend/app/routers/queue.py:38`
- **Qué pasa**: `/api/queue/search` registra el evento con `venue_id=0`, pero
  `analytics_events.venue_id` es `NOT NULL REFERENCES venues(id)` y la conexión
  corre con `PRAGMA foreign_keys = ON`. El INSERT falla siempre, el
  `except: pass` lo oculta, y `top_searches`, `search_stats` y parte del funnel
  de `get_analytics` quedan en cero para siempre.
- **Fix**: hacer `venue_id` nullable en `analytics_events` (migración) o
  resolver el venue real desde el contexto de la búsqueda.

### 2. `db.lastrowid` rompe `/api/admin/fallback/add`
- **Dónde**: `backend/app/routers/admin.py:581`
- **Qué pasa**: se lee `lastrowid` sobre la conexión `aiosqlite`, que no expone
  ese atributo (vive en el cursor). La canción se inserta y commitea, y después
  el endpoint lanza `AttributeError` → 500; el reintento devuelve "ya está en
  la playlist".
- **Fix**: capturar el cursor del `execute` y usar `cursor.lastrowid`
  (como ya se hace en `superadmin.py:137`).

### 3. Borrar un venue con datos devuelve 500
- **Dónde**: `backend/app/routers/superadmin.py:204` (`delete_venue`)
- **Qué pasa**: borra hijos manualmente pero olvida `fallback_songs`,
  `venue_daily_pins`, `analytics_events` y `blocked_videos`. Todas tienen FK a
  `venues` sin `ON DELETE CASCADE`; con FKs activas, el `DELETE FROM venues`
  viola la restricción para casi cualquier venue real.
- **Fix**: borrar también esas tablas, o (mejor, ver sección multi-tenant)
  migrar las FKs a `ON DELETE CASCADE`.

### 4. La búsqueda no URL-encodea el query
- **Dónde**: `backend/app/services/youtube_search.py:20`
- **Qué pasa**: la URL se arma por interpolación
  (`f"...results?search_query={query}"`). Un query con `&`, `#` o `+` corrompe
  la URL y devuelve resultados equivocados o vacíos.
- **Fix**: pasar `params={"search_query": query}` a httpx.

### 5. Los auto-starts en routers se saltan el `_playback_lock`
- **Dónde**: `queue.py:232-246` (auto-start tras confirmar), `queue.py:286`
  (`start-playing`), `admin.py:184-209` (`play-now`), `admin.py:435`
  (`playback/start`), `admin.py:520` (`fallback-skip`)
- **Qué pasa**: `playback_service.py` serializa skip/finish/error con un lock
  para que nunca haya dos canciones en `playing`, pero las transiciones a
  `playing` que viven en los routers no lo usan. Dos confirms simultáneos con
  cola vacía pueden dejar dos canciones sonando a la vez.
- **Fix**: mover esas transiciones a funciones de `playback_service` que
  adquieran `_playback_lock`.

### 6. Chequeo de rate limit fuera del lock
- **Dónde**: `backend/app/routers/queue.py:144` + `queue_service.add_song`
- **Qué pasa**: el límite se verifica antes de entrar al lock; dos confirms
  simultáneos del mismo usuario pasan ambos y meten N+1 canciones.
- **Fix**: re-verificar el límite dentro de `_position_lock`, igual que ya se
  re-verifica el duplicado.

**Menores** (arreglar de paso): `return` muerto en
`playback_service.py:224`; `datetime.now()` naive contra timestamps UTC en
`queue_service.py:260` (correcto solo mientras el contenedor corra en UTC);
`/api/health` expone la lista de archivos de logos sin auth; el WebSocket
acepta cualquier `user_id` sin validar el token (permite recibir eventos
personales de otro usuario — validar el JWT en el handshake).

---

## P1 — Cimientos de operación (antes de crecer)

### Backups automáticos de la base de datos
No existe ningún respaldo: el `.db` vive en un volumen Docker. Para un negocio
que cobra mensualidades es el riesgo #1.
- Corto plazo: cron con `sqlite3 /data/barqueue.db "VACUUM INTO '...'"` +
  copia fuera del servidor.
- Mejor: [Litestream](https://litestream.io) replicando el WAL a un bucket S3.

### Tarea de fondo periódica
Hoy `cleanup_old_data()` (`main.py:19`) corre **solo al arrancar** el
contenedor, que con `restart: unless-stopped` puede vivir semanas. Además
`analytics_events` no se poda nunca y crece sin límite.
- Crear una tarea `asyncio` en el lifespan que corra cada hora:
  limpieza de datos viejos, `expire_stale_sessions()`, poda de
  `analytics_events` (retención configurable), y más adelante los avisos de
  pago.

### bcrypt fuera del event loop
`bcrypt.checkpw/hashpw` (`auth_service.py:165,186`, `superadmin.py:144`) toman
100-300 ms de CPU síncrona. Con 1 worker asyncio, cada login de admin congela
todas las requests y WebSockets ese instante.
- Fix de una línea por sitio: `await asyncio.to_thread(bcrypt.checkpw, ...)`.

### Transacciones reales donde importan
La conexión usa `isolation_level=None` (autocommit): **todos los
`db.commit()` y `_commit_with_retry` son no-ops** y ninguna secuencia
multi-statement es atómica (alta de venue + admin, canción + submission_log,
migraciones con `ALTER TABLE`). Decidirlo conscientemente:
- Envolver en `BEGIN IMMEDIATE ... COMMIT` explícito las secuencias que deban
  ser atómicas, o eliminar los commits decorativos para no engañar al lector.
- El runner de migraciones (`database.py:41`) debe aplicar cada archivo dentro
  de una transacción: hoy una migración que falla a mitad queda medio aplicada
  y sin registrar → el siguiente arranque muere con "duplicate column".

### Búsqueda: caché y auth
`/api/queue/search` es público, sin caché, y scrapea youtube.com en cada
llamada (~0.5-1 s + riesgo de baneo de IP + usable como proxy por terceros).
- Exigir token de usuario, cachear resultados por query con TTL de minutos, y
  considerar un circuit breaker si YouTube empieza a fallar.

### nginx `worker_connections`
Único techo ya identificado en `docs/CAPACITY.md` que se choca antes de los
15 bares llenos. Es un cambio de configuración pendiente.

---

## Multi-tenant: qué está bien y qué reforzar

**Lo que ya está bien (conservar):**
- Todo el esquema filtra por `venue_id` desde el origen; los índices
  compuestos empiezan por `venue_id` (`idx_queue_venue_status`,
  `idx_analytics_venue_type`, …).
- Config por venue en JSON (`venues.config`): límites de canciones, duración,
  PIN, tema — la base correcta para planes diferenciados.
- Aislamiento de auth por venue: el JWT de usuario y de admin llevan
  `venue_id` y los endpoints lo usan, no confían en parámetros del cliente.

**Qué reforzar para escalar como SaaS:**
1. **FKs con `ON DELETE CASCADE`** hacia `venues` en todas las tablas hijas.
   Elimina la clase de bug del P0-3 y hace el offboarding de un tenant
   una sola sentencia.
2. **`blocked_videos` es global entre bares** (índice único solo por
   `youtube_id`, migración 010): un error de reproducción en un bar bloquea el
   video para los 100. Decidir si es deliberado; si no, el único debe ser
   `(venue_id, youtube_id)`.
3. **El usuario "admin" fantasma es global** (`admin.py:271`: un solo
   `users.phone = 'admin'` compartido por todos los venues). Funciona, pero
   contamina analítica cruzada entre tenants; mejor un usuario admin por venue.
4. **Cuotas por tenant**: hoy un solo bar podría saturar búsqueda/eventos sin
   límite por venue. Al introducir planes, añadir límites por venue (requests
   de búsqueda, canciones/día) ligados al plan.
5. **`users.phone` es único global**: un cliente es la misma persona en todos
   los bares. Es una decisión válida (y buena para analítica); documentarla
   como tal.

---

## Producto: alta autogestionada, billing y suscripciones

Hoy el cobro es manual: el superadmin marca "pagado" (`mark-paid`),
`paid_until` es un texto con 5 días de gracia y auto-suspensión en
`register_user` (`auth_service.py:39-49`). Buenas semillas; falta el sistema.

### Modelo de datos propuesto (nuevas migraciones)

```sql
-- Planes comercializables (básico / analítica / branding, etc.)
CREATE TABLE plans (
    id            INTEGER PRIMARY KEY,
    code          TEXT UNIQUE NOT NULL,      -- 'basic', 'pro'
    name          TEXT NOT NULL,
    price_cop     INTEGER NOT NULL,          -- centavos
    period_days   INTEGER NOT NULL DEFAULT 30,
    features      TEXT NOT NULL DEFAULT '{}',-- JSON: límites y flags por plan
    active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- Una suscripción viva por venue; el estado del venue se DERIVA de aquí
CREATE TABLE subscriptions (
    id                INTEGER PRIMARY KEY,
    venue_id          INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    plan_id           INTEGER NOT NULL REFERENCES plans(id),
    status            TEXT NOT NULL CHECK (status IN
                      ('trial','active','grace','suspended','cancelled')),
    current_period_end TIMESTAMP NOT NULL,
    trial_ends_at     TIMESTAMP,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historial inmutable de pagos (webhooks de la pasarela escriben aquí)
CREATE TABLE payments (
    id            INTEGER PRIMARY KEY,
    venue_id      INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES subscriptions(id),
    provider      TEXT NOT NULL,             -- 'wompi', 'mercadopago', 'manual'
    provider_ref  TEXT UNIQUE,               -- id del pago en la pasarela (idempotencia)
    amount_cop    INTEGER NOT NULL,
    status        TEXT NOT NULL,             -- 'approved','declined','pending'
    raw_payload   TEXT,                      -- webhook completo para auditoría
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Avisos enviados (evita duplicar recordatorios)
CREATE TABLE billing_notifications (
    id          INTEGER PRIMARY KEY,
    venue_id    INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,               -- 'expiring_soon','grace','suspended'
    period_end  TIMESTAMP NOT NULL,          -- a qué vencimiento corresponde
    sent_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (venue_id, kind, period_end)
);
```

`venues.paid_until` / `payment_notes` quedan como legacy y se migran a una
suscripción `active` con `current_period_end = paid_until`.

### Flujos a construir

1. **Alta autogestionada**: registro público del bar (email/teléfono
   verificado) → crea venue + admin + suscripción `trial` en una transacción →
   el bar entra directo a su panel. Reutiliza la lógica de
   `superadmin.create_venue` movida a un servicio.
2. **Cobro por webhook**: endpoint `/api/billing/webhook/<provider>`
   (Wompi / Mercado Pago / PayU) con verificación de firma e idempotencia por
   `provider_ref` → registra en `payments` → extiende
   `current_period_end` y pone `status='active'`.
3. **Ciclo de vida automático** (corre en la tarea de fondo de P1):
   - `current_period_end - 5 días` → aviso "falta poco por pagar"
   - vencido → `grace` + aviso (N días de gracia configurables)
   - fin de gracia → `suspended` + aviso; `register_user` y `admin_login` ya
     tienen los puntos de corte para bloquear la entrada
   - pago recibido en cualquier estado → vuelve a `active`
4. **Canal de avisos**: email transaccional (Resend/Postmark) y/o WhatsApp.
   Guardar el envío en `billing_notifications` para nunca duplicar.
5. **Gestión de admins del bar**: roles (dueño vs. empleado), recuperación de
   contraseña, invitaciones. La tabla `admins` actual es plana y sin flujo de
   recuperación.
6. **Enforcement por plan**: leer `plans.features` donde hoy se leen los
   límites de `venues.config` (máx. canciones, duración, branding, analítica).

---

## Escalada: el techo y cómo romperlo

### Los números

| Escenario | WS concurrentes | Requests | Escrituras DB |
|---|---|---|---|
| Medido (`CAPACITY.md`) | 1.500 | ~154 req/s | trivial |
| 100 bares en pico (30-50% concurrencia) | ~6.000-10.000 | ~600-1.000 req/s | ~10-20/s pico |

Las escrituras **nunca** serán el problema (SQLite en WAL hace cientos/s). El
techo es el **proceso único**: 1.500 WS usaban 5-20% de un core; ×5-6 en pico
queda entre 30% y 120% de un core. El worker es único **obligatoriamente**
porque `ConnectionManager` (websocket.py) y `_fallback_now_playing`
(playback_service.py) viven en memoria del proceso — con 2 workers se pierden
12-75% de los broadcasts (medido, ver comentario en `backend/Dockerfile`).

### Etapas

**Etapa 0 — ya (con lo de P0/P1):** llega cómodamente a ~30-40 bares activos
sin tocar arquitectura.

**Etapa 1 — producto (paralelo a Etapa 0):** todo el bloque de suscripciones
de arriba. Corre perfecto sobre la arquitectura actual — no esperar la
migración de infraestructura para empezar a cobrar.

**Etapa 2 — infraestructura (al pasar ~30-40 bares activos):**
1. **Redis**: mover a pub/sub los broadcasts de WebSocket y a Redis el estado
   `_fallback_now_playing`. Es el único cambio que desbloquea `-w N`.
2. **Varios workers / nodos**: una vez el estado está fuera del proceso,
   escalar horizontal es cambiar un número.
3. **PostgreSQL**: más por operación (conexiones concurrentes desde varios
   procesos, backups, tooling, migraciones con Alembic) que por throughput.
   Los locks `asyncio` de `queue_service`/`playback_service` se reemplazan por
   transacciones con `SELECT ... FOR UPDATE`.
4. **Observabilidad**: Sentry + métricas + logs estructurados. Con 100
   clientes pagando, enterarse de los errores por el WhatsApp del dueño del
   bar no es un plan.

### Qué NO cambiar
- El lenguaje. Python/FastAPI es idóneo para esta carga (I/O-bound) y llega a
  miles de bares con el stack FastAPI + PostgreSQL + Redis.
- El modelo multi-tenant por `venue_id`: sobrevive intacto la migración a
  PostgreSQL y a múltiples nodos.

---

## Checklist priorizado

> Actualizado 2026-08-21 en la rama `bugs-fixed`. Los 6 P0 están verificados
> con `python -m scripts.verify_p0_bugs` (6/6 PASS).

**Hecho (rama `bugs-fixed`):**

- [x] **P0.1** Fix `venue_id=0` en analítica de búsqueda (migración 012, `venue_id` nullable)
- [x] **P0.2** Fix `db.lastrowid` → `cursor.lastrowid`
- [x] **P0.3** Borrado de venue limpia las 9 tablas hijas (cascada manual)
- [x] **P0.4** URL-encode del query de búsqueda (`params=` de httpx)
- [x] **P0.5** Transiciones a `playing` centralizadas en `playback_service.try_start_song` / `play_specific_song`, bajo lock
- [x] **P0.6** Rate limit re-verificado dentro de `_position_locks`
- [x] **Menores**: `return` muerto en `_advance_queue_safe`; `datetime.now()` naive → UTC aware (2 sitios en `queue_service`); `/api/health` ya no expone rutas ni archivos de logos
- [x] **P1.7** JWT validado en el handshake del WebSocket: la identidad sale solo del token (venue verificado); el `user_id` de la query ya no se confía. Frontend (`useWebSocket` + CustomerDashboard) envía el token.
- [x] Locks por venue (`_playback_locks[venue_id]`, `_position_locks[venue_id]`) — un bar ya no bloquea la reproducción/cola de otro

**Pendiente:**

- [ ] **P1.1** Backups automáticos (cron `VACUUM INTO` o Litestream) — **el riesgo #1: la DB de producción no tiene ningún respaldo**
- [ ] **P1.2** Tarea de fondo horaria (limpieza + sesiones + poda de `analytics_events`)
- [ ] **P1.3** `bcrypt` → `asyncio.to_thread` (cada login de admin congela el worker 100-300 ms)
- [ ] **P1.4** Transacciones explícitas donde importan + migraciones atómicas (hoy `isolation_level=None` hace los `commit()` decorativos)
- [ ] **P1.5** Caché + auth en `/api/queue/search` (scrapea YouTube en cada llamada, usable como proxy por terceros)
- [ ] **P1.6** nginx `worker_connections` (techo identificado en CAPACITY.md)
- [ ] **P1.8** Decidir si `blocked_videos` debe ser por venue (hoy un error en un bar bloquea el video para todos)
- [ ] **P2** Tablas `plans` / `subscriptions` / `payments` / `billing_notifications`
- [ ] **P2** Alta autogestionada con trial
- [ ] **P2** Webhook de pasarela (Wompi/Mercado Pago) con idempotencia
- [ ] **P2** Ciclo de vida de suscripción + avisos automáticos
- [ ] **P2** Roles y recuperación de contraseña para admins de bar
- [ ] **P3** Redis pub/sub + estado compartido → varios workers
- [ ] **P3** Migración a PostgreSQL (+ Alembic)
- [ ] **P3** Observabilidad (Sentry, métricas, logs estructurados)
