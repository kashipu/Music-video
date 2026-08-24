# Módulo Ventas y Facturación + Wompi

## Contexto

Repítela cobra suscripciones mensuales a los bares pero hoy todo es manual: el superadmin marca pagos a mano en `VenueBillingPanel.vue`. Se necesita (1) que el dueño del bar vea su suscripción y pague con Wompi desde su propio panel (checkout web + webhook), (2) una sección top-level "Ventas y facturación" en superadmin con ingresos, movimientos globales y ajustes de precio, y (3) mantener el detalle por venue que ya existe. Un solo plan mensual por ahora (`platform_settings.monthly_price_cents`), sin cerrar la puerta a 2-3 planes futuros. No se generan facturas legales.

**Hallazgo clave**: `venue_billing_events` (migración 021) ya está listo para pasarela — `source`, `provider_ref` con índice único (idempotencia de webhook gratis), `raw_payload`, `status`. **No hace falta migración nueva.** El badge "Wompi" y los estados Rechazado/Anulado ya se renderizan en `VenueBillingPanel.vue`.

## Orden de ejecución acordado: frontend primero

Se implementa **primero el frontend completo** (Fase C y D) contra el contrato de API ya definido abajo (endpoints y payloads exactos), para revisar diseño/UX antes de tocar backend. Mientras el backend no exista, las llamadas fetch fallarán en el navegador — se revisa maquetación/flujo con datos de ejemplo hardcodeados temporalmente donde haga falta, y se retiran al conectar el backend real. Solo después de aprobar el frontend se ejecuta Fase A (fixes) y Fase B (Wompi + endpoints), en ese orden, para no romper nada que ya esté validado visualmente.

---

## Fase A — Fixes prerequisito (bugs que el cobro automático expondría)

### A1. Mover `get_platform_settings()` (y `compute_payment_status()`) a `billing_service.py`
- De `backend/app/routers/superadmin.py:14` (y `:28-42`) a `backend/app/services/billing_service.py`; ajustar los ~5 call-sites en superadmin.py (L30, L151, L160, L220, L689).
- Motivo: `auth_service` y el nuevo router `billing.py` los necesitan sin ciclos de import (`billing_service` solo importa `database`).

### A2. `record_event()` respeta `status` (`billing_service.py:51-61`)
- Solo `status == "approved"` actualiza `venues` (`paid_until`, `active = TRUE`); declined/pending solo insertan el evento (bug actual: un pago rechazado igual extiende 30 días).
- `active = TRUE` también para `kind='trial'` aprobado (bug actual: venue auto-suspendido no revive al extender trial).
- Tests en `backend/tests/test_billing.py` (reusar helper existente): declined no toca `paid_until`; trial aprobado revive venue inactivo.

### A3. Grace period dinámico (`backend/app/services/auth_service.py:47`)
- Reemplazar `timedelta(days=5)` hardcodeado por `platform_settings.grace_period_days` vía `billing_service.get_platform_settings()`.

## Fase B — Backend Wompi

### B1. Config (`backend/app/config.py` + `.env.example`)
```python
wompi_public_key: str = ""
wompi_integrity_secret: str = ""
wompi_events_secret: str = ""
```
Sandbox vs prod se distingue por las llaves (`pub_test_*` / `pub_prod_*`); misma URL de checkout.

### B2. Router nuevo `backend/app/routers/billing.py` (registrar en `main.py`)
Constante `PLAN_DAYS = 30` con comentario `# ponytail: plan único; multi-plan = tabla plans + plan_id en checkout/webhook`.

- **`GET /api/admin/billing`** (auth admin del bar): `{payment_status, paid_until, days_remaining, monthly_price_cents, history[]}` — últimos 12 eventos del venue (kind, status, amount_cents, period_start, period_end, created_at). No exponer `created_by_username` ni `notes`.
- **`GET /api/admin/billing/checkout`** (auth admin): monto desde `platform_settings` (409 si 0, 503 si no hay llaves Wompi), `reference = f"repitela-{venue_id}-{int(time.time())}"`, `signature = sha256(reference + amount + "COP" + integrity_secret)`. Devuelve `{public_key, currency, amount_in_cents, reference, signature}`.
- **`POST /api/billing/wompi/webhook`** (público):
  1. Verificar firma: valores de `signature.properties` resueltos sobre `data` + `timestamp` + events_secret → SHA256; comparar con `signature.checksum` vía `hmac.compare_digest` → 403 si inválida.
  2. Solo `event == "transaction.updated"`; otros → 200.
  3. `venue_id` desde `reference`; referencia ajena → 200 (ignorar).
  4. `APPROVED` → `record_event(kind="payment", days=PLAN_DAYS, source="wompi", provider_ref=txn_id, raw_payload=json, status="approved")`. `DECLINED|VOIDED|ERROR` → mismo call con `status="declined"` (historial sin extensión, garantizado por A2). `PENDING` → 200 sin registrar.
  5. `IntegrityError` por índice único `(source, provider_ref)` → duplicado → 200 (idempotencia; Wompi reintenta 3 veces en 24h).
