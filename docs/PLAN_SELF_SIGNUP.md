# Plan: Registro autogestionado de admins (trial 15 días + Google + legal Colombia)

## Contexto

Referencia visual: pantalla de registro de Alegra (email + password, "gratis por 15 días", código promocional, "Regístrate con Google"). Hoy Repitela no tiene autoregistro — los admins de bar los crea el super admin manualmente (`SuperAdminPanel.vue` → `POST /api/superadmin/venues`).

**Hallazgo clave: el trial NO es lógica nueva.** `venues.paid_until` + `compute_payment_status()` (`backend/app/routers/superadmin.py:14-27`) ya implementan "activo / overdue / suspended" con `GRACE_PERIOD_DAYS = 5` (hoy hardcodeado como constante Python), y `auth_service.py` ya lee `paid_until` para auto-suspender venues vencidos. Un signup con trial de 15 días es solo: crear venue+admin y setear `paid_until = hoy + N` días. La tabla `users` (clientes del bar) ya tiene precedente de `data_consent BOOLEAN` — mismo patrón a replicar en `admins`.

**Ajuste pedido por el usuario:** ni la duración del trial (15 días) ni el período de gracia (`GRACE_PERIOD_DAYS`) quedan hardcodeados en código — se vuelven parametrizables desde el panel de super admin (ver Fase A/B/C).

Decisiones ya tomadas en conversación previa (no se re-abren acá):
- Sin Firebase/Supabase — se mantiene SQLite + JWT propio.
- Google Sign-In directo vía Google Identity Services + librería `google-auth`, no vía un BaaS.
- Email transaccional: **Brevo** (free tier ~9000/mes, cubre transaccional + futuras campañas de promos).

## Restricciones

- Rama nueva, nunca directo sobre `main` (push a `main` = deploy a producción).
- Reusa los átomos del design system (`components/ui/Button.vue`, `Input.vue`, `AuthSplitLayout.vue` de Fase 3a) una vez que el Task de Codex en curso los entregue — cero CSS nuevo redundante.
- Nada de este plan toca datos de producción — son migraciones de schema + endpoints nuevos, sin scripts sobre la DB en vivo.
- La rama dedicada (`feature/self-signup`) se crea **después** de que termine el Task de login en curso (para no interrumpir a Codex mientras edita el mismo worktree). Este documento se commitea ahora en la rama actual porque es un archivo nuevo aislado, no toca nada que Codex esté editando.

## Fase A — Modelo de datos

Nueva migración SQL (`backend/app/db/migrations/0XX_admin_selfsignup.sql`):

- `admins`: agregar `email TEXT UNIQUE`, `email_verified BOOLEAN NOT NULL DEFAULT FALSE`, `google_sub TEXT UNIQUE NULL`, `terms_accepted_at TIMESTAMP NULL`, `terms_version TEXT NULL`, `privacy_accepted_at TIMESTAMP NULL`. Todo nullable/default para no romper admins ya creados por el super admin (login usuario/password sigue funcionando igual).
- Nueva tabla `email_tokens`: `id, admin_id, token_hash, purpose ('verify'|'reset'), expires_at, used_at, created_at` — un solo uso, hash del token (no texto plano), expiración corta (verify: 24h, reset: 1h).
- Nueva tabla `platform_settings` (fila única, id=1): `trial_days INTEGER NOT NULL DEFAULT 15`, `grace_period_days INTEGER NOT NULL DEFAULT 5`. Reemplaza la constante `GRACE_PERIOD_DAYS = 5` de `superadmin.py` — `compute_payment_status()` pasa a leer `grace_period_days` de esta fila en vez de la constante Python (fallback a 5 si la fila no existe todavía, por retrocompatibilidad).
- Trial: al crear el venue en el signup, `paid_until = date.today() + timedelta(days=<trial_days de platform_settings>)`.
- Código promocional: el campo se acepta y se guarda en el signup (columna `promo_code_used` en `venues` o `admins`), pero la lógica de descuentos/referidos queda **fuera de esta fase** — es un sistema aparte (`promo_codes`, `referrals`) que se planea después.
- **Migración 013 ya está commiteada** (Fase A cerrada) — los campos de onboarding (ver Fase B2) van en una migración nueva y posterior (`0XX_admin_onboarding.sql`), no se reabre la 013.

