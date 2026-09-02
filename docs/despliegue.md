# Despliegue

> **Índice:** [[README]] · **Autoridad sobre:** cómo se despliega y se respalda · **Últ. cambio:** 2026-09-02
> Si esta página contradice al código, gana el código y esta página tiene un bug.

Repitela se despliega en producción con **Dokploy** y el `docker-compose.yml` de la raíz. Un push a `main` dispara el despliegue automático de producción. El compose declara tres servicios internos: `backend`, `frontend` y `landing` (`docker-compose.yml:1-64`). Dokploy/Traefik publica los dominios; los contenedores usan `expose`, no `ports`.

> **Crítico: configure `APP_SECRET_KEY` antes del primer deploy.** Con `APP_ENV=production`, el backend se detiene si la clave está vacía, conserva el valor por defecto o tiene menos de 32 caracteres (`backend/app/config.py:43-51`). Genérela, por ejemplo, con `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

## Servicios

| Servicio | Imagen construida | Puerto interno | Función |
|---|---|---:|---|
| `backend` | `backend/Dockerfile` | 8000 | API FastAPI y WebSocket; persiste SQLite en el volumen `sqlite_data`. |
| `frontend` | `frontend/Dockerfile` | 80 | Aplicación Vue; nginx envía `/api` y `/ws` al backend. |
| `landing` | `landing/Dockerfile` | 80 | Landing Astro estática. |

El enrutamiento externo debe asociar `app.repitela.com` al servicio `frontend`; `repitela.com` (y el dominio de landing configurado en Dokploy) al servicio `landing`. No exponga el backend directamente: el proxy del frontend es la ruta prevista para API y WebSocket (`frontend/nginx.conf`).

## Variables de entorno

Defínalas en Dokploy para el servicio Compose. Los valores vacíos indicados abajo son valores que el compose permite, no valores recomendados para producción.

```env
# Obligatorias para arrancar en producción
APP_ENV=production
APP_SECRET_KEY=<cadena-aleatoria-de-64-o-mas-caracteres>

# Persistencia
DATABASE_PATH=/data/barqueue.db
# Aviso temprano antes del límite práctico de SQLite (~500 MB)
DB_SIZE_ALERT_THRESHOLD_BYTES=419430400

# Integraciones y autenticación
YOUTUBE_API_KEY=
GOOGLE_CLIENT_ID=
TURNSTILE_SECRET_KEY=
TURNSTILE_HOSTNAMES=app.repitela.com
BREVO_API_KEY=
EMAIL_FROM=no-reply@repitela.com
FRONTEND_URL=https://app.repitela.com

# Red y límites
CORS_ORIGINS=https://app.repitela.com
MAX_SONGS_PER_WINDOW=5
WINDOW_MINUTES=30
JWT_EXPIRATION_HOURS=24
JWT_ADMIN_EXPIRATION_HOURS=8

# Cobros Wompi
WOMPI_PUBLIC_KEY=
WOMPI_INTEGRITY_SECRET=
WOMPI_EVENTS_SECRET=

# Sesiones
SESSION_INACTIVITY_MINUTES=120
SESSION_MAX_HOURS=24
```

`GOOGLE_CLIENT_ID`, Turnstile, Brevo, URLs, Wompi y los límites de sesión están definidos por `Settings` (`backend/app/config.py:4-33`). Sin las tres llaves de Wompi el checkout responde `503`; sin `BREVO_API_KEY` no se envían correos, aunque el enlace queda registrado por el backend (`docker-compose.yml:14-32`). `TURNSTILE_HOSTNAMES` en producción no debe incluir `localhost`.

`DB_SIZE_ALERT_THRESHOLD_BYTES` tiene por defecto `419430400` (400 MiB): deja margen antes del límite práctico aproximado de 500 MB. El backend revisa el archivo SQLite al iniciar y luego cada hora, y envía un correo a los superadmins con email configurado cuando cruza el umbral.

> **PENDIENTE — configuración de sesiones:** `SESSION_INACTIVITY_MINUTES` y `SESSION_MAX_HOURS` existen en `Settings`, pero el `docker-compose.yml` actual no los pasa al contenedor. Añadirlas al bloque `backend.environment` es necesario para que un valor definido en Dokploy tenga efecto.

El build del frontend recibe variables públicas distintas de las del backend:

```env
VITE_GOOGLE_CLIENT_ID=
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAEZ0hYgY2o1yd8oe
```

No defina `VITE_API_URL` ni `VITE_WS_URL`: nginx resuelve ambas rutas contra `backend` dentro de Compose. El Dockerfile usa `node:22-alpine`, recibe solo los dos argumentos anteriores y eleva `worker_connections` de nginx a 8192 (`frontend/Dockerfile:1-23`).

## Runtime del backend

El comando de producción es:

```text
gunicorn app.main:app -w 1 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --forwarded-allow-ips * --access-logfile -
```

No suba `-w` por encima de 1. El gestor de conexiones WebSocket vive en memoria: con varios procesos, cada broadcast solo alcanza a los clientes del proceso que lo emitió. Un único worker también evita contención de escritura entre procesos SQLite. `--forwarded-allow-ips *` hace que Uvicorn respete las cabeceras del proxy interno; sin ello, el rate limit vería la IP de nginx como todos los clientes (`backend/Dockerfile:14-23`).

El healthcheck ejecuta Python/`urllib` contra `http://localhost:8000/api/health` cada 300 s, con timeout de 10 s, tres reintentos y 30 s de espera inicial (`docker-compose.yml:37-44`). No depende de `curl` ni corre cada 30 s.

