# Revisión de arquitectura — Despliegue, CI/CD y operación

Revisado el 2026-09-02 sobre `claude/frontend-architecture-review-vn2ko9`.
Alcance: `docker-compose.yml`, los tres `Dockerfile`, `frontend/nginx.conf`,
`docs/DEPLOYMENT.md`, y las capacidades de Dokploy y Cloudflare R2 que hoy no se
están usando.

Las capacidades de Dokploy citadas aquí se verificaron contra su documentación
oficial en la fecha de la revisión; los enlaces están al final. **Conviene
reconfirmarlas contra la versión de Dokploy instalada antes de planificar sobre
ellas**, especialmente los límites por plan.

Conclusión corta: el despliegue funciona y está bien documentado, pero **Dokploy
ya trae resuelto el riesgo más grave del sistema y no se está usando**. La
mayoría de las oportunidades de esta lista son configuración, no código.

---

## Estado actual

| Aspecto | Hoy |
|---|---|
| Orquestación | Proyecto Docker Compose en Dokploy, tres servicios (`backend`, `frontend`, `landing`) |
| Disparador | Push a `main` → build y redespliegue de producción |
| Puerta de calidad | Ninguna (ver [BE-1](BACKEND.md#be-1--sin-ci-y-main-es-deploy-directo-a-producción)) |
| Build | En el servidor de producción, desde contexto local |
| Persistencia | Volumen nombrado `sqlite_data` (base + logos) |
| Copias | Ninguna (ver [SYS-1](SYSTEM.md#sys-1--sin-backups-el-ledger-de-facturación-vive-en-un-archivo-sin-copia)) |
| Almacenamiento de objetos | Ninguno; los logos se sirven desde la API |
| Monitoreo | `healthcheck` de Compose cada 300 s. Nada más |
| Notificaciones | Ninguna |
| Staging | Ninguno |

---

## Fortalezas

- El healthcheck está dimensionado con criterio y el motivo está escrito: a 60 s
  cada `exec` arranca un CPython nuevo, ~320 GB de lectura en tres semanas
  (`docker-compose.yml:39-41`).
- Los contenedores usan `expose`, no `ports`: el backend no queda accesible
  desde fuera, y el único camino a la API es el proxy del frontend.
- Variables obligatorias sin valor por defecto en Compose
  (`APP_SECRET_KEY=${APP_SECRET_KEY:?...}`), que fallan el arranque en vez de
  degradar en silencio.
- Cada kill-switch y cada variable tiene comentario explicando qué pasa si falta.
- `frontend/Dockerfile` verifica su propio `sed` de `worker_connections` con un
  `grep`, así que un cambio de imagen base que rompa el patrón falla el build en
  vez de degradar la capacidad en silencio.
- `docs/DEPLOYMENT.md` documenta sus propias deudas como PENDIENTE.

---

## Hallazgos

### OPS-1 · Dokploy ya resuelve el problema de backups y no se está usando

**Severidad:** crítica · **Esfuerzo:** bajo · **Cierra [SYS-1](SYSTEM.md#sys-1--sin-backups-el-ledger-de-facturación-vive-en-un-archivo-sin-copia)**

Dokploy tiene **Volume Backups**: copia volúmenes Docker **nombrados** a un
destino S3, con expresión cron y rotación automática. Y Cloudflare R2 es un
destino documentado de primera clase.

Las tres condiciones se cumplen hoy:

1. `sqlite_data` es un volumen **nombrado**, no un bind mount
   (`docker-compose.yml:66-68`) — que es exactamente el requisito de la función.
2. R2 tiene página propia en la documentación de Dokploy. **La opción PathStyle
   debe quedar activada.**
3. La programación es por cron, así que la ventana se puede poner fuera del
   horario de los bares.

> **Advertencia técnica que no hay que saltarse:** copiar el volumen mientras
> SQLite corre en modo WAL **no garantiza una copia consistente**. El archivo
> `.db` y sus `-wal` / `-shm` se copian en instantes distintos y el resultado
> puede ser un snapshot roto. La secuencia correcta es:
>
> 1. Un **Schedule Job** de Dokploy que ejecute `VACUUM INTO
>    '/data/snapshot.db'` dentro del contenedor del backend, unos minutos antes
>    de la ventana de backup. `VACUUM INTO` produce una copia consistente de una
>    base en uso.
> 2. El **Volume Backup** recoge el volumen, con el snapshot ya dentro.
>
> Un backup de volumen a secas es peor que no tener ninguno: da confianza sin
> dar recuperabilidad.

Y lo que cierra el ciclo: **una restauración probada**. Mientras no se haya
restaurado una copia en un entorno limpio, el backup es una hipótesis.

**Nota de plan:** el plan base de Dokploy limita los Schedule Jobs (1 por
servidor o contenedor). Verificar el plan contratado antes de diseñar sobre
varios trabajos programados.

### OPS-2 · Los logos se sirven desde el worker único, que es el techo de escala

**Severidad:** alta · **Esfuerzo:** medio

`GET /api/uploads/{filename}` (`backend/app/main.py:129-141`) sirve los archivos
de `/data/logos` con `FileResponse`, a través del **único worker asyncio** que
`docs/ARCHITECTURE.md` §4.1 declara restricción obligatoria y que
`docs/CAPACITY.md` identifica como el techo del sistema.

Quién pide esos archivos:

- El kiosco, que muestra el logo del bar en el televisor durante toda la noche.
- Cada teléfono que entra por el QR (`CustomerHeader`, `VenueLogo`).
- El panel de admin (`AdminHeader`, `AdminSidebar`).

Es decir: servir estáticos compite con la API y con el broadcast de WebSocket
por el mismo proceso. Y hay un detalle que importa para calibrar: **la prueba de
carga de `docs/CAPACITY.md` no incluyó tráfico de logos**, así que el techo
medido (1500 WS, p95 22 ms) excluye esta carga.

El `Cache-Control: public, max-age=604800` de siete días mitiga, pero no cubre
la primera visita de cada cliente nuevo — que en un bar es *todas* las noches,
gente distinta.

**Propuesta:** bucket R2 público con dominio propio (`cdn.repitela.com`), subida
directa desde el endpoint de logo, y `venues.logo_url*` guardando la URL
absoluta de R2. R2 no cobra egreso, que es justo el patrón de este caso: muchas
lecturas, pocas escrituras. Elimina la ruta `/api/uploads` por completo.

### OPS-3 · Los logos viven en el mismo volumen que la base, sin copia

**Severidad:** alta · **Esfuerzo:** bajo (se resuelve con OPS-2)

`get_logos_dir()` (`backend/app/main.py:18-21`) coloca los logos junto al archivo
SQLite, dentro de `sqlite_data`. Los binarios no están en la base: solo la ruta.

Perder el volumen no es solo perder los datos (SYS-1): es perder también la
identidad visual de todos los bares, sin forma de reconstruirla desde la base.
Moverlos a R2 (OPS-2) los saca del dominio del fallo y los pone en
almacenamiento replicado.

### OPS-4 · SVG subido se sirve desde el origen de la app, sin ningún header de seguridad

**Severidad:** media · **Esfuerzo:** bajo

`upload_venue_logo` acepta `image/svg+xml` (`app/routers/superadmin.py:704`) y
`serve_upload` lo devuelve con `media_type: image/svg+xml`
(`backend/app/main.py:136`). Un SVG puede contener JavaScript, y se sirve desde
`app.repitela.com`, el mismo origen donde viven los tokens de sesión.

Agravante: **`frontend/nginx.conf` no tiene ningún header de seguridad**. La
landing sí los tiene (`landing/nginx.conf:14-15`: `X-Frame-Options`,
`X-Content-Type-Options`); la aplicación, que es la que maneja autenticación,
no tiene ninguno — ni CSP, ni `nosniff`, ni `X-Frame-Options`.

Requiere una cuenta de superadmin para explotarse, así que no es urgente, pero
es persistente y afecta a todos los visitantes del bar.

**Propuesta, doble y barata:** servir los logos desde R2 con dominio separado
(OPS-2 lo hace gratis: otro origen, sin cookies ni tokens), y añadir CSP y los
headers básicos a `frontend/nginx.conf`.

### OPS-5 · Sin notificaciones: nadie se entera de un despliegue fallido

**Severidad:** alta · **Esfuerzo:** trivial

Dokploy envía notificaciones de despliegue —correcto o fallido— por Slack,
Discord, Telegram y correo. Hoy no hay ninguna configurada.

Combinado con [BE-3](BACKEND.md#be-3--50-except-exception-contra-8-líneas-de-logging)
(8 líneas de logging en todo el backend y ~50 `except Exception` que se tragan
el error), la operación es ciega por los dos extremos: ni se sabe si el deploy
entró, ni qué pasó después.

Es la mejor relación esfuerzo/beneficio de todo este documento: son minutos de
configuración.

### OPS-6 · El monitoreo de Dokploy está sin usar, y el disco es el punto ciego

**Severidad:** media · **Esfuerzo:** trivial

Dokploy expone gráficas en vivo de CPU, memoria, disco y red por contenedor, con
histórico y alertas por los mismos canales de OPS-5.

El punto ciego más caro es el **disco**. Hoy existe `check_database_size()`
(`backend/app/main.py:50-79`), que avisa por correo a los superadmins cuando el
archivo SQLite supera 400 MiB — pero eso vigila **el archivo**, no **el
volumen**. Si el disco del host se llena por otra causa (imágenes viejas, logs
de Docker, logos acumulados), SQLite empieza a fallar en escritura y la
aplicación no lo distingue de cualquier otro error: se lo traga un
`except Exception`.

Añadir alerta de disco en Dokploy cubre exactamente el hueco que la alerta
propia de la aplicación no puede ver.

### OPS-7 · Los preview deployments no aplican a este proyecto: el staging necesita otro camino

**Severidad:** media · **Esfuerzo:** medio · **Corrige la propuesta de [SYS-7](SYSTEM.md#sys-7--push-a-main-es-deploy-a-producción-sin-staging)**

La recomendación evidente para SYS-7 sería activar los Preview Deployments de
Dokploy: un entorno aislado por pull request. **No se puede.**

Dokploy no soporta preview deployments en proyectos **Docker Compose**; es una
limitación documentada y con issues abiertos (#1573, #2028). El proyecto está
desplegado como Compose, y migrar a tipo "Application" implicaría renunciar al
`docker-compose.yml`, que es la fuente de verdad del despliegue.

**Propuesta realista:** un **segundo proyecto Compose** en Dokploy apuntando a
una rama `staging`, con su propio dominio y su propio volumen. No da un entorno
por PR, pero sí da el ensayo de migraciones antes de producción, que es lo que
SYS-7 pide de verdad.

### OPS-8 · El QR lo genera un tercero gratuito y está en la ruta crítica

**Severidad:** media · **Esfuerzo:** bajo

El código QR que el cliente escanea en la mesa se genera en `api.qrserver.com`:

- `frontend/src/views/Kiosk.vue:19` — el QR que se muestra en el televisor del
  bar toda la noche.
- `frontend/src/composables/useAdminDashboard.js:117` — el que el admin descarga
  e imprime para las mesas.

Es un servicio externo gratuito, sin contrato ni SLA, en el único camino por el
que un cliente entra al producto. Si cae, si limita por volumen o si cambia su
API, los bares dejan de recibir clientes nuevos y el síntoma será "el QR no
carga", sin nada en los logs.

Además implica que cada kiosco anuncia la URL de registro de su bar a un tercero
de forma continua.

**Propuesta:** generar el QR una vez al crear el bar y guardarlo en R2 (la
columna `venues.qr_url` ya existe para esto). No requiere dependencia nueva en
el frontend, y el kiosco pasa a cargar una imagen estática desde el mismo CDN de
los logos.

### OPS-9 · Se construye en el servidor de producción

**Severidad:** media · **Esfuerzo:** medio

Los tres servicios se construyen desde contexto local (`docker-compose.yml:3-4`,
`52-53`, `66-67`), así que cada push a `main` dispara en el servidor de
producción dos `npm ci` + `npm run build` (frontend y landing) y un
`pip install`.

Ese servidor es una máquina de **2 vCPU / 1 GB** (`docs/CAPACITY.md`), la misma
que está sirviendo a los bares en ese momento. Un despliegue a las 10 de la
noche compite por CPU y memoria con la reproducción en curso. No hay
`deploy.resources.limits` en ningún servicio que acote el build.

**Propuesta:** construir las imágenes en CI (la Fase F1 ya introduce el
workflow), publicarlas en un registro, y que el Compose de producción use
`image:` en vez de `build:`. El deploy pasa a ser un `pull` + `up`, de segundos
y sin CPU. Es también la pieza que convierte lo que hoy es solo CD en un
CI/CD real.

### OPS-10 · Variables de sesión declaradas y nunca entregadas al contenedor

**Severidad:** baja · **Esfuerzo:** trivial

`SESSION_INACTIVITY_MINUTES` y `SESSION_MAX_HOURS` existen en `Settings`
(`backend/app/config.py:35-36`) y están documentadas en `docs/DEPLOYMENT.md`,
pero **no aparecen en el bloque `backend.environment`** de
`docker-compose.yml`. Configurarlas en Dokploy hoy no tiene ningún efecto: el
backend usa los valores por defecto del código.

Ya está registrado como PENDIENTE en `docs/DEPLOYMENT.md:61`. Es una línea de
Compose.

---

## Qué se está subutilizando, en una tabla

| Capacidad de Dokploy | Estado | Resuelve |
|---|---|---|
| Volume Backups → R2 | Sin usar | OPS-1, SYS-1 |
| Schedule Jobs (cron en contenedor) | Sin usar | OPS-1 (`VACUUM INTO`) |
| Notificaciones (Slack/Discord/Telegram/correo) | Sin usar | OPS-5 |
| Monitoreo por contenedor + alertas | Sin usar | OPS-6 |
| Rollbacks | Sin usar | Mitiga SYS-7 |
| Segundo proyecto Compose para staging | Sin usar | OPS-7, SYS-7 |
| Preview Deployments | **No aplica** a proyectos Compose | — |

| Capacidad de Cloudflare R2 | Uso propuesto |
|---|---|
| Bucket privado + destino S3 | Copias de la base (OPS-1) |
| Bucket público + dominio propio | Logos (OPS-2, OPS-3, OPS-4) y QR (OPS-8) |
| Egreso sin costo | El patrón de este producto: muchas lecturas, pocas escrituras |

---

## Fuentes

Documentación consultada el 2026-09-02:

- [Dokploy — Volume Backups](https://docs.dokploy.com/docs/core/volume-backups)
- [Dokploy — Cloudflare R2](https://docs.dokploy.com/docs/core/cloudflare-r2)
- [Dokploy — Backups](https://docs.dokploy.com/docs/core/backups)
- [Dokploy — Schedule Jobs](https://docs.dokploy.com/docs/core/schedule-jobs)
- [Dokploy — Monitoring](https://docs.dokploy.com/docs/core/monitoring)
- [Dokploy — Preview Deployments](https://docs.dokploy.com/docs/core/applications/preview-deployments)
- [Dokploy — Docker Compose](https://docs.dokploy.com/docs/core/docker-compose)
- [Issue #1573 — preview deployments para servicios Compose](https://github.com/Dokploy/dokploy/issues/1573)
- [Issue #2028 — Preview Deployments en apps Docker Compose](https://github.com/Dokploy/dokploy/issues/2028)
- [Dokploy — Precios y límites por plan](https://dokploy.com/pricing)
