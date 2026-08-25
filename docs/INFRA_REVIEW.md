# Revision de infraestructura y costos

Fecha: 2026-08-19. Alcance: `backend/`, `frontend/`, `landing/`, `docker-compose.yml`,
esquema de datos y costo unitario de operacion.

Complementa [CAPACITY.md](CAPACITY.md), que ya midio el techo de carga. Este documento
responde tres preguntas distintas: **si el codigo esta bien armado para escalar**, **si la
base y el back estan bien disenados**, y **cuanto cuesta hoy un usuario y un bar**.

---

## Veredicto corto

| Pregunta | Respuesta |
|----------|-----------|
| Se puede escalar con tranquilidad? | **Hasta ~10-15 bares si, tecnicamente.** Pero hoy hay 3 riesgos operativos que no son de capacidad y que duelen antes: sin backups, sin tests de backend ni CI, y sin observabilidad. |
| La base esta bien disenada? | **Si, para esta escala.** Normalizacion correcta, indices bien elegidos, FKs activas, WAL, migraciones versionadas. Dos deudas reales: `venues.config` como blob JSON, y ausencia total de transacciones. |
| El back esta bien disenado? | **Si.** Separacion routers/services/db limpia, SQL parametrizado sin una sola inyeccion, locks explicitos donde hay carreras, decisiones documentadas en el codigo. Las debilidades son de *operacion*, no de diseno. |
| Cuanto cuesta un usuario? | **~COP 0,02/noche.** Practicamente cero. |
| Cuanto cuesta un bar? | **El VPS dividido entre el numero de bares.** Con 1 bar: todo el server. Con 15 bares: ~COP 2.700/mes cada uno. |

El costo hoy es **100% fijo**. No hay ninguna variable que crezca con los usuarios de forma
que importe en dinero. Eso es una buena noticia de margen y una mala noticia de foco: no hay
nada que optimizar en costo, todo el trabajo pendiente es de **riesgo y continuidad**.

---

## 1. Lo que esta bien armado

No es cortesia; es lo que evita que la lista de abajo sea grave.

- **Multi-tenancy correcto.** El `venue_id` sale del JWT, no de un parametro de la URL.
  Revise los 3 routers autenticados: no hay un solo endpoint donde el cliente pueda elegir
  el venue sobre el que opera. Es el error tipico de un SaaS multi-tenant y aqui no esta.
- **Cero inyeccion SQL.** Todo parametrizado. La unica interpolacion (`f"DELETE FROM {table}"`)
  esta en `routers/test.py`, sobre una lista fija y detras de `APP_ENV == "test"`.
- **Las carreras estan pensadas, no ignoradas.** `_position_lock` en `queue_service` y
  `_playback_lock` en `playback_service` cubren exactamente los dos puntos donde dos
  requests simultaneos romperian el FIFO o dejarian dos canciones en `playing`. Ademas
  estan comentados explicando *por que* existen.
- **El arranque falla si `APP_SECRET_KEY` es el default** (`config.py`). Con ese guardia
  puesto, un deploy mal configurado no queda sirviendo con auth abierta.
- **CORS resuelto bien.** `allow_credentials` se apaga cuando hay wildcard, que es la
  combinacion que Starlette resolveria reflejando el Origin del atacante.
- **1 worker documentado como decision**, no como accidente, con la medicion que lo respalda.
- **Indices correctos**, incluido un indice unico parcial (`idx_queue_active_video`) para
  impedir duplicados solo mientras la cancion esta activa. Eso no lo escribe alguien
  improvisando.

Esta es una base sobre la que se puede construir. Los problemas que siguen son acotados.

---

## 2. La base de datos

### Diseno: correcto

11 tablas, todas con su `venue_id`, FKs declaradas y `PRAGMA foreign_keys = ON`. Los indices
cubren los accesos reales (cola por venue+status+position, rate limit por user+venue+fecha,
analytics por venue+tipo+fecha). WAL activo, `busy_timeout` de 15s, `synchronous = NORMAL`.
Las migraciones estan versionadas en una tabla `_migrations` y se aplican al arrancar.

Nada de esto hay que rehacerlo para llegar a 15 bares.

### Deuda 1: no hay transacciones (importante)

`database.py` abre la conexion con `isolation_level=None`, o sea **autocommit**: cada
`execute` se confirma solo. Los `db.commit()` y `_commit_with_retry()` repartidos por el
codigo son, en la practica, no-ops.

