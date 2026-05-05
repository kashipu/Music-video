"""QA bug-hunt script — automated API tests for cases that don't need YouTube playback.

Runs against http://localhost:8000 with a clean qa-test venue.
Each case prints PASS / FAIL / WARN with a one-line reason.

Usage:
    python -m scripts.qa_bug_hunt
"""
import sqlite3
import sys
import time
import json
import io
import asyncio
import threading
import urllib.request
import urllib.error
from pathlib import Path

# Force UTF-8 stdout on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

API = "http://localhost:8000"
DB = Path(__file__).resolve().parent.parent / "backend" / "data" / "barqueue.db"
VENUE_SLUG = "qa-test"

# Test config: aggressive rate limit so tests run fast
VENUE_CONFIG = {
    "max_duration_sec": 300,
    "max_songs_per_window": 3,
    "window_minutes": 5,
    "playback_status": "playing",
}

# Fake video metadata (bypasses YouTube API)
TEST_VIDEOS = [
    ("ytqatest001", "Test Song A", 180),
    ("ytqatest002", "Test Song B", 200),
    ("ytqatest003", "Test Song C", 220),
    ("ytqatest004", "Test Song D", 150),
    ("ytqatest005", "Test Song E", 240),
    ("ytqatestlng", "Test Song Long", 700),  # exceeds 300s limit
]

results = []  # (case_id, status, msg)


def log(case, status, msg):
    color = {"PASS": "\033[92m", "FAIL": "\033[91m", "WARN": "\033[93m", "INFO": "\033[94m"}.get(status, "")
    reset = "\033[0m"
    print(f"  {color}[{status}]{reset} {case}: {msg}")
    results.append((case, status, msg))


def http(method, path, *, headers=None, body=None, expect=None):
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            content = r.read().decode()
            return r.status, json.loads(content) if content else {}, dict(r.headers)
    except urllib.error.HTTPError as e:
        content = e.read().decode()
        try:
            body = json.loads(content)
        except Exception:
            body = {"raw": content}
        return e.code, body, dict(e.headers)


# -------- Setup ---------------------------------------------------------------

def setup_db():
    print("\n[setup] Resetting qa-test venue and seeding metadata...")
    c = sqlite3.connect(DB)
    cur = c.cursor()

    # Recreate venue clean
    cur.execute("DELETE FROM queue_songs WHERE venue_id IN (SELECT id FROM venues WHERE slug = ?)", (VENUE_SLUG,))
    cur.execute("DELETE FROM submission_log WHERE venue_id IN (SELECT id FROM venues WHERE slug = ?)", (VENUE_SLUG,))
    cur.execute("DELETE FROM user_sessions WHERE venue_id IN (SELECT id FROM venues WHERE slug = ?)", (VENUE_SLUG,))
    cur.execute("DELETE FROM analytics_events WHERE venue_id IN (SELECT id FROM venues WHERE slug = ?)", (VENUE_SLUG,))
    cur.execute("DELETE FROM blocked_videos WHERE venue_id IN (SELECT id FROM venues WHERE slug = ?)", (VENUE_SLUG,))
    cur.execute("DELETE FROM venues WHERE slug = ?", (VENUE_SLUG,))
    cur.execute(
        "INSERT INTO venues (name, slug, fallback_mode, config) VALUES (?, ?, 'playlist', ?)",
        ("QA Test", VENUE_SLUG, json.dumps(VENUE_CONFIG)),
    )
    venue_id = cur.lastrowid

    # Admin for the venue
    import bcrypt
    pw_hash = bcrypt.hashpw(b"qa123", bcrypt.gensalt()).decode()
    cur.execute("DELETE FROM admins WHERE username = 'qa_admin'")
    cur.execute(
        "INSERT INTO admins (venue_id, username, password_hash) VALUES (?, 'qa_admin', ?)",
        (venue_id, pw_hash),
    )

    # Pre-seed metadata so /confirm works without hitting YouTube
    for yt_id, title, dur in TEST_VIDEOS:
        cur.execute(
            "INSERT OR REPLACE INTO song_metadata (youtube_id, title, duration_sec) VALUES (?, ?, ?)",
            (yt_id, title, dur),
        )

    c.commit()
    c.close()
    print(f"[setup] Venue id={venue_id}, slug={VENUE_SLUG}, admin=qa_admin/qa123")
    return venue_id


