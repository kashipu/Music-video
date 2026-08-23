# Plan: Rediseño de SuperAdmin (analítica de negocio + roles)

## Contexto

Con el módulo de self-signup, va a haber más bares dándose de alta solos — el super admin necesita más visibilidad para operar el negocio, no solo crear bares a mano. Pedido del usuario: 3 áreas de información nuevas (bares, usuarios/eventos, negocio) + roles (super admin, vendedor, editor) sobre lo que ya existe.

## Descubrimiento — qué ya existe (antes de construir nada nuevo)

**Bares:** `venues.paid_until`/`active`/`config`, `compute_payment_status()` (activo/overdue/suspended, ya dinámico desde `platform_settings`), `list_venues`/`venue_stats`/`mark_paid` en `superadmin.py` — todo esto ya existe y funciona.

**Config por bar (canciones/tiempo de espera):** el backend YA soporta `max_duration_sec`/`max_songs_per_window`/`window_minutes` vía `UpdateVenueRequest`/PATCH. **Bug ya detectado en esta misma sesión** (investigación de Codex más temprano): `SuperAdminVenueDetail.vue` tiene `editConfig` declarado pero nunca conectado a un formulario ni a un submit real — es el quick win más barato de este plan.

**Usuarios/eventos:** `analytics_service.get_analytics(venue_id, period)` ya calcula canciones totales, usuarios únicos, cola promedio, top canciones, horas pico, top usuarios — pero está **scoped a un solo venue** (lo usa el dashboard del admin del bar). Falta la vista agregada cross-venue para superadmin.

**Negocio (facturación/costos/alertas de infra):** esto **no existe nada hoy**. `MarkPaidRequest` solo tiene `months` y `notes` — ni monto de pago, ni historial de pagos (solo el último `paid_until`), ni costos de operación, ni alertas.

**Roles:** `super_admins` es una tabla plana (`id`, `username`, `password_hash`) sin columna de rol — hoy todo super admin tiene el mismo poder total. No hay concepto de vendedor/editor.

## Rama y orden de ejecución

Todo esto se ejecuta en una rama nueva **`new-superadmin`** (worktree separado, no en `frontend/design-system-shadcn`).

**Orden pedido por el usuario: frontend primero, backend después.** Se arma primero el look completo del dashboard con datos mock/estáticos (para validar visualmente la información y el layout antes de comprometerse a un schema), y solo después se construye el backend real y se conecta. Concretamente:

1. **Etapa 1 — Frontend con datos mock:** las 4 vistas (SA-0 dashboard, SA-3 Bares, SA-4 Usuarios y eventos, SA-5 Negocio) con JSON estático que simule la forma real de los datos — se aprueba el diseño visual acá, antes de tocar backend.
2. **Etapa 2 — Backend real:** las fases de datos/roles (SA-1, SA-2, SA-3 backend, SA-4 backend, SA-5 backend) — se implementan y se conecta el frontend de la Etapa 1 reemplazando los mocks por los endpoints reales.

## Arquitectura de información

`/superadmin` (root, hoy `SuperAdminPanel.vue` = lista de bares) pasa a ser un **dashboard general del negocio**: KPIs de un vistazo (bares activos/overdue/suspended, cuántos pagaron este mes, ingresos del mes, alertas si algo falla) apenas entrás. Las 3 áreas (Bares, Usuarios y eventos, Negocio) son secciones/tabs más profundas a las que se navega desde ahí — no reemplazan el dashboard, lo alimentan. `SuperAdminVenueDetail.vue` (el detalle de un bar puntual) sigue existiendo tal cual, sin cambios de fondo.

## Fases propuestas

### Fase SA-0 — Dashboard general en `/superadmin` (nuevo root)
Reemplaza `SuperAdminPanel.vue` como landing (la lista de bares se mueve a una sub-vista/tab "Bares"). Tarjetas de KPI: bares activos/overdue/suspended, pagos recibidos este mes (cuenta + monto, depende de la Fase SA-3), ingresos totales del mes/histórico, alertas si las hay (Fase SA-5).

