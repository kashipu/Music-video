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

- **`GET /api/admin/billing`** (auth admin del bar): `{payment_status, paid_until, days_remaining, monthly_price_cents, history[]}` — últimos 12 eventos **aprobados** del venue (kind, status, amount_cents, period_start, period_end, created_at), excluyendo `status IN ('declined','pending')` — esos solo le sirven al superadmin para dar soporte, al dueño del bar solo le confunden. No exponer `created_by_username` ni `notes`.
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

## Fase E — Paywall: cobrar cuando venció la prueba

**Decidido**: el paywall se le muestra **solo al dueño del bar** (`/:slug/admin`), nunca al cliente que pide canciones — él no puede pagar la suscripción del bar. Período de gracia **3 días**. Estética inspirada en el landing.

**Depende de Fase B** (`GET /api/admin/billing` debe existir). El frontend puede maquetarse antes contra el mock, como se hizo con C/D.

### Estado actual (lo que hay que corregir)

| Estado | Hoy | Debe ser |
|---|---|---|
| En gracia (`overdue`) | Panel completo, **sin ningún aviso** | Banner persistente con días restantes + CTA pagar |
| Suspendido (`suspended`) | **Login bloqueado**, callejón sin salida | Login permitido → aterriza en el paywall y puede pagar |
| Suspendido con JWT vivo | Panel funciona **al 100%** hasta que expire el token | Bloqueado por el gate de backend |

Dos problemas de fondo: el dueño llega al día de la suspensión sin un solo aviso previo, y el bloqueo actual (`admin_auth.py:107-110`, mensaje *"Contacta al administrador"* — cuando él **es** el administrador) le impide llegar a pagar.

### E1. Gate real en backend (un solo punto)

`backend/app/routers/admin.py:26` `get_current_admin` — por ahí pasan los ~35 endpoints de `/api/admin` y hoy **solo valida el JWT, nunca consulta `venues`**. Ahí va la verificación:

- Consultar `paid_until` del venue → `compute_payment_status()` (movido a `billing_service` en A1).
- `suspended` → `HTTPException(402, detail={"code": "SUBSCRIPTION_REQUIRED", ...})`.
- `active`/`overdue` → pasa (la gracia sigue operando con normalidad).

**Exención obligatoria**: los endpoints de `billing.py` (`GET /api/admin/billing`, `/checkout`) NO pueden pasar por este gate, o el dueño quedaría sin forma de pagar. Como `billing.py` es archivo nuevo (B2), usa su propia dependencia de auth sin el check.

Sin este gate el paywall es solo una cortina de UI que se salta con devtools. Bloquear únicamente en el login deja pasar cualquier JWT ya emitido.

### E2. Login deja entrar al suspendido

`backend/app/routers/admin_auth.py:107-110`: hoy lanza 403 si `venues.active` es falso. Cambiar para que **el login funcione** y el frontend lo lleve al paywall. El bloqueo efectivo lo hace E1, no el login.

Ojo: `active = FALSE` también lo usa el superadmin para desactivar un bar a mano (`SuperAdminVenueConfig.vue`, zona de peligro). Distinguir ambos casos: bloqueo administrativo (sigue siendo 403 sin salida) vs. deuda (entra al paywall). El discriminante es `payment_status == 'suspended'`.

### E3. Frontend — banner + paywall

Nuevo `frontend/src/components/SubscriptionGate.vue`, consumido por `AdminDashboard.vue` (que hoy **nunca** consulta facturación):

- Un `GET /api/admin/billing` al montar. Según `payment_status`:
  - `active` → nada.
  - `overdue` → banner fijo arriba: "Tu suscripción venció. Te quedan N días antes de que se suspenda el servicio" + botón → `/:slug/admin/suscripcion`.
  - `suspended` → **paywall a pantalla completa** que tapa el panel.
- El paywall **no reimplementa el pago**: su CTA lleva a `AdminSubscription.vue`, que ya tiene el flujo Wompi completo (Fase C). Reusar de ahí `statusBadgeInfo`/`periodSubtitle` en vez de reescribirlos.
- Además, manejar el 402 de E1 en las llamadas del dashboard (hoy los errores se tragan en silencio con `if (!res.ok) return`) para que un token vivo caiga también en el paywall.

### E4. Estética tipo landing

