# Plan: Rediseño de SuperAdmin (dashboard de negocio + roles)

## Contexto

Con el módulo de self-signup, va a haber más bares dándose de alta solos — el super admin necesita más visibilidad para operar el negocio, no solo crear bares a mano. Pedido del usuario: `/superadmin` pasa a ser un dashboard completo (3 áreas: bares, usuarios/eventos, negocio) + roles (super admin, vendedor, editor) sobre lo que ya existe.

Este plan pasó por una revisión con Claude Opus (modelo COMPLEJA) después de que un primer intento de "frontend con mocks" ya mostrara un problema real en curso — ver "Hallazgos de la revisión" abajo. Los hallazgos ya están incorporados en las fases; esta no es una segunda versión en paralelo, es la versión vigente.

## Descubrimiento — qué ya existe (antes de construir nada nuevo)

**Bares:** `venues.paid_until`/`active`/`config`, `compute_payment_status()` (activo/overdue/suspended, dinámico desde `platform_settings`), `list_venues`/`venue_stats`/`mark_paid`/`create_venue`/`update_venue`/`delete_venue`(?) en `superadmin.py` — la gestión completa de bares (crear, activar/desactivar, eliminar, URLs por bar) ya existe y vive hoy en `SuperAdminPanel.vue`.

**Config por bar (canciones/tiempo de espera):** el backend YA soporta `max_duration_sec`/`max_songs_per_window`/`window_minutes` vía `UpdateVenueRequest`/PATCH. Bug ya detectado: `SuperAdminVenueDetail.vue` tiene `editConfig` declarado pero nunca conectado a un formulario ni a un submit real — quick win más barato de este plan (SA-1).

**Usuarios/eventos:** `analytics_service.get_analytics(venue_id, period)` ya calcula canciones totales, usuarios únicos, cola promedio, top canciones, horas pico, top usuarios, **con selector de período** (day/week/month/all) — pero scoped a un solo venue (dashboard del admin del bar). Falta el agregado cross-venue para superadmin, reusando estas queries como base.

**Negocio/plata:** no existe nada hoy. `MarkPaidRequest` solo tiene `months` y `notes` — ni monto, ni historial de pagos (solo el último `paid_until`), ni quién registró el pago.

**Roles:** `super_admins` es tabla plana (`id`, `username`, `password_hash`) sin rol. `get_current_super_admin` es **default-allow** sobre ~20 endpoints (crear/borrar bar, subir logo, playlist, `PATCH /settings`, etc.) — agregar una columna `role` no bloquea nada por sí sola si no se cambia esa dependency.

**Infra:** VPS Hostinger KVM2, compartido con proyectos de otros clientes sin relación (confirmado con `docker-getContainers`: además de los 3 contenedores de Repitela corren otro bar, un WordPress y un bot de WhatsApp). Repitela corre en un solo contenedor backend para todos los venues — no hay aislamiento por bar a nivel de proceso. Dokploy no tiene API de costos en dólares, y sus herramientas de monitoreo (`docker-getContainers`, `settings-checkInfrastructureHealth`) son del agente/CLI, **no algo que el backend de Repitela pueda llamar** sin la API real de Dokploy + token.

## Hallazgos de la revisión con Opus (ya incorporados abajo)

1. Un primer intento de "frontend con mocks" ya reapuntó `/superadmin` a un dashboard nuevo **sin migrar crear/activar/desactivar/eliminar bar** — eso queda inalcanzable si se mergea así. Frenado; ver "Arquitectura de información".
2. Rol como columna sola no protege nada — `get_current_super_admin` sigue siendo default-allow. Hace falta una tabla endpoint→rol mínimo, default-deny, y leer el rol de la DB en cada request (no meterlo en el JWT) para poder revocar al toque.
3. "Carga por bar" (SA-5 original) es el mismo ranking de actividad que SA-4 — no es una fase aparte, es una vista más de los mismos datos.
4. `paid_until = NULL` (bares nuevos/trial, o venues creados sin fecha) es un estado real que el diseño tiene que contemplar explícitamente — hoy `compute_payment_status(None)` devuelve `"active"`, lo cual mezcla "pagando bien" con "nunca pagó".
5. "Ingresos histórico" no se puede calcular sin backfill — los montos de pagos pasados no están guardados en ningún lado hoy.
6. Cero tests en el backend hoy — con roles + plata entrando, conviene al menos un test de la matriz endpoint × rol.
7. Sin plan de rollback escrito, aunque las migraciones son solo aditivas (no destructivas) — dado que no hay backups de la DB, conviene dejar escrito el hábito de dump antes de desplegar.

## Rama y orden de ejecución

Todo en la rama **`kashipu/new-superadmin`** (worktree separado). Orden revisado (más barato primero):

