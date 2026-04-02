import os
import aiosqlite
from pathlib import Path

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
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await db.commit()

    migrations_dir = Path(__file__).parent / "db" / "migrations"
    if not migrations_dir.exists():
        return

    applied = set()
    async with db.execute("SELECT filename FROM _migrations") as cursor:
        async for row in cursor:
            applied.add(row[0])

    migration_files = sorted(f for f in os.listdir(migrations_dir) if f.endswith(".sql"))

    for filename in migration_files:
        if filename in applied:
            continue
        sql = (migrations_dir / filename).read_text(encoding="utf-8")
        await db.executescript(sql)
        await db.execute("INSERT INTO _migrations (filename) VALUES (?)", (filename,))
        await db.commit()