El landing es Astro + Tailwind; el frontend es Vue con CSS plano — no hay Tailwind ni forma barata de traerlo. Lo que sí es barato:

- **Reusar `frontend/src/components/AuthSplitLayout.vue`**: ya porta el gradiente radial del landing a CSS plano y es full-screen centrado. Es el puente, no empezar de cero.
- Portar a `frontend/src/style.css` las 3 utilidades de firma del landing (`landing/src/styles/global.css:77-102`), ~10 líneas: `.text-gradient` (naranja→magenta→violeta), `.glass-card` (blur + borde translúcido), `.glow-sm`.
- Estructura visual copiada de `landing/src/components/Pricing.astro`: pill superior, título con `.text-gradient`, precio en número grande, lista de beneficios con check verde, CTA en gradiente.
- **El monto sale de `monthly_price_cents`** (backend), nunca del copy: el landing tiene `$50.000` hardcodeado en `Pricing.astro:47` y `CTAFinal.astro:23` — si el precio real difiere, ese copy queda desincronizado (vale revisarlo aparte).
- Opcional barato: `@font-face` de Plus Jakarta Sans (los `.woff2` ya están en `landing/src/assets/fonts/`) — el frontend hoy solo usa Inter y ni siquiera la auto-hospeda. Es la mayor diferencia visual restante; si se salta, los títulos se ven con otra tipografía que el landing.

### E5. Gracia = 3 días

No es código: `grace_period_days` ya es configurable y tiene UI en `/superadmin/ventas` (Fase D). Ponerlo en 3 ahí. El frontend **no** hardcodea el 3 — se guía por el `payment_status` que deriva el backend, así respeta el valor configurado. Requiere A3 (hoy `auth_service.py:47` ignora el ajuste y usa 5 hardcodeado).

### Fuera de alcance (decidido)

La vista del cliente del bar (`/:slug/usuario`, `/:slug/registro`) queda como está: sigue mostrando el error inline *"Este bar no esta disponible en este momento"*. Mejora barata si se quiere después: `GET /api/auth/venue-info` **ya devuelve `active`** y `QRLanding.vue:37-43` lo ignora — bloquear ahí evitaría que el cliente llene el formulario para nada.

### Verificación de Fase E

1. Venue con `paid_until` de hace 1 día → login OK, banner de gracia con días correctos, panel operativo.
2. Venue con `paid_until` de hace 5 días (gracia 3 agotada) → login OK, paywall a pantalla completa, CTA lleva a `/suscripcion`.
3. Con ese venue suspendido: `curl` a cualquier `/api/admin/*` con JWT válido → 402; `GET /api/admin/billing` y `/checkout` → 200 (exención).
4. Pagar (sandbox Wompi) → `record_event` reactiva → recargar → panel completo sin banner.
5. Bar desactivado a mano por superadmin (no por deuda) → sigue dando 403 en login, no paywall.

## Extensibilidad a 2-3 planes (no construir hoy)

Los eventos ya guardan `amount_cents`/`days` por fila y `reference` no codifica plan. Único cuidado: `PLAN_DAYS` en un solo lugar. Multi-plan futuro = tabla `plans` + `plan_id` en checkout/webhook.

## Verificación end-to-end

1. `pytest backend/tests/` (test_billing extendido + test_wompi_webhook).
2. Webhook simulado local: payload firmado con python (`sha256` según `signature.properties`) + `curl -X POST localhost:8000/api/billing/wompi/webhook` → `paid_until` extendido, evento con badge Wompi en VenueBillingPanel; mismo curl repetido → sin duplicado; DECLINED → registra sin extender.
3. Sandbox Wompi real: llaves `pub_test_*` en `.env`, túnel (`cloudflared tunnel --url http://localhost:8000`), registrar URL de eventos en dashboard sandbox, pagar con tarjeta de prueba desde `/:slug/admin/suscripcion` → ciclo redirect → webhook → historial.
4. Superadmin: `/superadmin/ventas` refleja el pago en ingresos y movimientos; cambiar precio se refleja en el checkout del admin.

**Orden acordado**: 0 (rama+doc, ya hecho) → **C+D (frontend, ya hecho y revisado)** → A1→A2→A3 (fixes) → B1→B2 (Wompi backend) → B3 (summary) → **E (paywall, depende de B)** → verificación.
