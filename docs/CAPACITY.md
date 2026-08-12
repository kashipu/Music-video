# Capacidad y limites de escala

Medido el 2026-08-12. Escenario objetivo: **15 bares x 100 personas = 1500 usuarios
concurrentes**.

Conclusion corta: el backend aguanta ese escenario con muchisimo margen. El primer
techo real es `worker_connections` de nginx, y esta **sin resolver** (ver
[Techo 1](#techo-1-worker_connections-de-nginx-pendiente)).

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

---

## Techo 1: `worker_connections` de nginx (PENDIENTE)

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

Como validarlo: correr `scripts/load_test.py` **contra el contenedor de frontend**
(no contra el backend directo, que es lo que se midio arriba) con 1500 usuarios, y
verificar que no haya fallos al establecer WS. La medicion de este documento salta
nginx, asi que este techo esta calculado, no medido.

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
