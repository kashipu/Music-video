"""Update song titles from YouTube oEmbed. Run with: python -m app.db.update_titles"""
import asyncio
import httpx
from app.database import init_db, get_db, close_db


async def fetch_title(video_id: str) -> str | None:
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.json().get("title")
    except Exception:
        pass
    return None


async def update():
    await init_db()
    db = await get_db()

    # Update queue_songs
    rows = await db.execute_fetchall(
        "SELECT id, youtube_id, title FROM queue_songs WHERE title LIKE 'Video %'"
    )
    print(f"Found {len(rows)} songs to update in queue_songs")
    for row in rows:
        title = await fetch_title(row[1])
        if title:
            await db.execute("UPDATE queue_songs SET title = ? WHERE id = ?", (title, row[0]))
            print(f"  Updated: {row[2]} -> {title}")

    # Update song_metadata
    meta_rows = await db.execute_fetchall(
        "SELECT youtube_id, title FROM song_metadata WHERE title LIKE 'Video %'"
    )
    print(f"Found {len(meta_rows)} songs to update in song_metadata")
    for row in meta_rows:
        title = await fetch_title(row[0])
        if title:
            await db.execute("UPDATE song_metadata SET title = ? WHERE youtube_id = ?", (title, row[0]))
            print(f"  Updated: {row[1]} -> {title}")

    await db.commit()
    print("Done!")
    await close_db()


if __name__ == "__main__":
    asyncio.run(update())