def register_user(phone, name, table=1):
    code, body, _ = http("POST", "/api/auth/register", body={
        "phone": phone, "table_number": str(table), "venue_slug": VENUE_SLUG,
        "data_consent": True, "display_name": name,
    })
    if code != 201:
        raise RuntimeError(f"register failed for {phone}: {code} {body}")
    return body["token"]


def admin_login():
    code, body, _ = http("POST", "/api/auth/admin/login", body={
        "username": "qa_admin", "password": "qa123", "venue_slug": VENUE_SLUG,
    })
    if code != 200:
        raise RuntimeError(f"admin login failed: {code} {body}")
    return body["token"]


def confirm_song(token, yt_id):
    return http("POST", "/api/queue/songs/confirm",
                headers={"Authorization": f"Bearer {token}"},
                body={"youtube_id": yt_id})


def cancel_song(token, song_id):
    return http("DELETE", f"/api/queue/my-songs/{song_id}",
                headers={"Authorization": f"Bearer {token}"})


def admin_skip(admin_token):
    return http("POST", "/api/admin/queue/skip",
                headers={"Authorization": f"Bearer {admin_token}"})


def get_remaining(token):
    return http("GET", "/api/queue/remaining-slots",
                headers={"Authorization": f"Bearer {token}"})


def get_admin_queue(admin_token):
    return http("GET", "/api/admin/queue",
                headers={"Authorization": f"Bearer {admin_token}"})


def db_clear_queue(venue_id):
    c = sqlite3.connect(DB)
    c.execute("DELETE FROM queue_songs WHERE venue_id = ?", (venue_id,))
    c.execute("DELETE FROM submission_log WHERE venue_id = ?", (venue_id,))
    # Also clear blocked_videos so prior error tests don't contaminate later cases
    c.execute("DELETE FROM blocked_videos WHERE venue_id = ?", (venue_id,))
    c.commit()
    c.close()


# -------- Test cases ----------------------------------------------------------

