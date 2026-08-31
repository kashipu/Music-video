import hashlib
import os
from pathlib import Path

import aiosqlite

from app.config import settings

_db: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db


async def init_db() -> None:
    global _db
    db_path = settings.database_path
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)

    _db = await aiosqlite.connect(db_path, isolation_level=None)
    _db.row_factory = aiosqlite.Row

    await _db.execute("PRAGMA journal_mode = WAL")
    await _db.execute("PRAGMA foreign_keys = ON")
    await _db.execute("PRAGMA busy_timeout = 15000")
    await _db.execute("PRAGMA cache_size = -64000")
    await _db.execute("PRAGMA synchronous = NORMAL")

    await run_migrations(_db)


async def close_db() -> None:
    global _db
    if _db is not None:
        await _db.close()
        _db = None


async def run_migrations(db: aiosqlite.Connection) -> None:
    await db.execute("""
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE NOT NULL,
            sha256 TEXT,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    columns = await db.execute_fetchall("PRAGMA table_info(_migrations)")
    if "sha256" not in {column[1] for column in columns}:
        await db.execute("ALTER TABLE _migrations ADD COLUMN sha256 TEXT")
    await db.commit()

    migrations_dir = Path(__file__).parent / "db" / "migrations"
    if not migrations_dir.exists():
        return

    applied = {}
    async with db.execute("SELECT filename, sha256 FROM _migrations") as cursor:
        async for row in cursor:
            applied[row[0]] = row[1]

    migration_files = sorted(f for f in os.listdir(migrations_dir) if f.endswith(".sql"))

    for filename in migration_files:
        migration_path = migrations_dir / filename
        content = migration_path.read_bytes()
        sql = content.decode("utf-8")
        sha256 = hashlib.sha256(content).hexdigest()
        if filename in applied:
            if applied[filename] is None:
                await db.execute(
                    "UPDATE _migrations SET sha256 = ? WHERE filename = ?",
                    (sha256, filename),
                )
                await db.commit()
            elif applied[filename] != sha256:
                raise RuntimeError(f"Migration drift detected: {filename}")
            continue
        foreign_keys_off = sql.lstrip().startswith("-- migrate: foreign_keys=off")
        # Atomic per file: without this, a migration failing mid-script leaves
        # the DB half-migrated and unregistered — the next boot re-runs it and
        # dies with e.g. "duplicate column". (executescript commits any pending
        # txn first, so BEGIN/COMMIT must live inside the script itself.)
        try:
            if foreign_keys_off:
                await db.execute("PRAGMA foreign_keys = OFF")
            await db.executescript("BEGIN;\n" + sql + "\n;COMMIT;")
        except Exception:
            try:
                await db.execute("ROLLBACK")
            except Exception:
                pass
            raise
        finally:
            if foreign_keys_off:
                await db.execute("PRAGMA foreign_keys = ON")
        await db.execute(
            "INSERT INTO _migrations (filename, sha256) VALUES (?, ?)",
            (filename, sha256),
        )
        await db.commit()
