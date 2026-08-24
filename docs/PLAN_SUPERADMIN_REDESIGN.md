# Plan: SuperAdmin — mobile-first, sin tablas, con gestión de administradores

## Contexto y por qué se reescribió (tercera versión)

Versión 1: dashboard con 6 KPIs, roles, facturación, ledger de pagos — Opus encontró huecos serios, se descartó.
Versión 2: lista de bares en tabla de 5 columnas por último uso real, sin roles ni facturación — se implementó (Fase 1+2, backend `last_used_at`/`last_admin_login` + tabla en `SuperAdminPanel.vue`). El usuario la vio en un preview y pidió un giro: **nada de tablas, la pantalla se opera desde el celular**, y quiere de vuelta la gestión de roles (vendedor/editor) que la v2 había dejado fuera.

**Lo que el usuario pidió, textual:** "EN SUPERADMIN NO USAMOS TABLAS TODO OPTIMIZADO PARA OPERAR DESDE MOBILE". Tres piezas, nada más ("ESTO ES TODO LO QUE NECESITO de esta pantalla"):
1. Barra de indicadores (bares activos / en prueba / en mora / pagados — sin repetir la palabra "bares" en cada uno).
2. Listado de **cards** (no filas de tabla): link al bar, último uso del bar, última conexión del admin, si hay usuarios activos en la cola ahora mismo, botón "Ver detalle".
3. Un creador de administradores del super admin — CRUD completo para crear vendedores y editores.

## Qué se conserva de la v2 (no se tira)

- `last_used_at` (`MAX(play_history.played_at)` por venue) y `last_admin_login` (`MAX(admins.last_login_at)` por venue, migración `015_admin_last_login.sql` + update en `admin_auth.py:admin_login`) — ya en `superadmin.py:list_venues`, commiteado. Son exactamente los dos datos que pide la card ("último uso del bar" y "última conexión del admin").
- `queue_count` (canciones pending/playing) y `active_sessions` (`user_sessions` sin `ended_at`) — ya vienen en la misma respuesta de `list_venues`. "Si hay usuarios activos en la cola" es `active_sessions > 0` (o `queue_count > 0`), dato que ya existe, cero backend nuevo para esto.
- `compute_payment_status()` (`active`/`overdue`/`suspended`, dinámico desde `platform_settings`) y `venues.paid_until` — insumo directo para la barra de indicadores.
- **Se descarta** el trabajo de tabla de `SuperAdminPanel.vue` (5 columnas, sparkline, menú `⋯` con Teleport) — commiteado como v2 pero queda reemplazado por completo. No se revierte el commit (es historia útil), se reescribe el archivo.
- El detalle (`SuperAdminVenueDetail.vue`) con `editConfig` conectado (SA-1) sigue vigente sin cambios — el botón "Ver detalle" de la card sigue llevando ahí.

## Terminología — se mantiene la tabla de reemplazos del plan anterior

(Overdue→Pago vencido, Trial→Sin pago registrado, Suspended→Suspendido, KPIs/Dashboard→Resumen, etc. — ver commit `ea4b09f` si hace falta el detalle completo, no se repite aquí.)

## Diseño — mobile-first, dos secciones

### 1. Barra de indicadores (arriba, sticky en mobile)

Cuatro números, sin la palabra "bares" repetida en cada uno (ya está en el título de la sección):

> **Bares** · 24 activos · 3 en prueba · 2 en mora · 19 pagados

- **Activos** = `venues.active = true`.
- **En prueba** = `paid_until IS NULL` (nunca se le registró un pago) — hoy `compute_payment_status(None)` lo trata igual que "active", hay que distinguirlo aquí explícitamente como categoría propia, no fusionarlo.
- **En mora** = `payment_status == 'overdue'`.
- **Pagados** = `paid_until` en el futuro y no en prueba (`payment_status == 'active'` y `paid_until` no nulo).
- Los 4 números salen de los venues que ya trae `GET /api/superadmin/venues` — cálculo 100% client-side (`computed`), igual que la v2 hacía con sus contadores de filtro. Cero endpoint nuevo.
- Tocar un número filtra el listado de cards de abajo (mismo patrón de filtro clicable que ya existía en la v2, adaptado a estas 4 categorías).

### 2. Listado de cards (reemplaza la tabla)