### Fase SA-1 — Quick win: conectar `editConfig` (backend ya existe)
Cerrar el bug ya detectado. `SuperAdminVenueDetail.vue` arma el formulario real (canciones por ventana, minutos de ventana, duración máxima) contra el PATCH que ya existe. Cero backend nuevo.

### Fase SA-2 — Roles (`super_admin` / `vendedor` / `editor`)
- Migración: `super_admins` gana `role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin','vendedor','editor'))`.
- Permisos confirmados por el usuario:
  - `super_admin`: todo, incluye gestionar otros admins/roles y ver el módulo de Negocio.
  - `vendedor`: ver estado de pago/renovación de bares, marcar pagos, ver métricas comerciales — sin ver costos de infraestructura ni crear/eliminar bares.
  - `editor`: gestionar config de bares (canciones, tiempo de espera, tema/branding, playlist de respaldo) — sin datos financieros.
- Backend: dependency de auth con chequeo de rol (extiende `get_current_super_admin`, no lo reemplaza).
- Frontend: `SuperAdminPanel.vue` oculta/deshabilita secciones según el rol logueado.

### Fase SA-3 — Vista "Bares" (rediseño, extiende lo existente)
- Columnas/filtros: activo, estado de pago, días para vencer, última renovación y **monto** (nuevo).
- Nuevo: agregar `amount` a `MarkPaidRequest` + tabla `payment_history` (ledger de pagos, no solo el último `paid_until`) para poder mostrar "por cuánto renovaron" con historial real, no solo el estado actual.

### Fase SA-4 — Vista "Usuarios y eventos" (agregado cross-venue)
Nuevo endpoint que agrega `analytics_events`/`play_history` a través de TODOS los venues, **reusando las queries de `analytics_service.get_analytics` como base** (no reinventar el cálculo) — canciones promedio por bar, top bares por actividad, usuarios totales.

### Fase SA-5 — Vista "Negocio" (facturación + carga por bar, no costos en plata)
Lo único genuinamente nuevo desde cero. **Investigado con las herramientas de Dokploy:** no hay API de costos en dólares — Dokploy no cobra, solo orquesta lo que ya corre en el VPS de Hostinger (KVM2). Además el server es **compartido con proyectos de otros clientes sin relación** (confirmado vía `docker-getContainers`: además de los 3 contenedores de Repitela corren otro bar, un WordPress y un bot de WhatsApp en la misma máquina), y Repitela corre en **un solo contenedor backend para todos los venues** — no hay aislamiento por bar a nivel de proceso/contenedor, así que CPU/RAM por bar no se puede medir directo.

Lo que sí se puede construir, con lo que ya existe:
- Facturación/balance: se deriva de la Fase SA-3 (suma de `payment_history`) — esto sí es plata real, no cambia.
- **Carga por bar (proxy de actividad, no CPU/RAM real):** ranking de bares por volumen de eventos/canciones/usuarios concurrentes en `analytics_events`/`play_history`/`queue_songs` (misma fuente que la Fase SA-4) — un bar con mucha más actividad que el resto es candidato a estar pesando más en el server compartido, sin necesitar métricas de infraestructura nuevas.
- Salud general del server (no por bar): Dokploy ya expone contenedores/estado (`docker-getContainers`, `settings-checkInfrastructureHealth`) y tiene su propio contenedor de monitoreo corriendo (`dokploy-monitoring`) — la vista de Negocio puede enlazar/mostrar eso en vez de reconstruir un sistema de métricas propio.

## Preguntas abiertas — todavía sin resolver

1. Alertas de infraestructura — ¿alcanza con enlazar el estado que ya da Dokploy (activo/caído), o hace falta métricas de CPU/memoria más detalladas?
2. No entendí "un plan con upus" en tu mensaje original — ¿a qué te referías?
