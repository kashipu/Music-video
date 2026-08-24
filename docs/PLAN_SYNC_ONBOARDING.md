# Plan: sincronizar alta autogestionada y alta manual (super admin)

> Rama `kashipu/superadmin-fase4`. Solo plan — no implementar hasta que se pida explícito.

## Contexto

Hoy existen **dos caminos independientes** para que nazca un bar nuevo, con datos y
defaults que ya divergen:

1. **Autogestionado** (`/admin/signup`, `AdminSignup.vue` + `admin_signup_service.py`):
   el dueño del bar se da de alta solo (email+password o Google). Pide: nombre del
   bar, email, password, aceptación de términos. Crea venue **sin** `config` (queda
   `'{}'`) y **sin** `logo_url`/`qr_url`. El trial sale de
   `platform_settings.trial_days` (hoy 15).
2. **Manual** (`/superadmin/crear-bar`, `SuperAdminCreateVenue.vue`, recién construido):
   un vendedor/super admin da de alta el bar por otra persona. Pide: nombre, slug,
   usuario admin (string arbitrario, no email), password, logo, QR, duración máx.
   (min), canciones por ventana (default 3), ventana (default 20 min), y tiempo de
   prueba elegido (7/15/30 días → `paid_until`).

**La divergencia real hoy:** el autogestionado nunca fija `config`, así que sus 3
límites de cola salen de `settings.max_songs_per_window=5` / `settings.window_minutes=20`
(global, `config.py`) — el manual acaba de fijar 3/20 explícito en cada venue. Un bar
autogestionado y uno creado por un vendedor el mismo día pueden terminar con límites
de cola distintos sin que nadie lo haya decidido así.

## Qué pide el usuario, concreto

1. En `/superadmin/crear-bar`: **logo y QR dejan de ser necesarios** (bajarles
   prioridad/quitarlos de lo que se le exige a un vendedor) — esto además alinea el
   formulario manual con el autogestionado, que nunca los pidió. Los 3 límites de
   cola (duración máx., canciones por ventana, ventana) **sí se quedan**, pero hoy
   son 3 números sueltos sin explicación — agregar un texto corto por campo
   explicando qué controla cada uno.
2. Al crear un bar (en cualquiera de los dos caminos) se debe pedir **email,
   teléfono, dirección y ciudad** de la persona que administrará ese bar (hoy el
   camino manual ni siquiera pide email — usa un `admin_username` de texto libre).
3. Los bares **autogestionados** tienen trial de **15 días** (ya es así vía
   `platform_settings.trial_days`, no cambia).
4. Nueva capacidad: desde la ventana del super admin (`SuperAdminVenueDetail.vue`),
   **extender el trial** de un bar existente +7 / +15 / +30 días.
5. Las dos vías deben quedar sincronizadas — mismos campos de contacto, mismos
   defaults de cola, incluso si el flujo de captura es distinto (self-service vs.
   formulario del vendedor).

## Cambios de datos

### `admins` (nueva migración `019_admin_contact.sql`)
```sql
ALTER TABLE admins ADD COLUMN phone TEXT;
ALTER TABLE admins ADD COLUMN address TEXT;
ALTER TABLE admins ADD COLUMN city TEXT;
```
Nullable (mismo patrón que `email` en su momento) — no rompe admins ya creados sin
estos datos. `email` ya existe en `admins` desde la migración 013, se reusa tal cual.

**Decisión a confirmar con el usuario antes de implementar:** el camino manual hoy
usa `admin_username` (string libre) como login, mientras que el autogestionado usa
el email como username. Sincronizar del todo implicaría que el admin creado
manualmente también inicie sesión con su email. Alternativas:
- (A) Mantener `admin_username` como está y agregar `email` como dato de contacto
  aparte (más simple, cero riesgo de romper logins existentes).
- (B) Unificar: `admin_username` pasa a ser siempre el email (requiere validar que
  no rompe nada del lado de `auth_service`/login del admin de bar).