Una card por bar, apiladas en columna única en mobile, grid de 2-3 columnas en desktop (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` o similar — mobile-first: una sola columna es el diseño base, el grid es el "upgrade" en pantallas anchas, no al revés).

Cada card, en este orden:
- Nombre del bar (el nombre completo ES el link — toca la card entera o el nombre, navega a "Ver detalle"; no hace falta un link de texto separado).
- Último uso: mismo texto relativo que ya existía (`Hoy`/`Ayer`/`hace N días`/`Nunca`), fuente `last_used_at`.
- Última conexión del admin: mismo formato relativo, fuente `last_admin_login` (ya expuesto, ver arriba).
- Indicador simple de actividad ahora mismo: punto/badge "🟢 Con gente en cola" si `active_sessions > 0` (o `queue_count > 0`), si no, no se muestra nada (evitar un "🔴 sin nadie" ansioso — la ausencia de badge ya comunica que no hay actividad).
- Botón "Ver detalle" → `SuperAdminVenueDetail.vue` (sin cambios).
- Acciones secundarias (activar/desactivar, eliminar, URLs, crear bar): **no van en la card** — se preservan pero se mueven dentro de "Ver detalle" (el detalle ya es una vista completa, tiene espacio de sobra; la card se queda liviana y sin menú `⋯` que clipear). Esto también resuelve de raíz el bug de scroll que había reportado el usuario en la tabla — al no haber tabla ni menú posicionado dentro de un contenedor con `overflow`, el problema desaparece en vez de parchearse.
- "+ Crear bar" se queda como acción fija arriba del listado (no es parte de una card individual).

## 3. Gestión de administradores del super admin (CRUD, vendedor/editor)

Esto reintroduce, acotado, lo que la v1 había propuesto como "Fase SA-2" y la v2 sacó del alcance por no haber gente operando el rol todavía — el usuario ahora sí lo pide explícito, así que se implementa, pero solo lo que pidió: **crear administradores del super admin con rol**, no un sistema de permisos granular todavía.

**Alcance de esta fase (CRUD, no enforcement):**
- Migración: `super_admins` gana `role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin','vendedor','editor'))`.
- Endpoints nuevos en `superadmin.py` (protegidos por `get_current_super_admin`, igual que el resto del router hoy — sin diferenciar por rol todavía, ver nota abajo):
  - `GET /api/superadmin/admins` — lista (id, username, role, created_at, sin password_hash).
  - `POST /api/superadmin/admins` — crea (username, password, role).
  - `PATCH /api/superadmin/admins/{id}` — cambia rol o resetea password.
  - `DELETE /api/superadmin/admins/{id}` — elimina (no permitir auto-eliminarse, validar que quede al menos un `super_admin`).
- Frontend: una pantalla o sección nueva (`SuperAdminUsers.vue` o una card/acordeón dentro del mismo `/superadmin` — a definir en la Task de implementación, mobile-first igual que el resto) con lista + formulario crear + selector de rol + eliminar.

**Nota explícita para la Task (no bloquea esta fase, pero que quede escrito):** guardar `role` sin que ningún endpoint lo lea todavía es un dato decorativo — hoy `get_current_super_admin` es default-allow para cualquier fila de `super_admins` sin importar el rol. El usuario pidió literalmente "el creador... todo el CRUD para esto crear vendedores y editores", no pidió enforcement de permisos por rol — se implementa tal cual se pidió (guardar y gestionar el rol), y el enforcement granular (qué puede tocar un `vendedor` vs un `editor`) queda como fase futura separada, a pedir explícitamente cuando haya alguien real operando con esos roles.

## Fases

### Fase 1 — Backend: ya cerrada
`last_used_at`, `last_admin_login`, `queue_count`, `active_sessions` ya están en `list_venues` (commits `984b56e` y `1299168`). Nada nuevo que hacer acá.

### Fase 2 — Frontend: `SuperAdminPanel.vue` rehecho como barra de indicadores + cards
Reemplaza por completo la tabla de la v2 (se descarta ese diseño, no se reutiliza su CSS). Mobile-first: la card de una columna es el layout base, el grid multi-columna es progressive enhancement con `@media (min-width: ...)`. Acciones secundarias (activar/desactivar/eliminar/URLs) se mudan a `SuperAdminVenueDetail.vue`.

### Fase 3 — Backend + Frontend: CRUD de administradores del super admin
Migración de `role`, los 4 endpoints, la pantalla/sección de gestión (crear vendedor/editor, listar, eliminar). Ver alcance exacto arriba.

### Fase 4 (ya existía, sigue igual) — `SuperAdminVenueDetail.vue`
Analítica del bar (personas/día, mejor día — `get_daily_analytics` ya existe en `analytics_service.py`) + ahora también recibe las acciones que salieron de la card (activar/desactivar/eliminar/URLs).

## Verificación

- Barra de indicadores: los 4 números suman correctamente contra los venues reales de la DB de prueba (Docker), y tocar cada uno filtra el listado.
- Cards: se ven en una columna en un viewport de ancho móvil (ej. 375px) sin scroll horizontal, y en grid en desktop. Último uso / última conexión admin / actividad en cola coinciden con los datos reales de cada bar.
- CRUD de administradores: crear un vendedor y un editor, verificar que aparecen en el listado con su rol correcto, eliminar uno, confirmar que no se puede eliminar el último `super_admin` restante.
- `SuperAdminVenueDetail.vue` sigue teniendo activar/desactivar/eliminar/URLs funcionando (movidos desde la card, no perdidos).