## Fase B — Backend: módulo de autenticación de admins (separado del dashboard y de superadmin)

**Por qué un módulo nuevo:** `routers/admin.py` (893 líneas) ya mezcla el login de admin con toda la lógica autenticada del dashboard (queue/playback/analytics) — sumarle signup/verify/reset/Google encima repetiría el mismo problema de monolito que se está resolviendo en el frontend, ahora en el backend. `routers/superadmin.py` es gestión de plataforma (venues, config), no autenticación — solo debe ganar el endpoint de `settings`, nada de signup. Se separa en un módulo nuevo dedicado a auth de admin, mismo patrón que ya existe (`auth.py` = auth de clientes de bar).

### Módulos y responsabilidad de cada archivo

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `routers/admin_auth.py` (nuevo) | Endpoints HTTP: `login`, `signup`, `verify-email`, `forgot-password`, `reset-password`, `google-signup`. Prefix `/api/admin` — mismas URLs de siempre, solo cambia en qué archivo Python viven. Router delgado: valida input, llama al service, arma la respuesta — nada de lógica de negocio acá. | Crear |
| `routers/admin.py` | Pierde el endpoint `login` (se **extrae**, no se duplica — moverlo, no reimplementarlo). Queda solo con las acciones ya autenticadas del dashboard. | Modificar |
| `routers/superadmin.py` | Solo gana `GET/PATCH /api/superadmin/settings` (trial_days/grace_period_days) — ya asignado a Codex por separado. Nada de signup entra acá. | Ya en curso |
| `services/admin_signup_service.py` (nuevo) | Lógica de negocio del self-signup: crear `venues`+`admins`+trial en una transacción, generar/validar filas de `email_tokens`, vincular cuenta por `google_sub`/email. Llama a `auth_service.py` para tokens JWT y a `email_service.py` (Fase D) para disparar los emails. No reimplementa nada que ya exista en `auth_service.py`. | Crear |
| `services/auth_service.py` | **Sin cambios de responsabilidad** — sigue siendo las primitivas de token/sesión/password ya existentes (`create_admin_token`, `decode_token`, `verify_admin`, patrón bcrypt). `admin_signup_service.py` las reusa. | Reusar tal cual |
| `services/email_service.py` (Fase D) | Wrapper de Brevo. `admin_signup_service.py` lo llama para verify/welcome/reset. | Crear (Fase D) |
| `main.py` | Registrar el router nuevo: agregar `admin_auth` al import de `app.routers` y `app.include_router(admin_auth.router)`. | Modificar (una línea) |

**No sobre-modularizar:** la verificación del ID token de Google es 2-3 líneas con `google-auth` (`verify_oauth2_token`) — vive directo dentro de `admin_signup_service.py`, no se le crea un archivo propio para una sola función.

### Endpoints

