# Capacidad y limites de escala

> **Índice:** [[README]] · **Autoridad sobre:** los límites de escala medidos · **Últ. cambio:** 2026-08-25
> Si esta página contradice al código, gana el código y esta página tiene un bug.

Medido el 2026-08-12. Escenario objetivo: **15 bares x 100 personas = 1500 usuarios
concurrentes**.

> **No confundir dos "workers" distintos (nota del 2026-09-02).** Esta página
> mide `worker_connections` de **nginx**, que es cuántas conexiones acepta el
> proxy. El otro techo, que esta página **no mide**, es el **único worker
> asyncio del backend** (`-w 1` en `backend/Dockerfile`): un solo proceso sirve
> la API, hace el broadcast de WebSocket y entrega los logos. No se puede subir
> a más de uno mientras el estado viva en memoria (WIL-68) y el lock de
> posiciones de cola sea por proceso. Ver [[decisions/sqlite-como-base]],
> WIL-69 y WIL-200.

Conclusion corta: el backend aguanta ese escenario con muchisimo margen. El primer
techo real era `worker_connections` de nginx, **resuelto y medido el 2026-08-21**
(1024 -> 8192 en `frontend/Dockerfile`): con la config vieja solo entraban
958 de 1200 usuarios; con la nueva entran los 1500 del escenario objetivo (ver
[Techo 1](#techo-1-worker_connections-de-nginx-resuelto-y-medido)).

---

## Como se midio

Imagen real del backend (`backend/Dockerfile`, python 3.11, gunicorn +
UvicornWorker), contenedor limitado a **2 vCPU / 1 GB**, que es lo que tiene el
server de produccion. Base sembrada con 15 venues, 1500 sesiones y 13 canciones
por cola (1 playing + 12 pending).

Carga generada por `scripts/load_test.py`, replicando lo que hace el frontend:

| Origen | Frecuencia | Archivo |
|--------|-----------|---------|
| WebSocket abierto por persona, ping cada 30s | 1500 conexiones, 50 ping/s | `useWebSocket.js:120` |
| 3 GET por persona cada 30s (`syncPoll`) | 150 req/s | `CustomerDashboard.vue:183` |
| 1 kiosco por bar cada 10s | 1.5 req/s | `Kiosk.vue:264` |

Total ofrecido: **1500 WS + ~154 req/s sostenidos**.

## Resultados

| Config | p50 | p95 | p99 | errores | RAM |
|--------|-----|-----|-----|---------|-----|
| `-w 1`, llegada de clientes repartida (escenario real) | **8 ms** | **22 ms** | 29 ms | 0 | 354 MB |
| `-w 1`, peor caso sintetico: 300 requests en el mismo instante, 15 veces/min | 269 ms | 2.6 s | 2.8 s | 0 | 269 MB |
| `-w 2`, mismo peor caso sintetico | 194 ms | 4.4 s | 4.6 s | 3 | 355 MB |

Las 1500 conexiones WebSocket se establecieron sin un solo fallo y el worker se
mantuvo en ~5-20% de un core.

**`-w 2` midio peor que `-w 1`**, no mejor: dos procesos peleando por los mismos
2 vCPU y por el mismo archivo SQLite empeoran el p95 y aparecen errores. Esto
respalda la decision de fijar 1 worker (ver el comentario en `backend/Dockerfile`),
que ademas es obligatoria porque el `ConnectionManager` y el estado de
reproduccion viven en memoria del proceso.

**Descuento a aplicar**: la medicion corrio sobre un Apple M5. Un vCPU del VPS es
~2-3x mas lento y esta compartido con los otros ~16 contenedores del server. Aun
castigando 3x, el escenario real queda en ~70 ms p95.

## Recursos del server de produccion

Un solo nodo (`srv1137924`): **2 vCPU / 8 GB**, compartido con todos los demas
proyectos de Dokploy (entre ellos WordPress + MySQL de la-paz-si-pasa). El
backend en 354 MB con 1500 WS no es un problema de memoria.

## Medición de almacenamiento y tráfico por venue

Medición histórica del 2026-08-21 con el esquema real: un venue sembrado durante
30 noches (40 usuarios/noche, 90 pedidos/noche, 68 reproducciones/noche y 260
eventos de analítica/noche) ocupó 4,27 MB. Tras la limpieza de cola y registros a
los 7 días, el crecimiento permanente estimado es de **~3,5 MB por venue al mes**.

Con una cola llena (una canción sonando y 12 pendientes), el polling del cliente
midió 4.842 B por ciclo sin compresión: **~2 MB por usuario en una noche de tres
horas** y **~2,7 GB de salida por venue al mes** bajo ese escenario. El vídeo y las
miniaturas de YouTube no atraviesan el backend.

---

## Techo 1: `worker_connections` de nginx (RESUELTO Y MEDIDO)

> **2026-08-21**: aplicado en `frontend/Dockerfile`
> (`worker_connections 1024 -> 8192`, con un `grep` que rompe el build si el
> patron deja de matchear). **Medido con A/B**, ya no es un calculo: ver
> [La medicion del 2026-08-21](#la-medicion-del-2026-08-21) mas abajo.

El unico limite que se choca **antes** de llegar a 15 bares llenos.

La imagen `nginx:alpine` trae de fabrica:

```
worker_processes  auto;      # = 2 en un server de 2 vCPU
worker_connections  1024;    # por worker
```

Son **2048 conexiones totales**, y cada WebSocket proxeado consume **dos**: la del
cliente y la del upstream al backend. Techo efectivo: **~1000 usuarios
simultaneos**, y a partir de ahi nginx encola o rechaza sin que el backend se
enterare de nada.

`frontend/nginx.conf` es un bloque `server {}` que se copia a `conf.d/`, y
`events {}` no se puede declarar ahi: hay que tocar el `nginx.conf` principal.
Fix candidato, en `frontend/Dockerfile`:

```dockerfile
RUN sed -i 's/worker_connections  1024/worker_connections  8192/' /etc/nginx/nginx.conf
```

### La medicion del 2026-08-21

Prueba A/B de solo-WebSockets contra el contenedor de frontend (el resto de este
documento mide el backend directo, saltando nginx). Ambas imagenes se forzaron a
`worker_processes 2` para emular el server de produccion de 2 vCPU: el VM de
Docker local tiene 10 CPUs y con `auto` el techo viejo ni se alcanza, que es
precisamente por que este limite no se habia visto en pruebas locales.

| Config | worker_processes x connections | 1200 usuarios | 1500 usuarios |
|---|---|---|---|
| Vieja (stock) | 2 x 1024 = 2048 | **958 de 1200** (242 fallos) | no probado |
| Nueva | 2 x 8192 = 16384 | 1200 de 1200 | **1500 de 1500** |

Los 958 confirman el calculo original (~1000 usuarios efectivos: cada WS proxeado
consume 2 conexiones de nginx). El escenario objetivo completo entra sin fallos
con la config nueva.

Falta aun: la prueba con `scripts/load_test.py` (que ademas del WS genera el
trafico HTTP de polling) contra el contenedor de frontend, para medir latencias
end-to-end a traves de nginx y no solo el establecimiento de conexiones.

## Techos siguientes, en orden de cuando duelen

1. **Estado de reproduccion en memoria** — `playback_service._fallback_now_playing`
   es un dict del proceso. Impide correr mas de un worker y mas de una replica, y
   se pierde en cada deploy (el bar en vivo reinicia el fallback). Es el primer
   bloqueo para escalar horizontalmente, no la CPU.
2. **Broadcast en memoria** — `ConnectionManager` tambien vive en el proceso. Si
   algun dia hacen falta replicas, el paso es mover el broadcast a Redis pub/sub,
   no subir workers.
3. **`bcrypt` bloqueante en el event loop** — `auth_service.py:165` y `:186` corren
   `bcrypt.checkpw` sincrono dentro de `async def`: ~100-300 ms en los que se
   frena todo, incluidos los WS y el kiosco. Con 15 admins es irrelevante; si
   alguien machaca `/api/superadmin/login` (no tiene rate limit) es un
   autoDoS. Fix: `await asyncio.to_thread(bcrypt.checkpw, ...)`.
4. **Escrituras SQLite serializadas** — margen enorme: 1500 personas pidiendo una
   cancion cada 30 min son ~0.8 escrituras/s.

---

## Como reproducir

```bash
# 1. imagen real del backend
docker build -t repitela-bench ./backend
docker network create benchnet

# 2. backend con los recursos del server de produccion
docker run -d --name bench-api --network benchnet --cpus=2 --memory=1g \
  --ulimit nofile=65536 \
  -e APP_ENV=development -e APP_SECRET_KEY=bench -e DATABASE_PATH=/data/bench.db \
  repitela-bench \
  gunicorn app.main:app -w 1 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

# 3. sembrar (dentro del contenedor, necesita los imports de app/)
docker cp scripts/load_test.py bench-api:/tmp/load_test.py
docker exec -w /app -e PYTHONPATH=/app bench-api python /tmp/load_test.py seed

# 4. generar carga desde otro contenedor (para no competir por CPU)
docker run --rm --network benchnet --ulimit nofile=65536 \
  -v "$PWD/scripts:/work" \
  -e BENCH_VENUES=15 -e BENCH_USERS=100 -e BENCH_SECONDS=90 \
  repitela-bench python /work/load_test.py run

# 5. limpiar
docker rm -f bench-api && docker network rm benchnet
```

Para vigilar CPU y memoria durante la corrida:
`docker stats --no-stream bench-api`.