1. **Etapa 0 — Wireframe barato (nueva, pedida por el usuario):** antes de escribir componentes Vue reales, un wireframe de bajo costo (HTML/CSS estático simple, sin lógica, sin conectar a nada, puede vivir fuera de `frontend/src` — p. ej. un solo archivo standalone) que muestre la disposición de las 4 secciones (dashboard, Bares, Usuarios y eventos, Negocio) y **explícitamente dónde quedan crear/activar/desactivar/eliminar bar** (el hallazgo #1 de Opus). Se aprueba el layout acá, con el costo más bajo posible, antes de gastar en componentes reales.
2. **Etapa 1 — Frontend con datos mock (componentes Vue reales):** recién acá se construyen las vistas de verdad, con los mocks extraídos a un archivo separado (`mocks/superadmin.js` o similar) cuya forma sea **exactamente** la que va a devolver cada endpoint real — así conectar en la Etapa 2 es cambiar el import por el `fetch`, no re-maquetar.
3. **Etapa 2 — Backend real:** SA-1 a SA-4 (ver fases), conectando el frontend de la Etapa 1.

## Arquitectura de información

`/superadmin` (root) pasa a ser un dashboard general: KPIs de un vistazo (bares activos/overdue/**trial-sin-pagar**/suspended, pagos recibidos este mes, ingresos del mes) con selector de período. Bares / Usuarios y eventos / Negocio son tabs desde ahí.

**Decisión explícita sobre `SuperAdminPanel.vue` (resuelve el hallazgo #1):** el tab "Bares" **monta las acciones existentes de `SuperAdminPanel.vue`** (crear, activar/desactivar, eliminar, URLs por bar) — no se reescriben desde cero ni quedan huérfanas. `SuperAdminPanel.vue` se elimina/renombra recién cuando el tab "Bares" ya cubre el 100% de lo que hacía, como paso propio al final, no antes.

`SuperAdminVenueDetail.vue` no cambia de fondo (fuera de la Fase SA-1).

## Fases propuestas

### Fase SA-1 — Quick win: conectar `editConfig`
`SuperAdminVenueDetail.vue` arma el formulario real (canciones por ventana, minutos de ventana, duración máxima) contra el PATCH que ya existe. Agregar validación de rango en el form (`max_duration_sec` sin tope hoy permitiría poner 10 horas). Cero backend nuevo.

### Fase SA-2 — Roles (`super_admin` / `vendedor` / `editor`) — alcance acotado
Con 1-2 personas reales operando hoy, esta fase se reduce a lo mínimo necesario, no a un sistema completo de gestión de usuarios:
- Migración: `super_admins` gana `role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin','vendedor','editor'))`.
- Tabla explícita endpoint → rol mínimo requerido (default-deny para lo no listado), chequeada dentro de la dependency de auth — **no** alcanza con ocultar botones en el frontend.
- El rol se lee de la DB en cada request (no viaja en el JWT) — permite revocar sin esperar a que expire un token.
- Granularidad por campo donde haga falta: `editor` puede tocar `max_duration_sec`/`max_songs_per_window`/`window_minutes`/tema, pero **no** `active` ni `name` del venue (aunque sea el mismo endpoint PATCH hoy).
- Permisos: `vendedor` ve pagos/renovaciones/métricas comerciales de bares (incluye "ingresos" — es su KPI de trabajo), marca pagos, **no** ve costos de infraestructura ni crea/elimina bares. `editor` gestiona config operativa de bares, sin datos financieros.
- **Fuera de esta fase:** UI de gestión de super_admins (crear/borrar/cambiar rol) — se pospone hasta que haya una persona real a la que darle ese usuario. Hoy se siembran manualmente (`backend/app/db/seed.py`).
- `payment_history` (Fase SA-3) guarda `created_by` (id del super_admin que registró el pago) — auditoría mínima, una columna.

### Fase SA-3 — Vista "Bares" + Negocio/facturación (fusiona el antiguo SA-5 financiero)
- Columnas/filtros en la tabla de bares: activo, estado de pago (**agregar el estado `trial`/`sin pago` explícito, distinto de `active`**, para no confundir "paga bien" con "nunca pagó"), días para vencer, última renovación y monto.
- Nueva tabla `payment_history` (ledger real, no solo el último `paid_until`): `venue_id`, `amount`, `currency` (fijar en COP, entero en centavos para evitar problemas de punto flotante), `months`, `notes`, `created_by`, `created_at`.
- `MarkPaidRequest` gana `amount`.
- "Ingresos del mes" se calcula sumando `payment_history` real desde que existe la tabla — "histórico" se etiqueta explícitamente como "desde `<fecha de lanzamiento de esta función>`", no se inventa un backfill de pagos pasados que no están registrados en ningún lado.

### Fase SA-4 — Vista "Usuarios y eventos" + "carga por bar" (fusiona el antiguo SA-5 de actividad/infra)
- Nuevo endpoint que agrega `analytics_events`/`play_history`/`queue_songs` a través de TODOS los venues, **reusando las queries de `analytics_service.get_analytics` como base**, con selector de período — canciones promedio por bar, top bares por actividad, usuarios totales.
- Este mismo ranking de actividad **es** la "carga por bar" (proxy de cuánto pesa cada bar en el server compartido) — no se construye una vista aparte para eso.
- Salud general del server (no por bar): un link directo al dashboard/monitoreo que Dokploy ya tiene corriendo (`dokploy-monitoring`), o si se quiere un número simple in-app, `os.getloadavg()` desde el propio backend (una línea, sin depender de la API de Dokploy) — nada de reconstruir un sistema de alertas o guardar métricas de infraestructura en la DB.
- Alertas del dashboard (bares vencidos, etc.) se derivan en el cliente de la lista de bares que ya se trae — no se crea una tabla ni un motor de alertas.

## Seguridad y datos

- Rollback: las migraciones son solo aditivas (agregar columnas/tablas), revertir código no requiere revertir schema. Dado que la DB no tiene backups automáticos, hacer un dump manual del `.sqlite` antes de desplegar esta rama a producción.
- Tests mínimos: al menos `test_roles.py` con la matriz endpoint × rol (qué puede y qué no puede hacer cada rol) antes de dar la Fase SA-2 por cerrada.

## Verificación (al implementar)

- Etapa 0: el wireframe se revisa y aprueba visualmente (incluye dónde quedan crear/activar/desactivar/eliminar bar) antes de pasar a la Etapa 1.
- Etapa 1: las 4 secciones renderizan con mocks en dark/light/responsive, sin llamar ningún endpoint nuevo.
- Etapa 2: `test_roles.py` pasa, `SuperAdminPanel.vue` puede eliminarse sin perder ninguna acción (ya cubierta por el tab "Bares"), dump de la DB tomado antes de desplegar.