Consecuencia: **ninguna operacion de varios pasos es atomica**. Si falla a la mitad, queda
a la mitad. Se puede ver en vivo:

```
DELETE /api/superadmin/venues/{id}   ->  500, y el bar queda destruido a medias
```

`superadmin.py:205` borra en 6 pasos: `submission_log`, `play_history`, `queue_songs`,
`user_sessions`, `admins` y por ultimo `venues`. Pero `analytics_events`, `fallback_songs`
y `venue_daily_pins` **tambien referencian `venues`** y no se borran, asi que el ultimo
DELETE viola la FK. Verificado sobre el esquema real:

```
ok    DELETE FROM submission_log WHERE venue_id=1
ok    DELETE FROM play_history WHERE venue_id=1
ok    DELETE FROM queue_songs WHERE venue_id=1
ok    DELETE FROM user_sessions WHERE venue_id=1
ok    DELETE FROM admins WHERE venue_id=1
FALLA DELETE FROM venues WHERE id=1 -> IntegrityError: FOREIGN KEY constraint failed
```

Como esta en autocommit, los cinco primeros **ya se aplicaron**. Resultado real de borrar
un bar desde el superadmin: el bar sigue existiendo, pero perdio su historial, sus sesiones,
su cola y **sus administradores**. Sin vuelta atras y sin backup (ver seccion 5).

Arreglo: `BEGIN` / `COMMIT` explicito alrededor de la operacion, agregar las 3 tablas
faltantes al borrado (o declarar `ON DELETE CASCADE`), y de paso envolver en transaccion
las otras operaciones multi-paso (`play_now`, `kick_table`, `skip`).

### Deuda 2: `venues.config` es un blob JSON con read-modify-write

Volumen, banner, tema, QR, PIN, rate limits y `playback_status` viven todos dentro de la
misma columna `config TEXT`. Cada cambio hace *leer JSON -> modificar en Python -> escribir
JSON completo* (`admin.py` en `/volume`, `/banner`, `/show-qr`, `/settings/pin`).

Dos consecuencias:

1. **Se pierden cambios en silencio.** Si el admin sube el volumen desde el celular y en
   el mismo instante cambia el banner desde el PC, gana el ultimo que escribe y el otro
   cambio desaparece sin error. Hoy con un admin por bar es raro; con dos admins o con la
   pestana abierta en dos lados, no.
2. **Se parsea JSON en el camino caliente.** `get_now_playing` y `get_rate_limit_info`
   deserializan el config en cada llamada. Es barato, pero es trabajo por request que
   podrian ser columnas.

Arreglo barato: mover a columnas los campos que se escriben solos (`volume`,
`playback_status`, `banner_text`, `show_qr`) y dejar en JSON solo lo que se edita en bloque
desde el superadmin.

### Deuda 3: fugas menores entre bares

- `blocked_videos` tiene columna `venue_id` pero el indice unico es global
  (`idx_blocked_youtube` sobre `youtube_id` solo). Un video que falla en un bar queda
  bloqueado **para todos**. Puede ser deliberado, pero hoy no es una decision explicita.
- `GET /api/admin/library` consulta `song_metadata` **sin filtrar por venue**: cada bar ve
  el catalogo de canciones reproducidas en todos los demas bares.

### Deuda 4: crecimiento y limpieza

- `cleanup_old_data()` corre **solo al arrancar** (`main.py:47`). Si el contenedor no se
  reinicia en dos meses, `queue_songs` y `submission_log` no se purgan nunca.
- `play_history` y `analytics_events` crecen para siempre por diseno. Medido abajo: no es
  problema en anos.

---

## 3. El backend

### Diseno: correcto

`routers/` (HTTP, validacion, auth) -> `services/` (reglas de negocio) -> `database.py`.
Sin ORM, SQL a mano legible, schemas Pydantic en `models/`. Para el tamano del producto es
la eleccion adecuada: no hay capas de mas.

Los tres problemas serios que siguen son de robustez, no de estructura.

### Riesgo 1: la busqueda de YouTube es scraping, y es el punto mas fragil del producto

`services/youtube_search.py` descarga `youtube.com/results?search_query=...` y saca los
videos con una expresion regular. Funciona y no cuesta un peso, pero:

