"""Regression checks for the 6 P0 bugs in docs/PLAN_MEJORAS_ESCALA.md.

Each check is self-contained and prints PASS/FAIL. Some hit the local backend
(http://localhost:8000, qa-test venue — same convention as scripts/qa_bug_hunt.py),
others test the fixed function directly with mocked I/O (no network needed).

Usage:
    python -m scripts.verify_p0_bugs            # run all
    python -m scripts.verify_p0_bugs p0_4        # run one case
"""
import asyncio
import json
import os
import sqlite3
import sys
import time
import io
import urllib.request
import urllib.error
from pathlib import Path
from unittest.mock import AsyncMock, patch

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

API = "http://localhost:8000"
DB = Path(__file__).resolve().parent.parent / "backend" / "data" / "barqueue.db"
VENUE_SLUG = "qa-test"

results = []


def log(case, status, msg):
    color = {"PASS": "\033[92m", "FAIL": "\033[91m"}.get(status, "")
    reset = "\033[0m"
    print(f"  {color}[{status}]{reset} {case}: {msg}")
    results.append((case, status, msg))


def http(method, path, *, body=None, headers=None):
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


def db():
    return sqlite3.connect(DB)


def confirm_concurrent(pairs):
    """POST /api/queue/songs/confirm for each (token, youtube_id) truly concurrently
    via asyncio.gather + a shared httpx.AsyncClient — threading.Thread + urllib was
    too jittery (connection setup overhead) to land both requests inside the same
    event-loop tick, so it never hit the actual race window."""
    import httpx

    async def _run():
        async with httpx.AsyncClient(base_url=API, timeout=10) as client:
            reqs = [
                client.post(
                    "/api/queue/songs/confirm",
                    json={"youtube_id": yid},
                    headers={"Authorization": f"Bearer {token}"},
                )
                for token, yid in pairs
            ]
            return await asyncio.gather(*reqs)

    responses = asyncio.run(_run())
    return [(r.status_code, r.json()) for r in responses]


def get_venue_id():
    c = db()
    row = c.execute("SELECT id FROM venues WHERE slug = ?", (VENUE_SLUG,)).fetchone()
    c.close()
    if not row:
        print("ERROR: qa-test venue no existe. Corre `python -m scripts.qa_bug_hunt` primero.")
        sys.exit(1)
    return row[0]


def register_user(venue_id, table="p0test"):
    phone = f"3{int(time.time() * 1000) % 100000000:08d}"
    status, body = http("POST", "/api/auth/register", body={
        "phone": phone, "table_number": table, "venue_slug": VENUE_SLUG,
        "data_consent": True, "display_name": f"P0 {table}",
    })
    if status != 201:
        raise RuntimeError(f"register failed: {status} {body}")
    return body["token"]


def admin_token():
    status, body = http("POST", "/api/admin/login", body={
        "username": "qa_admin", "password": "qa123", "venue_slug": VENUE_SLUG,
    })
    if status != 200:
        raise RuntimeError(f"admin login failed: {status} {body}")
    return body["token"]


# ---------------------------------------------------------------------------
# P0.4 — search URL not encoded (youtube_search.py)
# ---------------------------------------------------------------------------

def p0_4():
    """The real search_youtube() must send the query via httpx `params=`,
    not string-interpolated into the URL, so `&`, `#`, spaces don't corrupt
    or split the request. Verified with a mocked transport — no network."""
    from app.services import youtube_search

    captured = {}

    class FakeResponse:
        status_code = 200
        text = ""

    async def fake_get(self, url, *, params=None, headers=None, **kw):
        captured["url"] = url
        captured["params"] = params
        return FakeResponse()

    with patch("app.config.settings.app_env", "development"):
        with patch("httpx.AsyncClient.get", new=fake_get):
            asyncio.run(youtube_search.search_youtube("rock & roll #90s"))

    ok = (
        captured.get("params") == {"search_query": "rock & roll #90s"}
        and "?" not in captured.get("url", "")
    )
    if ok:
        log("P0.4", "PASS", "query pasa por params= de httpx (encoding correcto), no interpolado en la URL")
    else:
        log("P0.4", "FAIL", f"captured={captured}")
    return ok


# ---------------------------------------------------------------------------
# P0.2 — db.lastrowid on the connection (admin.py fallback/add)
# ---------------------------------------------------------------------------

def p0_2():
    venue_id = get_venue_id()
    c = db()
    c.execute("DELETE FROM fallback_songs WHERE venue_id = ? AND youtube_id = 'p0test002'", (venue_id,))
    c.commit()
    c.close()

    token = admin_token()
    status, body = http(
        "POST", f"/api/admin/fallback/add?youtube_id=p0test002",
        headers={"Authorization": f"Bearer {token}"},
    )
    ok = status == 200 and body.get("song", {}).get("id") is not None
    if ok:
        log("P0.2", "PASS", f"/api/admin/fallback/add devolvió id={body['song']['id']} sin AttributeError")
    else:
        log("P0.2", "FAIL", f"status={status} body={body}")
    return ok