- `GET/PATCH /api/superadmin/settings` → `superadmin.py` (ya asignado, sin cambios acá).
- `POST /api/admin/login` → `admin_auth.py`, extraído de `admin.py` — verificar después de moverlo que el login del admin sigue funcionando igual (regresión, no cambia comportamiento).
- `POST /api/admin/signup` → `admin_auth.py` llama a `admin_signup_service.create_admin_with_trial(...)`: crea venue+admin (slug auto-generado), hashea password con `bcrypt`, setea `paid_until` trial leyendo `trial_days` de `platform_settings` (no un número fijo) + `terms_accepted_at`/`terms_version`, genera token de verificación y dispara email (Fase D). No loguea automático hasta verificar email (Fase F).
- `POST /api/admin/verify-email` → consume el token de `email_tokens`, marca `email_verified = TRUE`.
- `POST /api/admin/forgot-password` → genera token de reset, dispara email. Respuesta genérica siempre ("si el correo existe, te enviamos instrucciones") — no revela si el email existe (Fase F).
- `POST /api/admin/reset-password` → consume token, actualiza `password_hash`.
- `POST /api/admin/google-signup` → verifica el ID token de Google (`aud`=client id propio, `iss`=`accounts.google.com`), busca por `google_sub` o `email`; si no existe, crea venue+admin igual que el signup normal (trial incluido) con `email_verified = TRUE` automático.
- Rate limiting en los endpoints de `admin_auth.py` (mismo mecanismo que ya exista para `/api/auth/register` de clientes de bar — confirmar y reusar, no inventar uno nuevo).

## Fase B2 — Onboarding post-signup (representante + datos del bar)

Signup (email/password o Google) solo crea la cuenta con trial — **no alcanza** para operar: falta saber quién es el representante del bar y datos básicos del local. Es un paso obligatorio después de crear cuenta, antes de llegar al dashboard — aplica igual si el signup fue por Google (Google no entrega teléfono/cargo/dirección/temática).

**Por qué es un endpoint aparte de `admin_auth.py`:** el onboarding ocurre con el admin ya autenticado (tiene su JWT recién emitido por signup/google-signup) — es una acción autenticada, no un flujo de identidad. Va en `routers/admin.py` (dashboard), no en `admin_auth.py` (que es solo login/signup/reset, sin sesión todavía).

### Modelo de datos (migración nueva, después de la 013)

- `admins`: agregar `full_name TEXT NULL` (no existe hoy — hoy solo hay `username`/`password_hash`), `phone TEXT NULL`, `role TEXT NULL CHECK (role IN ('owner', 'manager'))` — dueño vs administrador, dato pedido explícitamente por el usuario.
- `venues`: agregar `address TEXT NULL`, `address_lat REAL NULL`, `address_lng REAL NULL` (poblados solo si se usa el autocomplete de Google Maps — ver abajo), `venue_type TEXT NULL CHECK (venue_type IN ('discoteca', 'rock', 'musica_popular', 'otro'))`, `venue_type_other TEXT NULL` (solo cuando `venue_type = 'otro'`).
- `admins.onboarding_completed_at TIMESTAMP NULL` — gate explícito: si es `NULL`, el frontend redirige a onboarding en vez de al dashboard (mismo patrón que `email_verified` ya usa para gatear el login).

### Endpoint

- `POST /api/admin/onboarding` (`admin.py`, autenticado con el JWT de admin) — recibe `full_name`, `phone`, `role`, `venue_address`, `venue_type` (+ `venue_type_other` si aplica), actualiza `admins`/`venues`, setea `onboarding_completed_at = now()`.

### Dirección con Google Maps — investigado, costo no es un problema a esta escala

Google Places Autocomplete (New) + Geocoding: Geocoding tiene 10,000 llamadas gratis/mes, Autocomplete cobra $17 por 1,000 sesiones completas después del free tier. Con el volumen de altas de bar que va a tener Repitela (decenas/mes, no miles), el costo real es de centavos al mes — no es un motivo para evitarlo. Se usa como mejora de UX (autocompletar + guardar lat/lng), con **texto libre como fallback** si no está configurada la API key todavía — no debe bloquear el onboarding.

### Frontend

- Nueva vista `views/AdminOnboarding.vue`, mismo lenguaje visual que el signup (`AuthSplitLayout`/card). Campos: nombre completo, teléfono, cargo (radio/select: Dueño / Administrador), nombre del bar (ya viene del signup, mostrar no editable o editable), dirección (input con Google Places Autocomplete si hay API key configurada, si no input de texto simple), temática (select: Discoteca / Rock / Música popular / Otro, con campo de texto si es "Otro").
- Router guard: si `onboarding_completed_at` es `NULL` tras loguear, redirigir acá en vez de al dashboard del bar.

