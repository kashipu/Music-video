"""Seed the database with test data. Run with: python -m app.db.seed"""
import asyncio
import bcrypt
from app.database import init_db, get_db, close_db


async def seed():
    await init_db()
    db = await get_db()

    # Create test venues
    await db.execute(
        "INSERT OR IGNORE INTO venues (name, slug, fallback_mode, config) "
        "VALUES ('Bar Dev', 'bar-dev', 'playlist', '{\"max_duration_sec\": 600}')"
    )
    await db.execute(
        "INSERT OR IGNORE INTO venues (name, slug, fallback_mode, config) "
        "VALUES ('Kiosko', 'kiosko', 'playlist', '{\"max_duration_sec\": 600}')"
    )
    await db.commit()

    # Look up actual venue IDs
    rows = await db.execute_fetchall("SELECT id, slug FROM venues")
    venue_map = {row[1]: row[0] for row in rows}

    # Create admin for each venue
    password_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
    if "bar-dev" in venue_map:
        await db.execute(
            "INSERT OR IGNORE INTO admins (venue_id, username, password_hash) "
            "VALUES (?, 'admin', ?)",
            (venue_map["bar-dev"], password_hash),
        )
    if "kiosko" in venue_map:
        await db.execute(
            "INSERT OR IGNORE INTO admins (venue_id, username, password_hash) "
            "VALUES (?, 'kiosko_admin', ?)",
            (venue_map["kiosko"], password_hash),
        )

    # Create super admin
    super_hash = bcrypt.hashpw(b"super123", bcrypt.gensalt()).decode()
    await db.execute(
        "INSERT OR IGNORE INTO super_admins (username, password_hash) "
        "VALUES ('william', ?)",
        (super_hash,),
    )

    await db.commit()
    print("Seed completed:")
    for slug, vid in venue_map.items():
        print(f"  Venue {vid}: {slug} -> /{slug}/usuario")
    print("  Admin bar-dev:    username=admin, password=admin123")
    print("  Admin kiosko:     username=kiosko_admin, password=admin123")
    print("  Super Admin:      username=william, password=super123")
    print("  Super Admin URL:  /superadmin")

    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