# ---------------------------------------------------------------------------
# P0.1 — analytics_events.venue_id=0 breaks the FK, INSERT silently dropped
# ---------------------------------------------------------------------------

def p0_1():
    c = db()
    before = c.execute("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'song_searched'").fetchone()[0]
    c.close()

    status, _ = http("GET", "/api/queue/search?q=p0testquery")
    if status != 200:
        log("P0.1", "FAIL", f"/api/queue/search devolvió {status}")
        return False

    c = db()
    after = c.execute("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'song_searched'").fetchone()[0]
    c.close()

    ok = after > before
    if ok:
        log("P0.1", "PASS", f"evento song_searched se guardó ({before} -> {after})")
    else:
        log("P0.1", "FAIL", f"el evento sigue sin guardarse ({before} -> {after})")
    return ok


# ---------------------------------------------------------------------------
# P0.3 — delete_venue 500s on venues with fallback_songs/pins/analytics/blocked
# ---------------------------------------------------------------------------

def p0_3():
    # Create a throwaway venue via superadmin, seed one row in each child table
    # that P0.3 says delete_venue forgets, then delete it and expect 200.
    status, body = http("POST", "/api/superadmin/login", body={"username": "william", "password": "super123"})
    if status != 200:
        log("P0.3", "FAIL", f"superadmin login: {status} {body}")
        return False
    token = body["token"]

    c = db()
    c.execute("DELETE FROM admins WHERE username = 'p0_3_admin'")
    c.execute("DELETE FROM venues WHERE slug = 'p0-3-throwaway'")
    c.execute("DELETE FROM blocked_videos WHERE youtube_id = 'p0v3blocked'")
    c.commit()
    c.close()

    status, body = http(
        "POST", "/api/superadmin/venues",
        body={
            "name": "P0-3 throwaway", "slug": "p0-3-throwaway",
            "admin_username": "p0_3_admin", "admin_password": "throwaway123",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    if status not in (200, 201):
        log("P0.3", "FAIL", f"crear venue: {status} {body}")
        return False
    venue_id = body["venue"]["id"]

    c = db()
    c.execute("INSERT INTO fallback_songs (venue_id, youtube_id, title, position, active) VALUES (?, 'p0v3', 't', 1, 1)", (venue_id,))
    c.execute("INSERT INTO venue_daily_pins (venue_id, pin, valid_date) VALUES (?, '1234', '2026-01-01')", (venue_id,))
    c.execute("INSERT INTO analytics_events (venue_id, event_type) VALUES (?, 'test_event')", (venue_id,))
    c.execute("INSERT INTO blocked_videos (youtube_id, venue_id, error_code, title) VALUES ('p0v3blocked', ?, 150, 't')", (venue_id,))
    c.commit()
    c.close()

    status, body = http("DELETE", f"/api/superadmin/venues/{venue_id}", headers={"Authorization": f"Bearer {token}"})
    ok = status == 200
    if ok:
        log("P0.3", "PASS", f"venue con datos en las 4 tablas se borró sin 500 (status={status})")
    else:
        log("P0.3", "FAIL", f"status={status} body={body}")
    return ok


# ---------------------------------------------------------------------------
# P0.6 — rate limit re-check happens outside the lock (queue_service.add_song)
# ---------------------------------------------------------------------------

def p0_6():
    venue_id = get_venue_id()
    c = db()
    # Clean slate: previous runs may have left these exact youtube_ids in the
    # queue, which would make /confirm 409 (duplicate) instead of exercising
    # the rate limit this case targets.
    c.execute("DELETE FROM queue_songs WHERE venue_id = ? AND youtube_id IN ('p0race0001', 'p0race0002')", (venue_id,))
    c.execute(
        "UPDATE venues SET config = json_set(COALESCE(config, '{}'), '$.max_songs_per_window', 1, '$.window_minutes', 5) WHERE id = ?",
        (venue_id,),
    )
    c.commit()
    c.close()

    token = register_user(venue_id, table="p0_6")

    # Pre-cache metadata for two distinct videos so /confirm doesn't need YouTube.
    for i, yid in enumerate(["p0race0001", "p0race0002"]):
        c = db()
        c.execute(
            "INSERT OR REPLACE INTO song_metadata (youtube_id, title, duration_sec) VALUES (?, ?, 120)",
            (yid, f"P0 Race {i}"),
        )
        c.commit()
        c.close()

    responses = confirm_concurrent([(token, "p0race0001"), (token, "p0race0002")])

    accepted = sum(1 for status, _ in responses if status == 201)
    ok = accepted <= 1
    if ok:
        log("P0.6", "PASS", f"max_songs=1, 2 confirms simultáneos -> {accepted} aceptado(s) (esperado <=1)")
    else:
        log("P0.6", "FAIL", f"max_songs=1 pero {accepted} confirms simultáneos pasaron: {responses}")
    return ok


# ---------------------------------------------------------------------------
# P0.5 — auto-start transitions to 'playing' skip _playback_lock
# ---------------------------------------------------------------------------

def p0_5():
    """Two concurrent auto-starts (e.g. two confirms landing with an empty
    queue) must not both flip a song to 'playing'.

    A real HTTP-level race (threads or even asyncio.gather over separate
    connections) turned out too jittery to land inside the same event-loop
    tick reliably — see confirm_concurrent()'s docstring and P0.6, which DID
    catch it that way once. So this test calls the fixed function directly,
    in-process, via asyncio.gather against the SAME db connection the
    real server would use — that's how the pre-fix race was first confirmed
    (2 songs landed 'playing' from 2 concurrent calls) before playback_service
    even had try_start_song.
    """
    import asyncio as _asyncio
    import uuid as _uuid
    from app.config import settings as _settings
    from app import database as _database
    from app.services import playback_service as _playback_service

    venue_id = get_venue_id()
    token_a = register_user(venue_id, table="p0_5_a")
    token_b = register_user(venue_id, table="p0_5_b")

    c = db()
    c.execute("UPDATE queue_songs SET status = 'played' WHERE venue_id = ? AND status = 'playing'", (venue_id,))
    row_a = c.execute(
        "SELECT user_id, id FROM user_sessions WHERE venue_id=? AND table_number='p0_5_a' AND ended_at IS NULL "
        "ORDER BY started_at DESC LIMIT 1", (venue_id,),
    ).fetchone()
    row_b = c.execute(
        "SELECT user_id, id FROM user_sessions WHERE venue_id=? AND table_number='p0_5_b' AND ended_at IS NULL "
        "ORDER BY started_at DESC LIMIT 1", (venue_id,),
    ).fetchone()
    yid_a, yid_b = f"p0race5a{_uuid.uuid4().hex[:4]}", f"p0race5b{_uuid.uuid4().hex[:4]}"
    cur_a = c.execute(
        "INSERT INTO queue_songs (venue_id, user_id, session_id, youtube_id, title, position, status) "
        "VALUES (?,?,?,?,?,900,'pending')", (venue_id, row_a[0], row_a[1], yid_a, "P0.5 race A"),
    )
    cur_b = c.execute(
        "INSERT INTO queue_songs (venue_id, user_id, session_id, youtube_id, title, position, status) "
        "VALUES (?,?,?,?,?,901,'pending')", (venue_id, row_b[0], row_b[1], yid_b, "P0.5 race B"),
    )
    song_id_a, song_id_b = cur_a.lastrowid, cur_b.lastrowid
    c.commit()
    c.close()

    async def _run():
        # init_db() and the actual gather must share ONE event loop: aiosqlite's
        # background thread schedules completions back onto the loop that was
        # active when the connection was created — split across two separate
        # asyncio.run() calls, the second loop's awaits never resolve (hang).
        if _database._db is None:
            _settings.database_path = str(DB)
            await _database.init_db()
        return await _asyncio.gather(
            _playback_service.try_start_song(venue_id, song_id_a),
            _playback_service.try_start_song(venue_id, song_id_b),
        )

    started_a, started_b = _asyncio.run(_run())
    winners = sum(1 for s in (started_a, started_b) if s is not None)

    c = db()
    playing = c.execute(
        "SELECT COUNT(*) FROM queue_songs WHERE venue_id = ? AND status = 'playing' AND id IN (?, ?)",
        (venue_id, song_id_a, song_id_b),
    ).fetchone()[0]
    c.close()

    ok = winners == 1 and playing == 1
    if ok:
        log("P0.5", "PASS", f"2 llamadas concurrentes a try_start_song -> {winners} ganador, {playing} en 'playing' (esperado 1 y 1)")
    else:
        log("P0.5", "FAIL", f"2 llamadas concurrentes a try_start_song -> {winners} ganadores, {playing} en 'playing' (RACE)")
    return ok


CASES = {"p0_1": p0_1, "p0_2": p0_2, "p0_3": p0_3, "p0_4": p0_4, "p0_5": p0_5, "p0_6": p0_6}


if __name__ == "__main__":
    only = sys.argv[1] if len(sys.argv) > 1 else None
    cases = {only: CASES[only]} if only else CASES
    for name, fn in cases.items():
        try:
            fn()
        except Exception as e:
            log(name, "FAIL", f"exception: {e}")

    passed = sum(1 for _, s, _ in results if s == "PASS")
    failed = sum(1 for _, s, _ in results if s == "FAIL")
    print(f"\n  PASS: {passed}   FAIL: {failed}")
    sys.stdout.flush()
    # p0_5 opens a standalone aiosqlite connection whose background thread is
    # non-daemon — a normal process exit would hang waiting to join it.
    os._exit(1 if failed else 0)