**a) Un cambio de YouTube en el HTML congela el proceso entero.** El regex usa `.*?` entre
`videoId`, `title` y `lengthText`. Si YouTube renombra o quita `lengthText` (pasa con lives
y shorts, y pasa con cada rediseno), el motor entra en backtracking. Medido sobre una pagina
sintetica de 1,28 MB:

| Caso | Tiempo del regex |
|------|------------------|
| Normal (todas las entradas con `lengthText`) | **2,3 ms** |
| Degradado (sin `lengthText`) | **21.530 ms** |

Ese regex corre **sincrono dentro del event loop**, y hay **un solo worker**. Veintiun
segundos de regex = veintiun segundos con todos los bares congelados a la vez: kioscos sin
avanzar, WebSockets mudos, admin sin responder. La pagina de prueba es sintetica y el numero
real dependera del HTML de YouTube, pero el orden de magnitud basta: es el unico punto del
sistema donde un cambio externo, sin deploy nuestro, tumba a todos los clientes al mismo
tiempo.

Arreglo (30 min): partir el HTML por `'"videoRenderer":'` y parsear cada trozo por separado
—sin `.*?` que cruce entradas—, cortar a los N primeros resultados, y correr el parseo con
`asyncio.to_thread`.

**b) Todos los bares salen por la misma IP.** Cuando YouTube empiece a responder captcha a
esa IP, la busqueda se cae para toda la plataforma simultaneamente. Y la salida obvia no
existe: la YouTube Data API cobra 100 unidades por busqueda sobre una cuota gratis de 10.000
al dia, o sea **100 busquedas diarias en total**. Un solo bar hace mas que eso en una noche
(estimado ~120). Migrar a la API oficial no es un plan de contingencia realista sin ampliacion
de cuota aprobada por Google.

Esto no es motivo para frenar, pero si para tenerlo escrito: **es la dependencia mas critica
del producto y no tiene plan B**.

**c) `GET /api/queue/search` no pide auth ni tiene rate limit.** Cualquiera en internet puede
hacer que el server descargue paginas de YouTube en bucle. Es el camino mas corto para que
bloqueen la IP.

### Riesgo 2: un solo proceso, sin red de seguridad

Ya esta documentado en CAPACITY.md y lo confirmo: `ConnectionManager` y
`_fallback_now_playing` viven en memoria del proceso. De ahi se derivan cosas que se sienten
en el bar, no en las metricas:

- **Cada deploy corta la musica.** Se pierden las conexiones WS y el estado de fallback.
  Si se despliega un viernes a las 10 pm, se nota en todos los bares.
- **No hay replicas ni rolling update posible.** Un crash = plataforma caida hasta que
  Docker reinicie.
- `bcrypt.checkpw` sincrono en el event loop (`auth_service.py:165` y `:186`) y sin rate
  limit en `/api/admin/login` ni `/api/superadmin/login`: quien quiera puede frenar el
  proceso a punta de logins fallidos.

### Riesgo 3: errores invisibles

Hay 29 bloques `except Exception: pass` en el backend. Algunos son deliberados
(best-effort en analytics), pero el efecto neto es que **los fallos no dejan rastro**. Un
ejemplo concreto que encontre justamente porque estaba tapado:

`routers/queue.py:38` registra el evento `song_searched` con `venue_id=0`. Como
`analytics_events.venue_id` es FK a `venues(id)` y no existe un venue 0, **el insert falla
siempre** y el `except` se lo traga. Verificado:

```
FALLA log_event(venue_id=0) -> IntegrityError: FOREIGN KEY constraint failed
```

O sea: las busquedas **nunca** se registraron en el analytics del backend, aunque
`ANALYTICS.md` las documenta como implementadas. Nadie se entero porque nada avisa.

No hay Sentry, ni logs estructurados, ni metricas, ni alertas. Hoy la forma de saber que
algo se rompio es que llame el dueno del bar.

### Otros hallazgos menores

