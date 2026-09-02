# Despliegue

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
4. Compruebe `https://app.repitela.com/api/health` y abra una ruta de la app para verificar el proxy WebSocket.

Para desarrollo local, vea [DEV_LOCAL_SETUP.md](DEV_LOCAL_SETUP.md). No copie aquí un compose alterno: el archivo raíz es la fuente de verdad del despliegue.

## Backups de SQLite

> **PENDIENTE — riesgo abierto:** no hay tarea de backup en Compose ni en `scripts/`, y no está configurado Litestream, `sqlite3 .backup` ni `VACUUM INTO`. El volumen `sqlite_data` es la única persistencia declarada (`docker-compose.yml:66-68`); no constituye una copia recuperable.

Antes de tratar el dato como respaldado, hay que montar una tarea programada que genere una copia consistente de `/data/barqueue.db` (con WAL contemplado), la transfiera a almacenamiento externo, conserve una política de retención y pruebe restauraciones. Hasta entonces, una pérdida del volumen puede ser pérdida definitiva de datos.

## Seed de desarrollo

`python -m app.db.seed` crea los venues `bar-dev` y `kiosko`, admins de prueba para cada uno y el superadmin `william` / `super123` (`backend/app/db/seed.py:11-55`). Es solo para desarrollo: no crea mesas ni códigos QR y esas credenciales no deben llegar a producción.
