import aiosqlite
import pytest

from app import database


@pytest.mark.asyncio
async def test_run_migrations_rejects_changed_applied_migration(tmp_path, monkeypatch):
    migrations_dir = tmp_path / "app" / "db" / "migrations"
    migrations_dir.mkdir(parents=True)
    migration = migrations_dir / "001_test.sql"
    migration.write_text("CREATE TABLE test_table (id INTEGER);", encoding="utf-8")
    monkeypatch.setattr(database, "__file__", str(tmp_path / "app" / "database.py"))

    db = await aiosqlite.connect(":memory:", isolation_level=None)
    await database.run_migrations(db)

    migration.write_text("CREATE TABLE test_table (id TEXT);", encoding="utf-8")
    with pytest.raises(RuntimeError, match="001_test.sql"):
        await database.run_migrations(db)

    await db.close()