## Operación en Dokploy

1. Cree un proyecto Docker Compose conectado al repositorio y apúntelo a `docker-compose.yml`.
2. Configure las variables anteriores y los dominios de `frontend` y `landing` en Dokploy/Traefik.
3. Haga push a `main`; Dokploy construye los tres servicios y redepliega producción.
   **Cualquier commit dispara la reconstrucción completa, incluso uno que solo
   toque `.md`**, en la misma máquina que está sirviendo a los bares. Agrupe los
   cambios de documentación en una rama y mézclelos cuando toque desplegar algo
   de verdad.
4. Compruebe `https://app.repitela.com/api/health` y abra una ruta de la app para verificar el proxy WebSocket.

Para desarrollo local, vea [DEV_LOCAL_SETUP.md](entorno-local.md). No copie aquí un compose alterno: el archivo raíz es la fuente de verdad del despliegue.

## Staging

Montado el 2026-09-02. Es un **Environment del mismo proyecto** en Dokploy, no un
proyecto aparte: la v0.30 ya tiene Environments. Los *Preview Deployments*, que
serían la solución evidente, **no funcionan en proyectos Docker Compose** y este
lo es.

| | |
|---|---|
| Rama | `staging` |
| Compose | `Monorepo Staging`, `appName` `compose-program-wireless-alarm-ijzhz4` |
| `st.repitela.com` | servicio **landing** |
| `stapp.repitela.com` | servicio **frontend** (la app) |
| Auto-deploy | **apagado**, a propósito |
| Volumen | propio, separado del de producción |

**El auto-deploy está apagado porque sus builds compiten con los bares.** El
servidor es de 2 vCPU / 1 GB compartido y construye producción encima; un deploy
de staging en horario de bar degrada el servicio real. Se despliega a mano.

Staging **no lleva ninguna credencial de producción**: `APP_SECRET_KEY` propia,
`PAGOS=false`, `GOOGLE_SIGNUP=false`, Wompi y Brevo vacíos. No puede cobrar ni
enviar correos reales.

### Para qué se usa

1. **Ensayar migraciones** antes de que lleguen a los bares. Es la razón por la
   que existe: las migraciones corren solas al arrancar (`app/database.py:31`) y
   `main` es producción.
2. **Validar cambios de `nginx.conf`.** Una config mal formada hace que nginx no
   arranque y tumba el sitio entero. Desplegando primero en staging, si el
   contenedor levanta es que la sintaxis es válida — sin arriesgar producción.
   Usado así el 2026-09-02 para el redirect `/s`.
3. **Probar la restauración de un backup**, que es lo que cierra la copia de
   seguridad de verdad.

### Trampa de Dokploy: los dominios necesitan un redeploy

**Añadir o cambiar un dominio en el panel no surte efecto hasta el siguiente
despliegue.** La configuración de Traefik se escribe durante el deploy, no al
guardar el formulario.

Los síntomas no son obvios y costaron dos diagnósticos el mismo día:

- Dominio nuevo → **404**, sin ruta en Traefik.
- Certificado de **Traefik por defecto** en vez de Let's Encrypt.
- Dominio reasignado a otro servicio → sigue sirviendo **el servicio anterior**,
  con código 200, así que parece que funciona.

El tercero es el peligroso: `st.repitela.com` estuvo sirviendo la app mientras el
panel decía `landing`. Se detecta comparando el `<title>` de la página, no el
código HTTP.

Tras el redeploy, Let's Encrypt emite en unos 20 segundos.

## Backups de SQLite

> **Backups (configurado 2026-09-02).** Dos piezas encadenadas en Dokploy:
>
> 1. **Schedule Job** `Backup diario SQLite` — `0 6 * * *` zona `America/Bogota`, sobre el servicio `backend`. Hace `sqlite3.Connection.backup()` a `/data/backup-<fecha>.db`, corre `PRAGMA integrity_check`, **descarta la copia si sale corrupta** y conserva las últimas 7.
> 2. **Volume Backup** `Base de datos a R2` — `15 11 * * *` **UTC** (= 6:15am Colombia, 15 min después del snapshot), volumen `repitelacom-monorepo-h51iw0_sqlite_data`, destino Cloudflare R2 (bucket `datos-repitela`, prefijo `repitela/`), retención 14.
>
> El orden importa: el tarball se lleva dentro un snapshot ya verificado, así que no depende de que copiar SQLite en caliente con WAL salga bien.
>
> **PENDIENTE — restauración de prueba:** nadie ha restaurado aún una copia en un entorno limpio. Hasta entonces el backup es una hipótesis.
>
> **Limitación conocida — RPO de 24h:** un fallo de disco de madrugada pierde la noche entera. Escalón siguiente: Litestream (replicación continua del WAL a R2).

Lo de arriba ya está montado. Lo que sigue abierto es la **restauración de prueba**: mientras nadie haya levantado una copia en limpio, el respaldo es una hipótesis bien fundada. Se hace en staging (ver abajo).

## Seed de desarrollo

`python -m app.db.seed` crea los venues `bar-dev` y `kiosko`, admins de prueba para cada uno y el superadmin `william` / `super123` (`backend/app/db/seed.py:11-55`). Es solo para desarrollo: no crea mesas ni códigos QR y esas credenciales no deben llegar a producción.