- Test nuevo `backend/tests/test_wompi_webhook.py`: aprobado extiende, duplicado no duplica, firma mala → 403, declined registra sin extender.

### B3. Resumen de ventas (`backend/app/routers/superadmin.py`)
- **`GET /api/superadmin/billing/summary`** (cualquier rol superadmin): ingresos por mes (12 meses, `SUM(amount_cents)` de `kind='payment' AND status='approved'` agrupado por `strftime('%Y-%m', created_at)`) + últimos 50 movimientos con JOIN a `venues` (nombre del bar).
- `GET/PATCH /settings` ya existen — sin cambios backend.

## Fase C — Frontend admin del bar: "Mi suscripción"

- Nueva vista `frontend/src/views/AdminSubscription.vue` + ruta `/:venueSlug/admin/suscripcion` (`meta.requiresAdmin`) + link en la sección de vistas de `AdminDashboard.vue` (~L696).
- Estilo suscripción de IA: badge de estado (Al día/Vencido/Suspendido, mismas clases/colores de `VenueBillingPanel`), días restantes en grande, período vigente desde→hasta, precio mensual, historial resumido.
- Botón **Pagar** → `GET /api/admin/billing/checkout` → `window.location.href = 'https://checkout.wompi.co/p/?' + new URLSearchParams({...,'signature:integrity': sig, 'redirect-url': location.origin + location.pathname})`.
- Retorno de Wompi (`?id=<txn>` en query): banner "Procesando tu pago…", refetch a los 5s + botón "Actualizar estado". Sin polling elaborado.
- Patrones existentes: fetch nativo, `auth.adminHeaders()`, componentes `ui/`, CSS scoped con variables, `Intl.NumberFormat('es-CO', COP)`.

## Fase D — Frontend superadmin: "Ventas y facturación"

- Nueva vista `frontend/src/views/SuperAdminSales.vue` + ruta `/superadmin/ventas` (`meta.requiresSuperAdmin`) + RouterLink "Ventas" en el header de `SuperAdminPanel.vue` (junto a "Usuarios", ~L76).
- Contenido (consume `GET /billing/summary` y `GET/PATCH /settings`):
  1. Ingresos por mes (cards, formato COP).
  2. Movimientos recientes: fecha, bar (link al detalle del venue), tipo/fuente/estado (badges como VenueBillingPanel), monto, período.
  3. Card "Ajustes de facturación": precio mensual (pesos ×100 al enviar), `trial_days`, `grace_period_days` → `PATCH /settings`; form visible solo para rol `super_admin`.
- No duplicar los KPIs/filtros que ya tiene `SuperAdminPanel.vue`.
- **`VenueBillingPanel.vue` (detalle por venue): sin cambios** — los pagos Wompi entran solos al historial con su badge; ya cubre suscripción, inicio, período y pagos.

## Extensibilidad a 2-3 planes (no construir hoy)

Los eventos ya guardan `amount_cents`/`days` por fila y `reference` no codifica plan. Único cuidado: `PLAN_DAYS` en un solo lugar. Multi-plan futuro = tabla `plans` + `plan_id` en checkout/webhook.

## Verificación end-to-end

1. `pytest backend/tests/` (test_billing extendido + test_wompi_webhook).
2. Webhook simulado local: payload firmado con python (`sha256` según `signature.properties`) + `curl -X POST localhost:8000/api/billing/wompi/webhook` → `paid_until` extendido, evento con badge Wompi en VenueBillingPanel; mismo curl repetido → sin duplicado; DECLINED → registra sin extender.
3. Sandbox Wompi real: llaves `pub_test_*` en `.env`, túnel (`cloudflared tunnel --url http://localhost:8000`), registrar URL de eventos en dashboard sandbox, pagar con tarjeta de prueba desde `/:slug/admin/suscripcion` → ciclo redirect → webhook → historial.
4. Superadmin: `/superadmin/ventas` refleja el pago en ingresos y movimientos; cambiar precio se refleja en el checkout del admin.

**Orden acordado**: 0 (rama+doc, ya hecho) → **C+D (frontend, para revisión)** → pausa de revisión con el usuario → A1→A2→A3 (fixes) → B1→B2 (Wompi backend) → B3 (summary) → verificación.
