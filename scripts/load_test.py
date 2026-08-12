"""Prueba de carga: N bares x M personas contra un backend real.

Reproduce el trafico que genera el frontend: por persona un WebSocket abierto
con ping cada 30s (useWebSocket.js) mas 3 GET cada 30s (el syncPoll de
CustomerDashboard), y por bar un kiosco polleando cada 10s (Kiosk.vue).

Dos modos:

    python scripts/load_test.py seed    # siembra venues/usuarios/colas (dentro del contenedor)
    python scripts/load_test.py run     # genera la carga y mide latencias

Variables: BENCH_BASE (default http://bench-api:8000), BENCH_VENUES, BENCH_USERS,
BENCH_SECONDS. Ver docs/CAPACITY.md para el procedimiento completo y los
resultados de la ultima corrida.
"""
import asyncio
import os
import random
import sys
import time

BASE = os.environ.get("BENCH_BASE", "http://bench-api:8000")
VENUES = int(os.environ.get("BENCH_VENUES", "15"))
PER_VENUE = int(os.environ.get("BENCH_USERS", "100"))
DURATION = int(os.environ.get("BENCH_SECONDS", "90"))


# --------------------------------------------------------------------------- seed
async def seed():
    """Corre dentro del contenedor del backend: necesita app.database."""
    from app.database import init_db, get_db, close_db

    await init_db()
    db = await get_db()
    for v in range(1, VENUES + 1):
        await db.execute(
            "INSERT OR IGNORE INTO venues (id, name, slug, fallback_mode, config, active) "
            "VALUES (?, ?, ?, 'playlist', '{\"max_duration_sec\": 600}', 1)",
            (v, f"Bar {v}", f"bar-{v}"),
        )
        for u in range(PER_VENUE):
            uid = v * 1000 + u
            await db.execute(
                "INSERT OR IGNORE INTO users (id, phone, display_name) VALUES (?, ?, ?)",
                (uid, f"3{uid:09d}", f"User {uid}"),
            )
            await db.execute(
                "INSERT OR IGNORE INTO user_sessions (id, user_id, venue_id, table_number) "
                "VALUES (?, ?, ?, ?)",
                (f"s-{uid}", uid, v, str(u % 20)),
            )
        # 1 playing + 12 pending: cola de bar lleno (acotado a los usuarios que existan)
        for i in range(min(13, PER_VENUE)):
            uid = v * 1000 + i
            await db.execute(
                "INSERT OR IGNORE INTO queue_songs "
                "(venue_id, user_id, session_id, youtube_id, title, thumbnail_url, "
                "duration_sec, position, status) VALUES (?, ?, ?, ?, ?, ?, 210, ?, ?)",
                (v, uid, f"s-{uid}", f"vid{v}{i:03d}",
                 f"Cancion de prueba numero {i} del bar {v}",
                 f"https://i.ytimg.com/vi/vid{v}{i:03d}/default.jpg", i,
                 "playing" if i == 0 else "pending"),
            )
    await db.commit()
    rows = await db.execute_fetchall("SELECT COUNT(*) FROM queue_songs")
    print(f"sembrado: {VENUES} venues, {VENUES*PER_VENUE} sesiones, {rows[0][0]} canciones")
    await close_db()


# ---------------------------------------------------------------------------- run
lat: list[float] = []
errors = 0
done = False


async def ws_client(ws_base, slug, uid):
    import websockets
    global errors
    try:
        async with websockets.connect(f"{ws_base}/ws/queue?venue={slug}&user_id={uid}",
                                      open_timeout=30, ping_interval=None) as w:
            while not done:
                await asyncio.sleep(30)
                await w.send("ping")
    except Exception:
        errors += 1


async def poller(client, slug, period, paths):
    global errors
    # Desfase aleatorio: en la vida real cada cliente entro cuando entro.
    # Sin esto, los 100 clientes de un bar disparan en el mismo instante y lo
    # que se mide es un thundering herd sintetico (ver docs/CAPACITY.md).
    await asyncio.sleep(period * random.random())
    while not done:
        t0 = time.perf_counter()
        try:
            rs = await asyncio.gather(*(client.get(BASE + p.format(slug=slug)) for p in paths))
            lat.append((time.perf_counter() - t0) * 1000)
            errors += sum(1 for r in rs if r.status_code >= 400)
        except Exception:
            errors += 1
        await asyncio.sleep(period)


async def run():
    global done
    import httpx

    ws_base = BASE.replace("http", "ws")
    limits = httpx.Limits(max_connections=2000, max_keepalive_connections=2000)
    async with httpx.AsyncClient(limits=limits, timeout=30) as client:
        print("health:", (await client.get(f"{BASE}/api/health")).status_code, flush=True)

        tasks = []
        for v in range(1, VENUES + 1):
            for u in range(PER_VENUE):
                tasks.append(asyncio.create_task(ws_client(ws_base, f"bar-{v}", v * 1000 + u)))
        await asyncio.sleep(15)
        print(f"WS abiertos: {VENUES*PER_VENUE} (fallos: {errors})", flush=True)

        for v in range(1, VENUES + 1):
            slug = f"bar-{v}"
            for _ in range(PER_VENUE):
                tasks.append(asyncio.create_task(
                    poller(client, slug, 30, ["/api/queue?venue={slug}"] * 3)))
            tasks.append(asyncio.create_task(  # kiosco
                poller(client, slug, 10, ["/api/queue?venue={slug}"])))

        t0 = time.perf_counter()
        await asyncio.sleep(DURATION)
        done = True
        elapsed = time.perf_counter() - t0

        if lat:
            lat.sort()
            print(f"ciclos: {len(lat)} en {elapsed:.0f}s | req/s ~ {len(lat)*3/elapsed:.0f}")
            print(f"latencia por ciclo de 3 GET (ms): p50={lat[len(lat)//2]:.0f} "
                  f"p95={lat[int(len(lat)*.95)]:.0f} p99={lat[int(len(lat)*.99)]:.0f} "
                  f"max={lat[-1]:.0f}")
        print("errores:", errors)
        for t in tasks:
            t.cancel()


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "run"
    asyncio.run(seed() if mode == "seed" else run())
