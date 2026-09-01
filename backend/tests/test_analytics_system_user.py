import aiosqlite
import pytest

from app.services import analytics_service


async def analytics_db(monkeypatch):
    db = await aiosqlite.connect(":memory:", isolation_level=None)
    await db.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            phone TEXT UNIQUE NOT NULL,
            display_name TEXT,
            is_system BOOLEAN NOT NULL DEFAULT 0
        );
        CREATE TABLE play_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venue_id INTEGER NOT NULL,
            user_id INTEGER,
            youtube_id TEXT,
            title TEXT,
            played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE queue_songs (
            id INTEGER PRIMARY KEY,
            venue_id INTEGER,
            user_id INTEGER,
            session_id TEXT,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE user_sessions (id TEXT PRIMARY KEY, table_number TEXT);
        """
    )
    await db.executemany(
        "INSERT INTO users (id, phone, is_system) VALUES (?, ?, ?)",
        [(1, "3001234567", 0), (2, "admin", 1)],
    )
    await db.executemany(
        "INSERT INTO play_history (venue_id, user_id, youtube_id, title) VALUES (?, ?, ?, ?)",
        [(1, 1, "yt1", "Song 1"), (1, 2, "yt2", "Admin-added song")],
    )

    async def test_db():
        return db

    monkeypatch.setattr(analytics_service, "get_db", test_db)
    return db


@pytest.mark.asyncio
async def test_system_user_excluded_from_unique_visitor_count(monkeypatch):
    await analytics_db(monkeypatch)

    result = await analytics_service.get_analytics(venue_id=1, period="all")

    assert result["summary"]["total_songs_played"] == 2  # both plays still counted
    assert result["summary"]["unique_users"] == 1  # only the real customer counts as a visitor


@pytest.mark.asyncio
async def test_system_user_excluded_from_daily_people_count(monkeypatch):
    await analytics_db(monkeypatch)

    result = await analytics_service.get_daily_analytics(venue_id=1, period="all")

    assert result["days"][0]["songs"] == 2
    assert result["days"][0]["people"] == 1
