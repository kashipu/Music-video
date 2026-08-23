# Plan: Registro autogestionado de admins (trial 15 días + Google + legal Colombia)

## Contexto

Referencia visual: pantalla de registro de Alegra (email + password, "gratis por 15 días", código promocional, "Regístrate con Google"). Hoy Repitela no tiene autoregistro — los admins de bar los crea el super admin manualmente (`SuperAdminPanel.vue` → `POST /api/superadmin/venues`).

**Hallazgo clave: el trial NO es lógica nueva.** `venues.paid_until` + `compute_payment_status()` (`backend/app/routers/superadmin.py:14-27`) ya implementan "activo / overdue / suspended" con `GRACE_PERIOD_DAYS = 5`, y `auth_service.py` ya lee `paid_until` para auto-suspender venues vencidos. Un signup con trial de 15 días es solo: crear venue+admin y setear `paid_until = hoy + 15`. La tabla `users` (clientes del bar) ya tiene precedente de `data_consent BOOLEAN` — mismo patrón a replicar en `admins`.

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
- Trial: al crear el venue en el signup, `paid_until = date.today() + timedelta(days=15)` — reusa `compute_payment_status`/`GRACE_PERIOD_DAYS` ya existentes, sin tocar esa lógica.
- Código promocional: el campo se acepta y se guarda en el signup (columna `promo_code_used` en `venues` o `admins`), pero la lógica de descuentos/referidos queda **fuera de esta fase** — es un sistema aparte (`promo_codes`, `referrals`) que se planea después.

## Fase B — Backend: endpoints

- `POST /api/admin/signup` — crea `venues` + `admins` en una transacción (slug auto-generado del nombre del bar), hashea password con `bcrypt` (ya en `requirements.txt`), setea `paid_until` trial + `terms_accepted_at`/`terms_version`, genera token de verificación y dispara email (Fase D). No loguea automático hasta verificar email (Fase F).
- `POST /api/admin/verify-email` — consume el token de `email_tokens`, marca `email_verified = TRUE`.
- `POST /api/admin/forgot-password` — genera token de reset, dispara email. Respuesta genérica siempre ("si el correo existe, te enviamos instrucciones") — no revela si el email existe (Fase F).
- `POST /api/admin/reset-password` — consume token, actualiza `password_hash`.
- `POST /api/admin/google-signup` — recibe el ID token de Google, lo verifica con `google-auth` (`verify_oauth2_token`, chequeando `aud`=client id propio e `iss`=`accounts.google.com`), busca por `google_sub` o `email`; si no existe, crea venue+admin igual que el signup normal (trial incluido) con `email_verified = TRUE` automático.
- Rate limiting en los 4 endpoints (mismo mecanismo que ya exista para `/api/auth/register` de clientes de bar — confirmar y reusar, no inventar uno nuevo).

## Fase C — Frontend

- Nueva vista `views/AdminSignup.vue`, compone `AuthSplitLayout` (Fase 3a) con nuevo `components/AuthSignupForm.vue`: email, password (con toggle mostrar/ocultar), texto "Repitela es gratis por 15 días", checkbox de términos + habeas data (link a la política, Fase E) obligatorio para habilitar el botón, "Crear cuenta", link colapsable "¿Tienes un código promocional?", separador, botón "Regístrate con Google". Todo con los átomos `Button`/`Input` ya existentes, sin CSS nuevo.
- `views/VerifyEmail.vue` y `views/ResetPassword.vue` — pantallas cortas que consumen el token de la URL y llaman a los endpoints de la Fase B.

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

- Signup completo end-to-end en dev: crear cuenta → recibir email real (Brevo) → verificar → loguear → ver el bar con `paid_until` = hoy+15 en el panel de superadmin.
- Simular vencimiento del trial (setear `paid_until` en el pasado) y confirmar que `compute_payment_status` ya existente lo marca `overdue`/`suspended` sin cambios adicionales.
- Google Sign-In probado con una cuenta real de Google en dev.
- Revisar que la Política de Tratamiento esté efectivamente publicada y enlazada desde el checkbox antes de considerar la Fase E cerrada.