| Donde | Que |
|-------|-----|
| `frontend/nginx.conf` | **Sin `gzip`** (el de `landing/` si lo tiene). Se sirven ~200 KB de bundle en vez de ~60 KB, y cada respuesta JSON va sin comprimir: 4.842 B por ciclo de poll en vez de 1.235 B. Es un cambio de 3 lineas que baja el trafico ~4x. |
| `frontend/nginx.conf` | Sin cabeceras de seguridad (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`). El de `landing/` si las tiene. |
| `frontend/Dockerfile` | `worker_connections` sigue en 1024 (techo ~1.000 usuarios). Ya identificado en CAPACITY.md, sigue pendiente. |
| `superadmin.py:408` | Acepta subir logos **SVG** y los sirve como `image/svg+xml` desde el mismo origen que la app. Un SVG puede traer `<script>`: es XSS almacenado. Solo lo puede hacer el superadmin, asi que el riesgo es bajo, pero se quita gratis sirviendolos con `Content-Disposition: attachment` o convirtiendo a PNG. |
| `main.py:95` | `/api/health` no verifica que se pueda **escribir** en disco. Un volumen lleno da health check verde con la app rota. |
| Todo el repo | **Cero tests de backend.** `requirements-dev.txt` declara pytest, no hay un solo archivo de test. Solo 3 specs de Playwright E2E. |
| Todo el repo | **Sin CI.** No hay `.github/workflows`. Nada corre lint ni tests antes de un deploy. |

---

## 4. Cuanto cuesta hoy un usuario y un bar

### Que se midio

Numeros reales, no estimaciones, salvo donde se indica:

- **Peso en base de datos**: sembre el esquema real con 1 bar durante 30 noches
  (40 usuarios/noche, 90 canciones pedidas, 68 reproducidas, 260 eventos de analytics).
- **Trafico**: levante el backend real y medi el tamano exacto de cada respuesta que el
  frontend consulta.
- **CPU y RAM**: tomados de CAPACITY.md (1.500 usuarios concurrentes medidos).

### Peso en disco

```
1 bar x 30 noches = 4,27 MB   (146 KB por noche)

  users                506 filas      user_sessions      1.200
  queue_songs        2.700 filas      submission_log     2.700
  play_history       2.040 filas      song_metadata      2.040
  analytics_events   7.800 filas
```

`queue_songs` y `submission_log` se purgan a los 7 dias, asi que lo permanente es
**~3,5 MB por bar por mes**. 15 bares durante 2 anos = ~1,3 GB. En un VPS con 20+ GB no es
un tema. (Ojo: el umbral de alerta que sugiere DEPLOYMENT.md, 500 MB, se cruza con 12 bares
al ano; hay que subirlo o dejara de significar algo.)

### Trafico por usuario

Medido contra el backend real, con la cola llena (1 sonando + 12 en espera):

| Endpoint (poll cada 30s desde el celular) | Sin gzip | Con gzip |
|---|---|---|
| `GET /api/auth/session` | 303 B | 236 B |
| `GET /api/queue?venue=` | 4.132 B | 643 B |
| `GET /api/queue/my-songs` | 275 B | 228 B |
| `GET /api/queue/remaining-slots` | 132 B | 128 B |
| **Total por ciclo** | **4.842 B** | **1.235 B** |

A 2 ciclos por minuto: **~580 KB/hora por usuario** (~150 KB/h si se activa gzip). Una noche
de 3 horas en el bar, mas la carga inicial del bundle (~200 KB sin comprimir, cacheado
despues):

> **~2 MB de trafico por usuario por noche.**

El kiosco agrega 434 B cada 10s = ~156 KB/h, despreciable. El video de YouTube y las
miniaturas **no pasan por nuestro server**: los baja el navegador del bar directo de Google.

### Consumo de un bar completo

| Recurso | Por bar (40 personas/noche, 30 noches) | Medido en |
|---------|--------------------------------------|-----------|
| Disco permanente | **~3,5 MB/mes** | esquema real sembrado |
| RAM | **~7 MB** con 40 conectados (~180 KB por WS) | CAPACITY.md |
| CPU | **<1% de un core** | CAPACITY.md |
| Trafico de salida | **~2,7 GB/mes** | payloads medidos |
| Trafico de entrada (scraping YouTube) | ~4 GB/mes (estimado: ~120 busquedas/noche x ~1,2 MB) | estimacion |

### La cuenta en pesos

Los servicios externos que usa el producto son **todos gratuitos**: busqueda de YouTube
(scraping), metadata (oEmbed), QR (`api.qrserver.com`), GA4 + GTM, SSL (Let's Encrypt). No
hay factura de API en ningun lado. Tampoco hay factura de backups, monitoreo ni error
tracking — porque no existen.

Queda una sola linea de costo: **el VPS**.

> Supuesto a confirmar con la factura real: VPS de 2 vCPU / 8 GB ~ **COP 40.000/mes**
> (rango tipico USD 8-15). El repo no lo documenta y CAPACITY.md aclara que el server esta
> **compartido con otros proyectos** (WordPress + MySQL de la-paz-si-pasa), asi que a
> Repitela le corresponde una fraccion, no el total.

**Costo marginal real de sumar uno mas:**

| | Recursos que consume | Costo en dinero |
|---|---|---|
| **1 usuario mas (una noche)** | 2 MB de trafico, 3,6 KB de disco | **~COP 0,02** |
| **1 bar mas (un mes)** | 2,7 GB de trafico, 3,5 MB de disco, 7 MB de RAM | **~COP 3** |

Es decir: **cero**. El servidor ya esta pago; sumar un bar no mueve la factura.

**Costo por bar segun cuantos bares haya** (VPS COP 40.000 repartido, ingreso COP 50.000/bar):

| Bares | Costo por bar | Margen bruto |
|-------|--------------|--------------|
| 1 | COP 40.000 | 20% |
| 3 | COP 13.300 | 73% |
| 5 | COP 8.000 | 84% |
| 10 | COP 4.000 | 92% |
| 15 | COP 2.700 | **95%** |

La conclusion economica es clara: **el costo por bar es el VPS dividido entre el numero de
bares, y nada mas**. La infraestructura no es lo que limita el negocio; el limite es
comercial y de soporte. Y el server aguanta ~10-15 bares llenos antes de tocar el techo de
nginx, asi que el margen del 95% es alcanzable sin gastar un peso mas en hosting.

Lo que **no** esta en esta cuenta y si cuesta: onboarding y soporte por bar (tiempo humano),
y el costo esperado de los riesgos de la seccion 5 — que hoy vale COP 0 al mes hasta el dia
que valga todo.

---

## 5. Que hacer, en orden

**Antes de vender el proximo bar** (riesgo de perder datos de un cliente que paga):

1. **Backups automaticos del SQLite.** Hoy no existen: un solo archivo, en un volumen local,
   sin copia. Un fallo de disco borra todos los bares y toda la facturacion. DEPLOYMENT.md
   propone un cron con `sqlite3 .backup`, pero no esta implementado en ningun lado del repo.
   Es lo primero, y es media hora de trabajo.
2. **Arreglar `DELETE /venues/{id}`** (seccion 2, deuda 1): hoy no borra el bar y si le
   destruye la historia y los admins.
3. **Blindar el parseo de busqueda** (seccion 3, riesgo 1a) y ponerle rate limit al endpoint.

**Antes de pasar de ~5 bares** (riesgo de no enterarse de las fallas):

4. Sentry o equivalente + revisar los `except Exception: pass` que tapan errores reales.
5. gzip y cabeceras de seguridad en `frontend/nginx.conf`; subir `worker_connections`.
6. Tests de backend sobre las reglas que ya estan escritas en BUSINESS_RULES.md, y un CI
   minimo que los corra. Hoy cada deploy es a pulso.
7. `asyncio.to_thread` para bcrypt + rate limit en los dos logins.

**Cuando se acerquen a 15 bares** (ya identificado en CAPACITY.md):

8. Estado de reproduccion y broadcast fuera del proceso (Redis pub/sub). Es lo que habilita
   replicas, deploys sin cortar la musica, y crecer de verdad.
9. Evaluar Postgres. No por rendimiento —SQLite sobra— sino por backups, concurrencia de
   escritura y no depender de un unico archivo en un unico disco.

---

## Como reproducir las mediciones

Los scripts usados son de un solo uso y no se versionaron; se reproducen asi:

- **Peso en disco**: aplicar `backend/app/db/migrations/*.sql` sobre una base vacia, sembrar
  30 noches x 40 usuarios x 90 canciones x 260 eventos, `PRAGMA wal_checkpoint(TRUNCATE)` y
  medir el archivo.
- **Trafico**: levantar `app.main:app` con `APP_ENV=test`, sembrar 40 sesiones y 13 canciones,
  y medir `len(response.content)` de los 4 endpoints del poll con `httpx.ASGITransport`.
- **Regex de busqueda**: correr el patron de `youtube_search.py` sobre una pagina sintetica
  de ~1,3 MB con 30 entradas, una version con `lengthText` y otra sin el.
- **Carga y concurrencia**: `scripts/load_test.py`, procedimiento en CAPACITY.md.
