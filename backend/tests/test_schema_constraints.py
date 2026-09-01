from pathlib import Path

import aiosqlite
import pytest

from app.database import run_migrations


MIGRATIONS = Path(__file__).parents[1] / "app" / "db" / "migrations"


async def _new_db():
    db = await aiosqlite.connect(":memory:", isolation_level=None)
    await db.execute("PRAGMA foreign_keys = ON")
    return db


@pytest.mark.asyncio
async def test_json_and_paid_until_constraints_accept_valid_values():
    db = await _new_db()
    await run_migrations(db)

    await db.execute(
        "INSERT INTO venues (name, slug, config, paid_until) VALUES (?, ?, ?, ?)",
        ("Válido", "valido", '{"pin_required":true}', "2028-02-29"),
    )
    venue_id = (await db.execute_fetchall("SELECT id FROM venues WHERE slug = 'valido'"))[0][0]
    await db.execute(
        "INSERT INTO analytics_events (venue_id, event_type, event_data) VALUES (?, ?, ?)",
        (venue_id, "valid", '{"count":1}'),
    )
    await db.execute(
        "UPDATE venues SET config = ?, paid_until = ? WHERE id = ?",
        ('{"max_songs":5}', "2029-01-31", venue_id),
    )

    invalid_writes = (
        ("INSERT INTO venues (name, slug, config) VALUES ('Bad JSON', 'bad-json', '{')", ()),
        ("INSERT INTO venues (name, slug, paid_until) VALUES ('Bad date', 'bad-date', 'mañana')", ()),
        ("UPDATE venues SET config = '{' WHERE id = ?", (venue_id,)),
        ("UPDATE venues SET paid_until = '2029-02-30' WHERE id = ?", (venue_id,)),
        ("INSERT INTO analytics_events (event_type, event_data) VALUES ('bad', '{')", ()),
        ("UPDATE analytics_events SET event_data = '{' WHERE event_type = 'valid'", ()),
    )
    for sql, params in invalid_writes:
        with pytest.raises(aiosqlite.IntegrityError, match="CHECK constraint failed"):
            await db.execute(sql, params)

    assert await db.execute_fetchall("PRAGMA foreign_key_check") == []
    await db.close()


@pytest.mark.asyncio
async def test_migration_preserves_children_and_quarantines_dirty_values():
    db = await _new_db()
    await db.execute(
        "CREATE TABLE _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "filename TEXT UNIQUE NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
    )
    for migration in sorted(MIGRATIONS.glob("*.sql")):
        if migration.name.startswith("024_"):
            break
        await db.executescript("BEGIN;\n" + migration.read_text() + "\n;COMMIT;")
        await db.execute("INSERT INTO _migrations (filename) VALUES (?)", (migration.name,))

    cursor = await db.execute(
        "INSERT INTO venues (name, slug, config, paid_until, payment_notes) "
        "VALUES ('Heredado', 'heredado', '{', 'sin-fecha', 'Nota previa')"
    )
    venue_id = cursor.lastrowid
    await db.execute(
        "INSERT INTO fallback_songs (venue_id, youtube_id, title, position) "
        "VALUES (?, 'abcdefghijk', 'Canción', 1)",
        (venue_id,),
    )
    await db.execute(
        "INSERT INTO venue_billing_events "
        "(venue_id, kind, source, created_by_id, period_start, period_end) "
        "VALUES (?, 'trial', 'manual', 1, '2025-01-01', '2025-01-02')",
        (venue_id,),
    )
    await db.execute(
        "INSERT INTO analytics_events (venue_id, event_type, event_data) VALUES (?, 'legacy', '{')",
        (venue_id,),
    )
    await db.execute("PRAGMA foreign_keys = OFF")
    await db.execute(
        "INSERT INTO fallback_songs (venue_id, youtube_id, title, position) "
        "VALUES (999999, 'zzzzzzzzzzz', 'Huérfana heredada', 2)"
    )
    await db.execute("PRAGMA foreign_keys = ON")
    existing_fk_violations = [tuple(row) for row in await db.execute_fetchall(
        "PRAGMA foreign_key_check"
    )]

    await run_migrations(db)

    venue = (await db.execute_fetchall(
        "SELECT json_extract(config, '$._invalid_legacy_value'), paid_until, active, payment_notes "
        "FROM venues WHERE id = ?",
        (venue_id,),
    ))[0]
    event_data = (await db.execute_fetchall(
        "SELECT json_extract(event_data, '$._invalid_legacy_value') "
        "FROM analytics_events WHERE venue_id = ?",
        (venue_id,),
    ))[0][0]
    assert tuple(venue[:3]) == ("{", None, 0)
    assert "Nota previa" in venue[3] and "sin-fecha" in venue[3]
    assert event_data == "{"
    assert (await db.execute_fetchall(
        "SELECT COUNT(*) FROM fallback_songs WHERE venue_id = ?", (venue_id,)
    ))[0][0] == 1
    assert (await db.execute_fetchall(
        "SELECT COUNT(*) FROM venue_billing_events WHERE venue_id = ?", (venue_id,)
    ))[0][0] == 1
    assert [tuple(row) for row in await db.execute_fetchall(
        "PRAGMA foreign_key_check"
    )] == existing_fk_violations
    await db.close()


async def _columns_by_table(db):
    tables = await db.execute_fetchall(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    )
    return {
        row[0]: {column[1] for column in await db.execute_fetchall(
            f"PRAGMA table_info('{row[0]}')"
        )}
        for row in tables
    }


@pytest.mark.asyncio
async def test_ninguna_migracion_pierde_columnas():
    """Reconstruir una tabla (el único modo de agregar un CHECK en SQLite) copia
    las columnas a mano. Si la lista se escribió antes de que otra migración
    agregara una columna, el INSERT…SELECT la omite y el DROP TABLE la borra:
    los datos se pierden en el despliegue, en silencio y sin error."""
    db = await _new_db()
    previous = {}
    for migration in sorted(MIGRATIONS.glob("*.sql")):
        sql = migration.read_text()
        if sql.lstrip().startswith("-- migrate: foreign_keys=off"):
            await db.execute("PRAGMA foreign_keys = OFF")
        await db.executescript("BEGIN;\n" + sql + "\n;COMMIT;")
        await db.execute("PRAGMA foreign_keys = ON")

        current = await _columns_by_table(db)
        for table, columns in previous.items():
            if table not in current:
                continue  # retirar una tabla entera es deliberado, no un descuido
            lost = columns - current[table]
            assert not lost, f"{migration.name} eliminó {table}.{sorted(lost)}"
        previous = current
    await db.close()
