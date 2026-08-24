# Plan: SuperAdmin — lista de bares por uso real (alcance acotado)

## Contexto y por qué se reescribió

Este plan tuvo dos versiones anteriores: una primera que agregaba un dashboard con 6 tarjetas de KPI, roles, facturación y un ledger de pagos; una revisión con Claude Opus encontró huecos serios ahí (rol sin enforcement real, KPI de ingresos imposible sin backfill, SuperAdminPanel.vue quedando huérfano). Después el usuario pidió algo mucho más chico: **solo lo que ya está implementado**, sin jerga en inglés, sin que se sienta como "un dashboard con muchas métricas". Una segunda consulta con Opus (grounded en el código real) propuso el diseño de esta versión — es la vigente, no hay que reconciliar con las anteriores.

**Lo que el usuario pidió, en sus palabras:** saber qué bares están activos, cuáles se están usando de verdad, cuál fue su última conexión, y la analítica de cada bar (usuarios promedio por día, mejor día).

## Descubrimiento — qué ya existe

- `venues.active` (booleano) — flag manual del superadmin, **no** mide uso real.
- `play_history` tiene `venue_id` + `played_at` (indexado por venue+fecha) — cada canción reproducida en un bar queda ahí. `MAX(played_at)` por venue es la señal de "último uso" — cero tabla nueva.
- `user_sessions` (`venue_id`, `started_at`, `ended_at`) — sesiones de clientes vía QR, señal de actividad complementaria.
- `analytics_service.get_analytics(venue_id, period)` en `backend/app/services/analytics_service.py` ya calcula por bar: canciones totales, usuarios únicos, cola promedio, top canciones, horas pico, con período day/week/month/all — es la "analítica del bar" que pidió el usuario, ya existe y la usa hoy `AdminDashboard.vue` (el dashboard del admin de cada bar). Falta agrupar por día para sacar "personas por día" y "mejor día" — variación barata de la misma query.
- `SuperAdminVenueDetail.vue` tiene el bug ya detectado de `editConfig` sin conectar (backend ya soporta el PATCH) — se mantiene como quick win independiente.

## Decisión de diseño (de la consulta con Opus)

**No hay tab "Dashboard" con tarjetas de KPI.** La lista de Bares (root de `/superadmin`, hoy `SuperAdminPanel.vue`) **es** el resumen. Arriba de la tabla, una sola frase con números clicables como filtro:

> 31 bares · 18 en uso esta semana · 3 sin uso hace más de 15 días · 2 apagados

**Tres/cuatro estados de uso, derivados de `MAX(play_history.played_at)`** (no del flag `active`):

| Señal | Regla | Texto |
|---|---|---|
| 🟢 En uso | último uso ≤ 7 días | `Hoy` / `Ayer` / `hace 3 días` |
| 🟡 Sin movimiento | 8–30 días | `hace 12 días` |
| ⚪ Nunca se usó | sin `play_history` | `Nunca` |
| ⚫ Apagado | `active = false` | fila atenuada, sin punto |

Un bar `active = true` con último uso "hace 18 días" se lee solo con esto — sin agregar una fila de métricas por bar.

**Tabla de la lista — 5 columnas, nada más:**

| Bar | Último uso | Últimos 14 días (opcional, sparkline chico) | Estado | Acciones |
|---|---|---|---|---|

Orden por defecto: último uso descendente (los bares muertos caen al fondo solos). **No van en la lista:** canciones totales, usuarios únicos, cola promedio, horas pico, cantidad de admins, días para vencer, las 3 URLs por bar. Crear/activar/desactivar/eliminar/URLs van en un menú `⋯` por fila (hoy ocupan media pantalla en `SuperAdminPanel.vue`) — se preservan, no se pierden, solo se compactan.

**El detalle (`SuperAdminVenueDetail.vue`) es donde vive la analítica**, reusando `get_analytics` tal cual (mismo selector de período): personas por día (promedio), mejor día (fecha + número), canciones reproducidas en el período, un gráfico de barras de personas por día — los dos números salen del mismo array que alimenta el gráfico, se calcula una vez.

## Terminología — reemplazos obligatorios

| No usar | Usar |
|---|---|
| Overdue | Pago vencido |
| Trial / sin pagar | Sin pago registrado |
| Suspended | Suspendido |
| Ledger de pagos | Historial de pagos |
| KPIs / Dashboard | Resumen |
| Unique users | Personas distintas |
| Peak hours | Horas de mayor movimiento |
| Avg queue length | Cola promedio |
| Top songs | Canciones más pedidas |
| "Última conexión" | "Último uso" (más honesto: mide uso, no conexión) |
| Fallback | No debe aparecer en superadmin — es un detalle interno de `Kiosk.vue` |

## Qué queda explícitamente fuera de este plan (versiones anteriores, descartadas)

- **Roles (super_admin/vendedor/editor):** 1-2 personas operando hoy — infraestructura para un problema que no existe todavía.
- **`payment_history`, montos, ingresos, ledger:** requeriría backfill imposible de datos que no están registrados en ningún lado. `paid_until` + "Pago vencido" ya alcanza para saber a quién cobrarle.
- **Tab "Negocio" y tab "Usuarios y eventos" (agregado cross-venue):** nadie lo pidió así; ordenar la lista por "último uso" ya da el ranking de actividad.
- **Carga de infraestructura por bar / `os.getloadavg()`:** eso se mira en Dokploy, no en Repitela.
- **El wireframe multi-tab (`docs/wireframe-superadmin.html`) queda obsoleto** — era el diseño de la versión anterior. Se reemplaza por este plan, no se reusa su layout.

## Fases

### Fase 1 — Backend: última conexión + analítica por día
- `list_venues` (`superadmin.py`) gana una columna calculada `last_used_at` = `MAX(play_history.played_at)` por venue (subquery o LEFT JOIN agrupado, sin tabla nueva).
- `analytics_service.py` gana una función (o parámetro) que agrupa `play_history` por día dentro del período — de ahí salen "personas por día" (promedio) y "mejor día" (fecha + máximo). Reusa la lógica existente de `get_analytics`, no la reescribe.

### Fase 2 — Frontend: lista de Bares rediseñada
- `SuperAdminPanel.vue`: la frase-resumen arriba (con los números como filtros), tabla de 5 columnas con los 4 estados de uso, menú `⋯` por fila con las acciones existentes (crear/detalle/activar/desactivar/eliminar/URLs) — nada de esto se pierde, se compacta.
- Aplicar la tabla de terminología de arriba en toda la vista (y revisar si el wireframe/plan anterior dejó algún término en inglés dando vueltas).

### Fase 3 — Frontend: detalle del bar con analítica
- `SuperAdminVenueDetail.vue`: sección de analítica con selector de período (reusa el de `AdminDashboard.vue` si existe un patrón ya hecho), personas/día promedio, mejor día, canciones reproducidas, gráfico de barras.
- Aprovechar la misma Task/PR para cerrar el bug ya detectado de `editConfig` sin conectar (backend ya soporta el PATCH) — es del mismo archivo, mismo alcance de revisión.

## Verificación

- `last_used_at` calculado correctamente contra la copia Docker de la DB (bares con `play_history` reciente vs. bares sin ninguna fila).
- Lista de Bares: verificar visualmente los 4 estados de uso (en uso / sin movimiento / nunca / apagado) con datos reales o sembrados a propósito.
- Detalle: personas/día y mejor día coinciden con lo que ya muestra `AdminDashboard.vue` para ese mismo bar/período (mismo cálculo, no debería divergir).
- `editConfig` guarda de verdad contra el PATCH existente.