def run_tests():
    venue_id = setup_db()

    # Verify the admin login route exists (it lives in routers/auth.py likely under different prefix)
    # Probe alternative
    code, body, _ = http("POST", "/api/auth/admin/login", body={
        "username": "qa_admin", "password": "qa123", "venue_slug": VENUE_SLUG,
    })
    if code == 404:
        # Try /api/admin/login
        code, body, _ = http("POST", "/api/admin/login", body={
            "username": "qa_admin", "password": "qa123", "venue_slug": VENUE_SLUG,
        })
    if code != 200:
        print(f"[fatal] Could not log in admin: {code} {body}")
        return
    admin_token = body["token"]

    print("\n========== P0 (núcleo cola/fallback) ==========")

    # ---- BH-10: Auto-reproducción al confirmar con cola vacía ----
    print("\n[BH-10] Auto-reproducción al confirmar con cola vacía")
    db_clear_queue(venue_id)
    u1 = register_user("3001000001", "User1", 1)
    code, body, _ = confirm_song(u1, TEST_VIDEOS[0][0])
    if code != 201:
        log("BH-10", "FAIL", f"confirm 1 failed: {code} {body}")
    else:
        # Check it's now playing
        code, q, _ = get_admin_queue(admin_token)
        np = q.get("now_playing")
        if np and np.get("youtube_id") == TEST_VIDEOS[0][0]:
            log("BH-10", "PASS", "1ra canción se promovió a 'playing' inmediatamente")
        else:
            log("BH-10", "FAIL", f"now_playing={np}, esperado yt={TEST_VIDEOS[0][0]}")

    # ---- BH-08: Deduplicación en cola activa ----
    print("\n[BH-08] Deduplicación en cola activa")
    u2 = register_user("3001000002", "User2", 2)
    # u1 ya tiene yt-001 sonando; u2 intenta el mismo
    code, body, _ = confirm_song(u2, TEST_VIDEOS[0][0])
    if code == 409:
        log("BH-08", "PASS", "Duplicado rechazado con 409")
    else:
        log("BH-08", "FAIL", f"esperado 409, recibido {code} {body}")

    # ---- BH-14: FIFO ----
    print("\n[BH-14] FIFO estricto")
    db_clear_queue(venue_id)
    u1 = register_user("3001000003", "User1", 1)
    u2 = register_user("3001000004", "User2", 2)
    u3 = register_user("3001000005", "User3", 3)
    confirm_song(u1, TEST_VIDEOS[0][0])  # promovida a playing
    time.sleep(0.05)
    confirm_song(u2, TEST_VIDEOS[1][0])
    time.sleep(0.05)
    confirm_song(u3, TEST_VIDEOS[2][0])
    code, q, _ = get_admin_queue(admin_token)
    titles_in_queue = [s["title"] for s in q["queue"]]
    np_title = q["now_playing"]["title"] if q.get("now_playing") else None
    expected_order = [TEST_VIDEOS[0][1], TEST_VIDEOS[1][1], TEST_VIDEOS[2][1]]
    actual_order = [np_title] + titles_in_queue
    if actual_order == expected_order:
        log("BH-14", "PASS", f"orden FIFO correcto: {actual_order}")
    else:
        log("BH-14", "FAIL", f"orden incorrecto: {actual_order}, esperado {expected_order}")

    # ---- BH-31: Skip con cola pendiente → siguiente canción del queue ----
    # (Regression: _advance_queue had a missing `return` that caused skip to
    # respond with now_playing=None even though the DB advanced correctly,
    # tricking the kiosk into activating the fallback playlist.)
    print("\n[BH-31] Skip con cola pendiente devuelve siguiente del queue, no None")
    db_clear_queue(venue_id)
    u1 = register_user("3001000031", "U1", 1)
    u2 = register_user("3001000032", "U2", 2)
    u3 = register_user("3001000033", "U3", 3)
    confirm_song(u1, TEST_VIDEOS[0][0])  # playing
    confirm_song(u2, TEST_VIDEOS[1][0])  # pending pos=2
    confirm_song(u3, TEST_VIDEOS[2][0])  # pending pos=3

    code, body, _ = admin_skip(admin_token)
    np = body.get("now_playing")
    if not np:
        log("BH-31", "FAIL", f"BUG: skip devolvió now_playing=None pero hay 2 canciones pendientes — kiosk activaría fallback indebidamente")
    elif np.get("youtube_id") == TEST_VIDEOS[1][0]:
        log("BH-31", "PASS", f"skip devolvió la siguiente del queue: {np.get('title')}")
    else:
        log("BH-31", "FAIL", f"now_playing inesperado: {np}")

    # 2nd skip should advance to U3
    code, body, _ = admin_skip(admin_token)
    np2 = body.get("now_playing")
    if np2 and np2.get("youtube_id") == TEST_VIDEOS[2][0]:
        log("BH-31b", "PASS", f"2do skip avanzó a {np2.get('title')}")
    else:
        log("BH-31b", "FAIL", f"2do skip falló: now_playing={np2}")

    # ---- BH-04: Skip vuelve a fallback cuando cola se vacía ----
    print("\n[BH-04] Skip vacía la cola → fallback debería activarse")
    db_clear_queue(venue_id)
    u = register_user("3001000010", "U", 1)
    confirm_song(u, TEST_VIDEOS[0][0])  # única canción → playing
    code, body, _ = admin_skip(admin_token)
    if code != 200:
        log("BH-04", "FAIL", f"skip endpoint falló: {code} {body}")
    else:
        # Verify queue ahora vacío y la canción quedó como played
        c = sqlite3.connect(DB)
        rows = c.execute("SELECT status FROM queue_songs WHERE venue_id = ?", (venue_id,)).fetchall()
        c.close()
        statuses = [r[0] for r in rows]
        if statuses == ["played"]:
            log("BH-04", "PASS", "canción marcada como played, cola vacía → fallback puede activarse")
        else:
            log("BH-04", "FAIL", f"estados inesperados: {statuses}")

    # ---- BH-09: Race — doble skip rápido ----
    print("\n[BH-09] Race: doble skip rápido")
    db_clear_queue(venue_id)
    u = register_user("3001000020", "U", 1)
    confirm_song(u, TEST_VIDEOS[0][0])  # playing
    confirm_song(u, TEST_VIDEOS[1][0])  # pending
    confirm_song(u, TEST_VIDEOS[2][0])  # pending

    # Issue 2 skips concurrently
    out = []
    def do_skip():
        out.append(admin_skip(admin_token))
    t1 = threading.Thread(target=do_skip)
    t2 = threading.Thread(target=do_skip)
    t1.start(); t2.start()
    t1.join(); t2.join()
    skip_codes = [o[0] for o in out]

    c = sqlite3.connect(DB)
    played = c.execute("SELECT COUNT(*) FROM queue_songs WHERE venue_id = ? AND status='played'", (venue_id,)).fetchone()[0]
    playing = c.execute("SELECT COUNT(*) FROM queue_songs WHERE venue_id = ? AND status='playing'", (venue_id,)).fetchone()[0]
    pending = c.execute("SELECT COUNT(*) FROM queue_songs WHERE venue_id = ? AND status='pending'", (venue_id,)).fetchone()[0]
    c.close()

    # Esperado: 2 played, 1 playing, 0 pending (cada skip avanzó una)
    if played == 2 and playing == 1 and pending == 0:
        log("BH-09", "PASS", f"2 saltos consistentes (played=2, playing=1, codes={skip_codes})")
    elif playing > 1:
        log("BH-09", "FAIL", f"BUG: 2 canciones en estado playing simultáneamente (played={played} playing={playing} pending={pending})")
    else:
        log("BH-09", "WARN", f"played={played} playing={playing} pending={pending} codes={skip_codes} — un skip se serializó (esperado 2 efectos)")

    print("\n========== P1 (rate limit, errores, validación) ==========")

    # ---- BH-11: Rate limit ----
    print("\n[BH-11] Rate limit (max=3, window=5)")
    db_clear_queue(venue_id)
    u = register_user("3001000030", "U", 1)
    code1, _, _ = confirm_song(u, TEST_VIDEOS[0][0])
    code2, _, _ = confirm_song(u, TEST_VIDEOS[1][0])
    code3, _, _ = confirm_song(u, TEST_VIDEOS[2][0])
    code4, body4, _ = confirm_song(u, TEST_VIDEOS[3][0])
    if code1 == 201 and code2 == 201 and code3 == 201 and code4 == 429:
        log("BH-11", "PASS", "3 aceptadas, 4ta rechazada con 429")
    else:
        log("BH-11", "FAIL", f"códigos: {code1} {code2} {code3} {code4} (4ta debió ser 429)")

    code, rem, _ = get_remaining(u)
    if rem.get("songs_remaining") == 0:
        log("BH-11b", "PASS", f"songs_remaining=0 tras llenar el límite")
    else:
        log("BH-11b", "FAIL", f"songs_remaining={rem.get('songs_remaining')}, esperado 0")

    # ---- BH-13: Cancelar pendiente NO libera slot ----
    print("\n[BH-13] Cancelar pendiente NO libera slot (BR-05)")
    # u still has 3 songs counted; cancel the 3rd (pending)
    c = sqlite3.connect(DB)
    pending_ids = c.execute(
        "SELECT id FROM queue_songs WHERE venue_id = ? AND status = 'pending' ORDER BY position",
        (venue_id,)
    ).fetchall()
    c.close()
    if not pending_ids:
        log("BH-13", "WARN", "no hay pendientes para cancelar (cambio de estado previo)")
    else:
        cancel_id = pending_ids[-1][0]
        code, body, _ = cancel_song(u, cancel_id)
        if code != 200:
            log("BH-13", "FAIL", f"cancel falló: {code} {body}")
        else:
            _, rem, _ = get_remaining(u)
            if rem.get("songs_remaining") == 0:
                log("BH-13", "PASS", "slot NO devuelto tras cancelar (correcto, BR-05)")
            else:
                log("BH-13", "FAIL", f"slot devuelto incorrectamente: songs_remaining={rem.get('songs_remaining')}")

    # ---- BH-12: Error de video libera slot ----
    print("\n[BH-12] Error de video libera slot")
    db_clear_queue(venue_id)
    u = register_user("3001000040", "U", 1)
    code, body, _ = confirm_song(u, TEST_VIDEOS[0][0])
    song_id = body["id"]
    _, rem_before, _ = get_remaining(u)
    # Trigger error
    code, body, _ = http("POST", "/api/playback/error",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          body={"song_id": song_id, "venue_slug": VENUE_SLUG, "error_code": 150})
    time.sleep(0.3)
    _, rem_after, _ = get_remaining(u)
    if rem_after.get("songs_remaining", 0) > rem_before.get("songs_remaining", 99):
        log("BH-12", "PASS", f"slot liberado: {rem_before.get('songs_remaining')} → {rem_after.get('songs_remaining')}")
    elif rem_after.get("songs_remaining", 0) == VENUE_CONFIG["max_songs_per_window"]:
        log("BH-12", "PASS", f"slot liberado, songs_remaining={rem_after.get('songs_remaining')}")
    else:
        log("BH-12", "FAIL", f"slot no liberado: before={rem_before.get('songs_remaining')} after={rem_after.get('songs_remaining')}")

    # Check video bloqueado en blocked_videos
    c = sqlite3.connect(DB)
    blocked = c.execute("SELECT youtube_id FROM blocked_videos WHERE youtube_id = ?", (TEST_VIDEOS[0][0],)).fetchall()
    c.close()
    if blocked:
        log("BH-12b", "PASS", f"video {TEST_VIDEOS[0][0]} agregado a blocked_videos")
    else:
        log("BH-12b", "FAIL", "video no quedó en blocked_videos")

    # ---- BH-19: Límite de duración ----
    print("\n[BH-19] Límite de duración (max=300s)")
    db_clear_queue(venue_id)
    u = register_user("3001000050", "U", 1)
    code, body, _ = confirm_song(u, "ytqatestlng")  # 700s
    # /confirm doesn't validate duration — only /songs does. But the metadata is in DB.
    # Let's check if the API rejects it. The /confirm path does NOT re-check duration.
    # That's actually the bug to surface: duration check is only in /songs (preview), not confirm.
    if code == 400 and "limite" in str(body).lower():
        log("BH-19", "PASS", "rechazado en /confirm")
    elif code == 201:
        log("BH-19", "FAIL", f"BUG: /confirm acepta video que excede duración (preview es la única validación) — {body.get('title')}")
    else:
        log("BH-19", "WARN", f"código inesperado: {code} {body}")

    # ---- BH-29: Doble click en confirm ----
    print("\n[BH-29] Doble confirm rápido (mismo video)")
    db_clear_queue(venue_id)
    u = register_user("3001000060", "U", 1)
    out = []
    def do_confirm():
        out.append(confirm_song(u, TEST_VIDEOS[0][0]))
    t1 = threading.Thread(target=do_confirm)
    t2 = threading.Thread(target=do_confirm)
    t1.start(); t2.start()
    t1.join(); t2.join()
    codes = sorted([o[0] for o in out])
    c = sqlite3.connect(DB)
    cnt = c.execute("SELECT COUNT(*) FROM queue_songs WHERE venue_id = ? AND youtube_id = ? AND status IN ('pending','playing')",
                    (venue_id, TEST_VIDEOS[0][0])).fetchone()[0]
    c.close()
    if cnt == 1 and 409 in codes:
        log("BH-29", "PASS", f"solo 1 entrada, segunda rechazada con 409 (códigos: {codes})")
    elif cnt == 1:
        log("BH-29", "WARN", f"1 entrada pero códigos: {codes} (sin 409 explícito — posible race window)")
    else:
        log("BH-29", "FAIL", f"BUG: {cnt} entradas en cola con mismo yt_id (códigos: {codes})")

    # ---- BH-28: Concurrencia múltiples usuarios ----
    print("\n[BH-28] 3 usuarios confirmando en paralelo")
    db_clear_queue(venue_id)
    users = [register_user(f"30010001{i:02d}", f"U{i}", str(i)) for i in range(70, 73)]
    out = []
    def do_user_confirm(tok, yt):
        out.append(confirm_song(tok, yt))
    threads = [threading.Thread(target=do_user_confirm, args=(users[i], TEST_VIDEOS[i][0])) for i in range(3)]
    for t in threads: t.start()
    for t in threads: t.join()
    c = sqlite3.connect(DB)
    rows = c.execute(
        "SELECT position, status FROM queue_songs WHERE venue_id = ? ORDER BY position", (venue_id,)
    ).fetchall()
    positions = [r[0] for r in rows]
    c.close()
    if len(positions) == 3 and len(set(positions)) == 3 and positions == sorted(positions):
        log("BH-28", "PASS", f"3 entradas con posiciones únicas: {positions}")
    else:
        log("BH-28", "FAIL", f"BUG: posiciones {positions} (debían ser 3 únicas y consecutivas)")

    # ---- BH-32: finish_song con cola pendiente devuelve siguiente (BR-13a) ----
    # Mismo invariante que BH-31 pero por la vía /api/playback/finished que dispara el Kiosk
    # cuando un video termina naturalmente. Si finish devuelve next_song=None con cola
    # llena, el Kiosk activaría el fallback aunque haya canciones de usuarios pendientes.
    print("\n[BH-32] finish_song con cola pendiente devuelve siguiente (BR-13a)")
    db_clear_queue(venue_id)
    u1 = register_user("3001000091", "U1", 1)
    u2 = register_user("3001000092", "U2", 2)
    code, body, _ = confirm_song(u1, TEST_VIDEOS[0][0])
    playing_id = body["id"]
    confirm_song(u2, TEST_VIDEOS[1][0])

    # Simulate kiosk reporting the song finished
    code, body, _ = http("POST", "/api/playback/finished",
                        headers={"Authorization": f"Bearer {admin_token}"},
                        body={"song_id": playing_id, "venue_slug": VENUE_SLUG})
    next_song = body.get("next_song")
    if not next_song:
        log("BH-32", "FAIL", f"BUG: finish_song devolvió next_song=None aunque hay 1 pendiente")
    elif next_song.get("youtube_id") == TEST_VIDEOS[1][0]:
        log("BH-32", "PASS", f"finish devolvió la siguiente: {next_song.get('title')}")
    else:
        log("BH-32", "FAIL", f"next_song inesperado: {next_song}")

    # ---- BH-33: error_song con cola pendiente devuelve siguiente (BR-13a) ----
    print("\n[BH-33] error_song con cola pendiente devuelve siguiente (BR-13a)")
    db_clear_queue(venue_id)
    u1 = register_user("3001000093", "U1", 1)
    u2 = register_user("3001000094", "U2", 2)
    code, body, _ = confirm_song(u1, TEST_VIDEOS[0][0])
    playing_id = body["id"]
    confirm_song(u2, TEST_VIDEOS[1][0])

    code, body, _ = http("POST", "/api/playback/error",
                        headers={"Authorization": f"Bearer {admin_token}"},
                        body={"song_id": playing_id, "venue_slug": VENUE_SLUG, "error_code": 150})
    next_song = body.get("next_song")
    if not next_song:
        log("BH-33", "FAIL", f"BUG: error_song devolvió next_song=None aunque hay 1 pendiente")
    elif next_song.get("youtube_id") == TEST_VIDEOS[1][0]:
        log("BH-33", "PASS", f"error devolvió la siguiente: {next_song.get('title')}")
    else:
        log("BH-33", "FAIL", f"next_song inesperado: {next_song}")

    # ---- BH-34: skip + finish concurrentes — solo una promueve (BR-13a atomicidad) ----
    print("\n[BH-34] skip y finish simultáneos — la cola NO debe perder canciones")
    db_clear_queue(venue_id)
    u1 = register_user("3001000095", "U1", 1)
    u2 = register_user("3001000096", "U2", 2)
    u3 = register_user("3001000097", "U3", 3)
    code, body, _ = confirm_song(u1, TEST_VIDEOS[0][0])
    playing_id = body["id"]
    confirm_song(u2, TEST_VIDEOS[1][0])
    confirm_song(u3, TEST_VIDEOS[2][0])

    # Run skip and finish concurrently (race)
    out = []
    def do_skip(): out.append(("skip", admin_skip(admin_token)))
    def do_finish():
        out.append(("finish", http("POST", "/api/playback/finished",
                                    headers={"Authorization": f"Bearer {admin_token}"},
                                    body={"song_id": playing_id, "venue_slug": VENUE_SLUG})))
    t1 = threading.Thread(target=do_skip)
    t2 = threading.Thread(target=do_finish)
    t1.start(); t2.start()
    t1.join(); t2.join()

    c = sqlite3.connect(DB)
    rows = c.execute(
        "SELECT id, status, position FROM queue_songs WHERE venue_id = ? ORDER BY position",
        (venue_id,)
    ).fetchall()
    c.close()
    statuses = [r[1] for r in rows]
    playing_count = statuses.count("playing")
    played_count = statuses.count("played")
    pending_count = statuses.count("pending")

    # Acceptable: 1 played (the original) + 1 playing (advanced) + 1 pending (untouched)
    # OR 2 played + 1 playing (both advanced through the queue)
    # NOT acceptable: 2 playing (race promoted both), or songs lost (3 played + 0 playing)
    if playing_count > 1:
        log("BH-34", "FAIL", f"BUG ATÓMICO: {playing_count} canciones en 'playing' simultáneamente")
    elif playing_count == 1 and (played_count + pending_count) == 2:
        log("BH-34", "PASS", f"estado consistente: 1 playing, {played_count} played, {pending_count} pending")
    else:
        log("BH-34", "WARN", f"estado inesperado: playing={playing_count} played={played_count} pending={pending_count}")

    # ---- BH-35: Cancelar la canción que está #1 NO la promueve a playing (BR-04 + BR-12b) ----
    # Si el usuario cancela su canción que ya está como next-up (#1 pendiente), el sistema
    # debe simplemente removerla de la cola y dejar que la siguiente quede en #1.
    print("\n[BH-35] Cancelar #1 pendiente promueve la siguiente correctamente")
    db_clear_queue(venue_id)
    u1 = register_user("3001000098", "U1", 1)
    u2 = register_user("3001000099", "U2", 2)
    u3 = register_user("3001000100", "U3", 3)
    confirm_song(u1, TEST_VIDEOS[0][0])  # playing
    code, b2, _ = confirm_song(u2, TEST_VIDEOS[1][0])  # pending pos=2 (será cancelada)
    confirm_song(u3, TEST_VIDEOS[2][0])  # pending pos=3
    cancel_id = b2["id"]
    cancel_song(u2, cancel_id)

    c = sqlite3.connect(DB)
    rows = c.execute(
        "SELECT youtube_id, status, position FROM queue_songs WHERE venue_id = ? AND status IN ('playing','pending') ORDER BY position",
        (venue_id,)
    ).fetchall()
    c.close()
    if len(rows) == 2 and rows[0][1] == "playing" and rows[1][0] == TEST_VIDEOS[2][0]:
        log("BH-35", "PASS", f"u3 quedó como pendiente tras cancelar u2 ({[(r[0], r[1], r[2]) for r in rows]})")
    else:
        log("BH-35", "FAIL", f"estado inesperado: {[(r[0], r[1], r[2]) for r in rows]}")

    # ---- BH-08b: Same user re-adds after played ----
    print("\n[BH-08b] Mismo video después de played se permite (BR-08 final)")
    db_clear_queue(venue_id)
    u = register_user("3001000080", "U", 1)
    confirm_song(u, TEST_VIDEOS[0][0])  # playing
    admin_skip(admin_token)  # → played
    time.sleep(0.2)
    code, body, _ = confirm_song(u, TEST_VIDEOS[0][0])  # debería poder
    if code == 201:
        log("BH-08b", "PASS", "video played puede re-encolarse")
    else:
        log("BH-08b", "FAIL", f"BUG: {code} {body} — debería permitir según BR-08")

    print("\n========== Resumen ==========")
    passed = sum(1 for _,s,_ in results if s == "PASS")
    failed = sum(1 for _,s,_ in results if s == "FAIL")
    warned = sum(1 for _,s,_ in results if s == "WARN")
    print(f"\n  PASS: {passed}    FAIL: {failed}    WARN: {warned}\n")
    if failed:
        print("  Fallos:")
        for case, status, msg in results:
            if status == "FAIL":
                print(f"    - {case}: {msg}")


if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