Recomiendo (A) por menor riesgo — el email queda como dato de contacto, no como
credencial, en el camino manual.

### `venues.config` — sincronizar defaults
El autogestionado deja de confiar en el fallback global (`settings.py`) y fija
`config` explícito al crear, igual que el manual: `max_duration_sec=600`,
`max_songs_per_window=3`, `window_minutes=20` (o el valor que el vendedor haya
elegido, en el camino manual). Así los dos caminos parten del mismo lugar y un
cambio futuro de default no depende de dos sitios (`config.py` vs. el formulario).

### Extensión de trial
Reusa el patrón de `mark_venue_paid` (extiende desde `paid_until` si sigue en el
futuro, si no desde hoy) pero sumando días sueltos (7/15/30) en vez de meses. Nuevo
endpoint, p. ej. `POST /api/superadmin/venues/{venue_id}/extend-trial` con
`{"days": 7|15|30}` → recalcula `paid_until`. Mismo gate de rol que `mark-paid`
(`require_role("super_admin")`) por ser una acción financiera/de trial, salvo que el
usuario indique lo contrario.

## Cambios de código (para cuando se implemente)

**Backend:**
- `admin_signup_service.create_admin_with_trial`: agregar parámetros
  `phone`, `address`, `city`; incluir en el INSERT de `admins`; fijar `config`
  explícito en el INSERT de `venues` (los 3 defaults sincronizados).
- `admin_auth.py` (signup manual y Google): los request models
  (`AdminSignupRequest`, `GoogleSignupRequest`) ganan `phone`, `address`, `city`
  (requeridos).
- `superadmin.py`: `CreateVenueRequest` gana `admin_email`, `admin_phone`,
  `admin_address`, `admin_city` (requeridos); el INSERT de `admins` en
  `create_venue` los incluye. Nuevo endpoint `extend-trial` descrito arriba.

**Frontend:**
- `AdminSignup.vue`: 3 inputs nuevos (teléfono, dirección, ciudad), mismo patrón
  que el email actual, en ambos submits (manual y Google).
- `SuperAdminCreateVenue.vue`: quitar/bajar de prioridad logo+QR de la sección
  "Datos del bar" (o moverlos a "opcional, se puede completar después desde el
  detalle"); agregar email/teléfono/dirección/ciudad del admin; agregar un texto
  corto de ayuda bajo cada uno de los 3 límites de cola (ej. "Duración máx.: cuánto
  puede durar cada canción que se reproduce", "Canciones por ventana: cuántas
  canciones puede pedir un mismo usuario dentro de la ventana de tiempo",
  "Ventana: cada cuántos minutos se reinicia ese límite").
- `SuperAdminVenueDetail.vue`: nueva acción "Extender trial" con 3 botones
  (+7 / +15 / +30 días) junto a la acción de marcar como pagado que ya existe.

## Fases sugeridas (cada una una Task independiente)

1. Migración `admins` (phone/address/city) + sincronizar `config` explícito en
   ambos caminos de creación.
2. Backend: campos de contacto en signup manual/Google + en `create_venue` del
   super admin.
3. Backend + Frontend: endpoint y botón de "Extender trial".
4. Frontend: formulario de `AdminSignup.vue` con los 3 campos nuevos.
5. Frontend: `SuperAdminCreateVenue.vue` — quitar énfasis de logo/QR, agregar
   contacto del admin, agregar textos de ayuda en los 3 límites de cola.

## Verificación (cuando se implemente)

- Crear un bar por cada camino el mismo día y confirmar que ambos quedan con los
  mismos 3 límites de cola en `venues.config`.
- Crear un bar manual sin completar logo/QR y confirmar que no bloquea la creación.
- Extender el trial de un bar vencido y de uno vigente, confirmar que la fecha
  resultante es la esperada en ambos casos (igual que `mark-paid` ya hace con
  meses).
