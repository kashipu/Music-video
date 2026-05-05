"""Reproduce: cola con varias canciones de usuarios, admin Siguiente toca fallback."""
import sqlite3, json, sys, io
from pathlib import Path
import urllib.request

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

API = "http://localhost:8000"
DB = Path(__file__).resolve().parent.parent / "backend" / "data" / "barqueue.db"
VENUE = "qa-test"


def http(m, p, body=None, headers=None):
    h = {"Content-Type": "application/json"}
    if headers: h.update(headers)
    req = urllib.request.Request(API + p, data=json.dumps(body).encode() if body else None, headers=h, method=m)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def reset():
    c = sqlite3.connect(DB)
    cur = c.cursor()
    venue = cur.execute("SELECT id FROM venues WHERE slug = ?", (VENUE,)).fetchone()
    if not venue:
        print("ERROR: qa-test no existe. Corre qa_bug_hunt.py primero.")
        sys.exit(1)
    venue_id = venue[0]
    for tbl in ("queue_songs", "submission_log", "user_sessions", "blocked_videos", "fallback_songs"):
        cur.execute(f"DELETE FROM {tbl} WHERE venue_id = ?", (venue_id,))
    # Add 3 fallback songs so we can detect the bug
    cur.executemany(
        "INSERT INTO fallback_songs (venue_id, youtube_id, title, position, active) VALUES (?, ?, ?, ?, 1)",
        [(venue_id, f"fb{i}", f"Fallback {i}", i) for i in range(1, 4)]
    )
    c.commit()
    c.close()
    return venue_id


def db_state(venue_id, label):
    c = sqlite3.connect(DB)
    rows = c.execute(
        "SELECT id, position, status, title, user_id FROM queue_songs WHERE venue_id = ? ORDER BY position",
        (venue_id,)
    ).fetchall()
    c.close()
    print(f"\n--- DB state: {label} ---")
    for r in rows:
        print(f"  id={r[0]:3d} pos={r[1]} status={r[2]:8s} title={r[3]} user_id={r[4]}")
    return rows


venue_id = reset()
print(f"Venue qa-test id={venue_id}, fallback playlist = 3 canciones")

# Login admin
_, body = http("POST", "/api/admin/login", body={"username": "qa_admin", "password": "qa123", "venue_slug": VENUE})
admin_token = body["token"]

# Register 3 users + confirm 1 song each
tokens = []
for i in range(3):
    _, b = http("POST", "/api/auth/register", body={
        "phone": f"3009999{i:03d}", "table_number": str(i+1), "venue_slug": VENUE,
        "data_consent": True, "display_name": f"User{i+1}",
    })
    tokens.append(b["token"])

# Pre-seed metadata
c = sqlite3.connect(DB)
for i in range(3):
    c.execute("INSERT OR REPLACE INTO song_metadata (youtube_id, title, duration_sec) VALUES (?, ?, ?)",
              (f"usrvid{i+1}", f"User Song {i+1}", 180))
c.commit()
c.close()

# 3 user songs into queue
for i, tok in enumerate(tokens):
    code, b = http("POST", "/api/queue/songs/confirm",
                   body={"youtube_id": f"usrvid{i+1}"},
                   headers={"Authorization": f"Bearer {tok}"})
    print(f"  confirmed usrvid{i+1}: code={code}, position={b.get('position')}")

db_state(venue_id, "después de 3 confirms")

# Verify what /api/admin/queue returns
_, q = http("GET", "/api/admin/queue", headers={"Authorization": f"Bearer {admin_token}"})
print("\n--- /api/admin/queue ---")
print(f"  now_playing: {q.get('now_playing')}")
print(f"  fallback_now_playing: {q.get('fallback_now_playing')}")
print(f"  queue: {[(s['position'], s['title']) for s in q.get('queue', [])]}")

# Now simulate admin clicking Siguiente while User1 is playing
print("\n--- Admin click Siguiente ---")
code, b = http("POST", "/api/admin/queue/skip", headers={"Authorization": f"Bearer {admin_token}"})
print(f"  skip response: code={code}")
print(f"  skipped: {b.get('skipped')}")
print(f"  now_playing: {b.get('now_playing')}")

db_state(venue_id, "después de skip 1")

# Click Siguiente AGAIN
print("\n--- Admin click Siguiente (2nd) ---")
code, b = http("POST", "/api/admin/queue/skip", headers={"Authorization": f"Bearer {admin_token}"})
print(f"  skip response: code={code}, skipped={b.get('skipped', {}).get('title')}, now_playing={b.get('now_playing', {}).get('title') if b.get('now_playing') else None}")

db_state(venue_id, "después de skip 2")

# Verify endpoint says
_, q = http("GET", "/api/admin/queue", headers={"Authorization": f"Bearer {admin_token}"})
print(f"\n  /api/admin/queue → now_playing: {q.get('now_playing', {}).get('title') if q.get('now_playing') else None}")
print(f"  fallback_now_playing: {q.get('fallback_now_playing')}")