## Fase C — Frontend

- Nueva vista `views/AdminSignup.vue`, compone `AuthSplitLayout` (Fase 3a) con nuevo `components/AuthSignupForm.vue`: email, password (con toggle mostrar/ocultar), texto "Repitela es gratis por **{{ trial_days }} días**" (leído del endpoint de settings, no hardcodeado en el template), checkbox de términos + habeas data (link a la política, Fase E) obligatorio para habilitar el botón, "Crear cuenta", link colapsable "¿Tienes un código promocional?", separador, botón "Regístrate con Google". Todo con los átomos `Button`/`Input` ya existentes, sin CSS nuevo.
- `views/VerifyEmail.vue` y `views/ResetPassword.vue` — pantallas cortas que consumen el token de la URL y llaman a los endpoints de la Fase B.
- `SuperAdminPanel.vue`: nueva sección/tab "Configuración" con dos campos numéricos (`trial_days`, `grace_period_days`) contra `GET/PATCH /api/superadmin/settings` — así se cambian sin tocar código ni redesplegar.

## Fase D — Email (Brevo)

- Cuenta Brevo, plan free.
- `backend/app/services/email_service.py` — wrapper delgado sobre la API REST de Brevo vía `httpx` (ya es dependencia, sin SDK nuevo).
- 3 templates: verificación de cuenta, bienvenida (con resumen del trial), reset de contraseña.

## Fase E — Legal (Colombia — Ley 1581 de 2012, Habeas Data)

- **Obligatorio:** publicar una Política de Tratamiento de Datos Personales (página estática en `landing/` o `frontend/`) — la ley exige tenerla publicada, no alcanza con el checkbox solo.
- **Obligatorio:** autorización informada y expresa antes de recolectar datos — el checkbox del signup + guardar `terms_accepted_at`/`terms_version` (Fase A) es exactamente ese registro de autorización.
- **No aplica todavía:** registro ante el RNBD (Registro Nacional de Bases de Datos, Decreto 886/2014) — solo es obligatorio manejando datos de más de 100.000 titulares; Repitela está muy por debajo de esa escala.
- **No aplica:** autorización especial para datos sensibles (Decreto 1377/2013) — el signup de admins no recolecta categorías sensibles (salud, biometría, etc.), solo email/nombre/password.
- Marco normativo citado: Ley 1581 de 2012, Decreto 1377 de 2013, Decreto 886 de 2014.

## Fase F — Seguridad

- Passwords: `bcrypt` (ya en uso, reusar el mismo helper que `superadmin.py`/`auth_service.py`).
- Tokens de verify/reset: `secrets.token_urlsafe`, hasheados en DB, un solo uso, expiración corta.
- Rate limiting en signup/forgot-password (mitiga spam de cuentas y enumeración de emails).
- `forgot-password` nunca revela si el email existe o no (mensaje genérico siempre).
- Login bloqueado hasta `email_verified = TRUE` (evita cuentas fantasma).
- Verificación estricta del ID token de Google (`aud`/`iss`), no solo la firma.
- Confirmar que Dokploy sirve todo por HTTPS antes de exponer estos endpoints (no asumir).

## Verificación (al implementar)

- Login de admin existente sigue funcionando igual después de moverlo a `admin_auth.py` (regresión — misma URL, mismo comportamiento, ningún admin actual se ve afectado).
- Signup completo end-to-end en dev: crear cuenta → recibir email real (Brevo) → verificar → loguear → ver el bar con `paid_until` = hoy+15 en el panel de superadmin.
- Simular vencimiento del trial (setear `paid_until` en el pasado) y confirmar que `compute_payment_status` ya existente lo marca `overdue`/`suspended` sin cambios adicionales.
- Google Sign-In probado con una cuenta real de Google en dev.
- Revisar que la Política de Tratamiento esté efectivamente publicada y enlazada desde el checkbox antes de considerar la Fase E cerrada.
