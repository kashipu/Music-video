import aiosqlite
import pytest
import pytest_asyncio

from app.services import playback_service


# aiosqlite corre cada conexión en un hilo no-daemon: si no se cierra,
# pytest termina en verde y se queda colgado al salir.
@pytest_asyncio.fixture
async def playback_db(monkeypatch):
    """Two venues, each with a song currently 'playing' — models an attacker on
    venue A submitting venue B's song_id (song ids are global, guessable ints)."""
    db = await aiosqlite.connect(":memory:", isolation_level=None)
    await db.executescript(
        """
        CREATE TABLE queue_songs (
            id INTEGER PRIMARY KEY,
            venue_id INTEGER NOT NULL,
            user_id INTEGER,
            youtube_id TEXT,
            title TEXT,
            duration_sec INTEGER,
            status TEXT NOT NULL,
            position INTEGER DEFAULT 0,
            played_at TIMESTAMP
        );
        CREATE TABLE play_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venue_id INTEGER NOT NULL,
            user_id INTEGER,
            youtube_id TEXT,
            title TEXT,
            duration_sec INTEGER
        );
        CREATE TABLE submission_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            venue_id INTEGER,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE blocked_videos (
            youtube_id TEXT,
            venue_id INTEGER,
            error_code INTEGER,
            title TEXT
        );
        """
    )
    await db.execute(
        "INSERT INTO queue_songs (id, venue_id, user_id, youtube_id, title, duration_sec, status) "
        "VALUES (100, 2, 99, 'yt-victim', 'Victim Song', 180, 'playing')"
    )

    async def test_db():
        return db

    monkeypatch.setattr(playback_service, "get_db", test_db)
    yield db
    await db.close()


@pytest.mark.asyncio
async def test_finish_song_ignores_other_venues_song(playback_db):
    db = playback_db

    # Attacker on venue 1 claims venue 2's song id 100 as finished.
    result = await playback_service.finish_song(song_id=100, venue_id=1)

    assert result["finished_user_id"] is None
    rows = await db.execute_fetchall("SELECT status FROM queue_songs WHERE id = 100")
    assert rows[0][0] == "playing"  # victim's song untouched
    history = await db.execute_fetchall("SELECT * FROM play_history")
    assert history == []  # no cross-tenant play_history corruption


@pytest.mark.asyncio
async def test_error_song_ignores_other_venues_song(playback_db):
    db = playback_db

    result = await playback_service.error_song(song_id=100, venue_id=1, error_code=150)

    assert result["finished_user_id"] is None
    assert result["error_youtube_id"] is None
    rows = await db.execute_fetchall("SELECT status FROM queue_songs WHERE id = 100")
    assert rows[0][0] == "playing"
    blocked = await db.execute_fetchall("SELECT * FROM blocked_videos")
    assert blocked == []
