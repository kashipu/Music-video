# Plan: Rediseño de SuperAdmin (analítica de negocio + roles)

## Contexto

Con el módulo de self-signup, va a haber más bares dándose de alta solos — el super admin necesita más visibilidad para operar el negocio, no solo crear bares a mano. Pedido del usuario: 3 áreas de información nuevas (bares, usuarios/eventos, negocio) + roles (super admin, vendedor, editor) sobre lo que ya existe.

## Descubrimiento — qué ya existe (antes de construir nada nuevo)

**Bares:** `venues.paid_until`/`active`/`config`, `compute_payment_status()` (activo/overdue/suspended, ya dinámico desde `platform_settings`), `list_venues`/`venue_stats`/`mark_paid` en `superadmin.py` — todo esto ya existe y funciona.

**Config por bar (canciones/tiempo de espera):** el backend YA soporta `max_duration_sec`/`max_songs_per_window`/`window_minutes` vía `UpdateVenueRequest`/PATCH. **Bug ya detectado en esta misma sesión** (investigación de Codex más temprano): `SuperAdminVenueDetail.vue` tiene `editConfig` declarado pero nunca conectado a un formulario ni a un submit real — es el quick win más barato de este plan.

**Usuarios/eventos:** `analytics_service.get_analytics(venue_id, period)` ya calcula canciones totales, usuarios únicos, cola promedio, top canciones, horas pico, top usuarios — pero está **scoped a un solo venue** (lo usa el dashboard del admin del bar). Falta la vista agregada cross-venue para superadmin.

**Negocio (facturación/costos/alertas de infra):** esto **no existe nada hoy**. `MarkPaidRequest` solo tiene `months` y `notes` — ni monto de pago, ni historial de pagos (solo el último `paid_until`), ni costos de operación, ni alertas.

**Roles:** `super_admins` es una tabla plana (`id`, `username`, `password_hash`) sin columna de rol — hoy todo super admin tiene el mismo poder total. No hay concepto de vendedor/editor.

## Arquitectura de información

`/superadmin` (root, hoy `SuperAdminPanel.vue` = lista de bares) pasa a ser un **dashboard general del negocio**: KPIs de un vistazo (bares activos/overdue/suspended, cuántos pagaron este mes, ingresos del mes, alertas si algo falla) apenas entrás. Las 3 áreas (Bares, Usuarios y eventos, Negocio) son secciones/tabs más profundas a las que se navega desde ahí — no reemplazan el dashboard, lo alimentan. `SuperAdminVenueDetail.vue` (el detalle de un bar puntual) sigue existiendo tal cual, sin cambios de fondo.

## Fases propuestas

### Fase SA-0 — Dashboard general en `/superadmin` (nuevo root)
Reemplaza `SuperAdminPanel.vue` como landing (la lista de bares se mueve a una sub-vista/tab "Bares"). Tarjetas de KPI: bares activos/overdue/suspended, pagos recibidos este mes (cuenta + monto, depende de la Fase SA-3), ingresos totales del mes/histórico, alertas si las hay (Fase SA-5). Se construye **al final**, después de SA-1 a SA-5, porque consume datos de esas fases — no tiene sentido armar el shell antes de tener qué mostrar en él.

### Fase SA-1 — Quick win: conectar `editConfig` (backend ya existe)
Cerrar el bug ya detectado. `SuperAdminVenueDetail.vue` arma el formulario real (canciones por ventana, minutos de ventana, duración máxima) contra el PATCH que ya existe. Cero backend nuevo.

### Fase SA-2 — Roles (`super_admin` / `vendedor` / `editor`)
- Migración: `super_admins` gana `role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin','vendedor','editor'))`.
- Propuesta inicial de permisos (**a confirmar con el usuario, ver preguntas abajo**):
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

### Fase SA-5 — Vista "Negocio" (facturación, costos, alertas)
Lo único genuinamente nuevo desde cero. Propuesta mínima, sin construir un ERP:
- Facturación/balance: se deriva de la Fase SA-3 (suma de `payment_history`), no un módulo de contabilidad aparte.
- Costos de operar: campo simple que el superadmin carga a mano (servidor, dominio, etc.) — sin integración automática con Dokploy/hosting salvo que se pida explícitamente.
- Alertas de infraestructura: por definir alcance (ver preguntas abajo) — revisar primero si Dokploy ya expone algo reusable antes de construir monitoring propio.

## Preguntas abiertas — necesito que las confirmes antes de implementar

1. Permisos exactos de vendedor vs editor (la propuesta de la Fase SA-2 es un punto de partida, no una decisión final).
2. "Costos de operar" — ¿se cargan a mano, o hay que investigar integrar alguna API real de hosting/facturación?
3. Alertas de infraestructura — ¿qué tan profundo? (¿uptime simple, o métricas de CPU/memoria/DB del server?)
4. No entendí "un plan con upus" en tu mensaje — ¿a qué te referías? (¿user stories, otra cosa?)
